import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { listClientMeetingNotes } from "@/lib/client-meeting-notes";
import { prisma } from "@/lib/prisma";

async function portalClient(slug: string) {
  const decoded = decodeURIComponent(slug).trim().toLowerCase();
  if (!decoded) return null;
  return prisma.opsClient.findFirst({
    where: { slug: decoded, publicPortalEnabled: true, status: "active" },
    select: { id: true },
  });
}

export async function GET(_request: NextRequest, { params }: { params: { slug: string } }) {
  const client = await portalClient(params.slug);
  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const notes = await listClientMeetingNotes(client.id);
  return NextResponse.json({ notes });
}

export async function PATCH(request: NextRequest, { params }: { params: { slug: string } }) {
  const client = await portalClient(params.slug);
  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await request.json().catch(() => null)) as
    | { action?: string; id?: string; ids?: string[] }
    | null;
  const action = body?.action;

  if (action === "reorder") {
    const ids = Array.isArray(body?.ids) ? body.ids.map((id) => String(id)) : [];
    const open = await prisma.opsClientMeetingNote.findMany({
      where: { clientId: client.id, discussedAt: null },
      select: { id: true },
    });
    const openIds = new Set(open.map((note) => note.id));
    if (new Set(ids).size !== openIds.size || ids.some((id) => !openIds.has(id))) {
      return NextResponse.json({ error: "Could not reorder those points." }, { status: 400 });
    }
    await prisma.$transaction(
      ids.map((id, index) =>
        prisma.opsClientMeetingNote.update({
          where: { id },
          data: { sortOrder: index },
        })
      )
    );
  } else if (action === "discuss" || action === "reopen") {
    const id = String(body?.id ?? "");
    if (!id) return NextResponse.json({ error: "Missing note." }, { status: 400 });
    const note = await prisma.opsClientMeetingNote.findFirst({
      where: { id, clientId: client.id },
      select: { id: true },
    });
    if (!note) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await prisma.opsClientMeetingNote.update({
      where: { id },
      data: { discussedAt: action === "discuss" ? new Date() : null },
    });
  } else {
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }

  const notes = await listClientMeetingNotes(client.id);
  return NextResponse.json({ notes });
}
