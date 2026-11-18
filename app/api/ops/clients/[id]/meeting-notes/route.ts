import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { listClientMeetingNotes, parseMeetingNoteFields } from "@/lib/client-meeting-notes";
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
  const notes = await listClientMeetingNotes(client.id);
  return NextResponse.json({ notes });
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
  } | null;
  const parsed = parseMeetingNoteFields(body ?? {});
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const last = await prisma.opsClientMeetingNote.findFirst({
    where: { clientId: client.id, discussedAt: null },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  await prisma.opsClientMeetingNote.create({
    data: {
      clientId: client.id,
      title: parsed.title,
      body: parsed.body,
      forName: parsed.forName,
      sortOrder: (last?.sortOrder ?? -1) + 1,
    },
  });
  await revalidateClientPortalByClientId(client.id);
  const notes = await listClientMeetingNotes(client.id);
  return NextResponse.json({ notes });
}
