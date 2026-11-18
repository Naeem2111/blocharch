import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  listClientMeetingNoteProjects,
  listClientMeetingNotes,
  parseMeetingNoteFields,
  parseMeetingNotePeople,
  parseMeetingNoteProjectIds,
  replaceMeetingNoteProjects,
} from "@/lib/client-meeting-notes";
import { requireOpsSession } from "@/lib/ops-access";
import { prisma } from "@/lib/prisma";
import { revalidateClientPortalByClientId } from "@/lib/revalidate-client-portal";

type RouteContext = { params: Promise<{ id: string }> };

async function existingClient(id: string) {
  return prisma.opsClient.findUnique({ where: { id }, select: { id: true } });
}

export async function GET(request: NextRequest, context: RouteContext) {
  const gate = await requireOpsSession(request);
  if (gate instanceof NextResponse) return gate;
  const { id } = await context.params;
  const client = await existingClient(id);
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });
  const [notes, projects] = await Promise.all([
    listClientMeetingNotes(client.id),
    listClientMeetingNoteProjects(client.id),
  ]);
  return NextResponse.json({ notes, projects });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const gate = await requireOpsSession(request);
  if (gate instanceof NextResponse) return gate;
  const { id } = await context.params;
  const client = await existingClient(id);
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const body = (await request.json().catch(() => null)) as {
    title?: unknown;
    body?: unknown;
    forName?: unknown;
    people?: unknown;
    projectIds?: unknown;
  } | null;
  const parsed = parseMeetingNoteFields(body ?? {});
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const people = parseMeetingNotePeople(body?.people, body?.forName);
  if (!people.ok) return NextResponse.json({ error: people.error }, { status: 400 });
  const projectIds = parseMeetingNoteProjectIds(body?.projectIds);
  if (!projectIds.ok) return NextResponse.json({ error: projectIds.error }, { status: 400 });

  const last = await prisma.opsClientMeetingNote.findFirst({
    where: { clientId: client.id, discussedAt: null },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  try {
    const created = await prisma.opsClientMeetingNote.create({
      data: {
        clientId: client.id,
        title: parsed.title,
        body: parsed.body,
        people: people.people,
        forName: people.people[0] ?? null,
        sortOrder: (last?.sortOrder ?? -1) + 1,
      },
    });
    await replaceMeetingNoteProjects(created.id, client.id, projectIds.projectIds);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save that note.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
  await revalidateClientPortalByClientId(client.id);
  const notes = await listClientMeetingNotes(client.id);
  return NextResponse.json({ notes });
}
