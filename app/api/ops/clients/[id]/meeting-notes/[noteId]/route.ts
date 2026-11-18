import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  listClientMeetingNotes,
  parseMeetingNoteFields,
  parseMeetingNotePeople,
  parseMeetingNoteProjectIds,
  replaceMeetingNoteProjects,
} from "@/lib/client-meeting-notes";
import { requireOpsSession } from "@/lib/ops-access";
import { prisma } from "@/lib/prisma";
import { revalidateClientPortalByClientId } from "@/lib/revalidate-client-portal";

type RouteContext = { params: Promise<{ id: string; noteId: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const gate = await requireOpsSession(request);
  if (gate instanceof NextResponse) return gate;
  const { id, noteId } = await context.params;
  const note = await prisma.opsClientMeetingNote.findFirst({
    where: { id: noteId, clientId: id },
    select: { id: true },
  });
  if (!note) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await request.json().catch(() => null)) as {
    title?: unknown;
    body?: unknown;
    forName?: unknown;
    people?: unknown;
    projectIds?: unknown;
    discussed?: unknown;
  } | null;

  const data: {
    title?: string;
    body?: string;
    forName?: string | null;
    people?: string[];
    discussedAt?: Date | null;
  } = {};
  const editingFields =
    body != null &&
    (body.title !== undefined || body.body !== undefined || body.people !== undefined || body.forName !== undefined);
  if (editingFields && body) {
    const current = await prisma.opsClientMeetingNote.findUnique({ where: { id: noteId } });
    const parsed = parseMeetingNoteFields({
      title: body.title !== undefined ? body.title : current?.title,
      body: body.body !== undefined ? body.body : current?.body,
    });
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const people = parseMeetingNotePeople(
      body.people !== undefined ? body.people : current?.people?.length ? current.people : undefined,
      body.people !== undefined ? undefined : current?.forName
    );
    if (!people.ok) return NextResponse.json({ error: people.error }, { status: 400 });
    data.title = parsed.title;
    data.body = parsed.body;
    data.people = people.people;
    data.forName = people.people[0] ?? null;
  }
  if (body && typeof body.discussed === "boolean") {
    data.discussedAt = body.discussed ? new Date() : null;
  }
  const projectIds = body && body.projectIds !== undefined ? parseMeetingNoteProjectIds(body.projectIds) : null;
  if (projectIds && !projectIds.ok) return NextResponse.json({ error: projectIds.error }, { status: 400 });
  if (Object.keys(data).length === 0 && !projectIds) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  try {
    if (Object.keys(data).length > 0) {
      await prisma.opsClientMeetingNote.update({ where: { id: noteId }, data });
    }
    if (projectIds?.ok) await replaceMeetingNoteProjects(noteId, id, projectIds.projectIds);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update that note.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
  await revalidateClientPortalByClientId(id);
  const notes = await listClientMeetingNotes(id);
  return NextResponse.json({ notes });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const gate = await requireOpsSession(request);
  if (gate instanceof NextResponse) return gate;
  const { id, noteId } = await context.params;
  const note = await prisma.opsClientMeetingNote.findFirst({
    where: { id: noteId, clientId: id },
    select: { id: true },
  });
  if (!note) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.opsClientMeetingNote.delete({ where: { id: noteId } });
  await revalidateClientPortalByClientId(id);
  const notes = await listClientMeetingNotes(id);
  return NextResponse.json({ notes });
}
