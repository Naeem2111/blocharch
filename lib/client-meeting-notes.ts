import { prisma } from "@/lib/prisma";

export type ClientMeetingNote = {
  id: string;
  title: string;
  body: string;
  forName: string;
  sortOrder: number;
  discussedAt: string | null;
  createdAt: string;
};

const TITLE_MAX = 160;
const BODY_MAX = 2000;
const FOR_MAX = 120;

export function serializeClientMeetingNote(note: {
  id: string;
  title: string;
  body: string;
  forName: string;
  sortOrder: number;
  discussedAt: Date | null;
  createdAt: Date;
}): ClientMeetingNote {
  return {
    id: note.id,
    title: note.title,
    body: note.body,
    forName: note.forName,
    sortOrder: note.sortOrder,
    discussedAt: note.discussedAt?.toISOString() ?? null,
    createdAt: note.createdAt.toISOString(),
  };
}

export async function listClientMeetingNotes(clientId: string): Promise<ClientMeetingNote[]> {
  const rows = await prisma.opsClientMeetingNote.findMany({
    where: { clientId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return rows.map(serializeClientMeetingNote);
}

export function parseMeetingNoteFields(input: {
  title?: unknown;
  body?: unknown;
  forName?: unknown;
}): { ok: true; title: string; body: string; forName: string } | { ok: false; error: string } {
  const title = String(input.title ?? "").trim();
  const body = String(input.body ?? "").trim();
  const forName = String(input.forName ?? "").trim();
  if (!title || title.length > TITLE_MAX) return { ok: false, error: "Add a short title." };
  if (!body || body.length > BODY_MAX) return { ok: false, error: "Add what you want to discuss." };
  if (!forName || forName.length > FOR_MAX) return { ok: false, error: "Say who this point is for." };
  return { ok: true, title, body, forName };
}
