import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { listClientMeetingNotes, parseMeetingNoteFields } from "@/lib/client-meeting-notes";
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
    discussed?: unknown;
  } | null;

  const data: { title?: string; body?: string; forName?: string; discussedAt?: Date | null } = {};
  if (body && (body.title !== undefined || body.body !== undefined || body.forName !== undefined)) {
    const current = await prisma.opsClientMeetingNote.findUnique({ where: { id: noteId } });
    const parsed = parseMeetingNoteFields({
      title: body.title !== undefined ? body.title : current?.title,
      body: body.body !== undefined ? body.body : current?.body,
      forName: body.forName !== undefined ? body.forName : current?.forName,
    });
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    data.title = parsed.title;
    data.body = parsed.body;
    data.forName = parsed.forName;
  }
  if (body && typeof body.discussed === "boolean") {
    data.discussedAt = body.discussed ? new Date() : null;
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  await prisma.opsClientMeetingNote.update({ where: { id: noteId }, data });
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
