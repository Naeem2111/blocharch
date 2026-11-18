import { prisma } from "@/lib/prisma";

export type ClientMeetingNoteProject = {
  id: string;
  name: string;
  address: string | null;
};

export type ClientMeetingNote = {
  id: string;
  title: string;
  body: string;
  /** Optional. Empty when the point is not assigned to anyone. */
  people: string[];
  projects: ClientMeetingNoteProject[];
  sortOrder: number;
  discussedAt: string | null;
  createdAt: string;
};

export type MeetingNoteProjectOption = ClientMeetingNoteProject & {
  currentStatus: string;
};

const TITLE_MAX = 160;
const BODY_MAX = 2000;
const NAME_MAX = 120;
const PEOPLE_MAX = 12;
const PROJECTS_MAX = 20;

type NoteRow = {
  id: string;
  title: string;
  body: string;
  forName: string | null;
  people: string[];
  sortOrder: number;
  discussedAt: Date | null;
  createdAt: Date;
  projects: {
    project: { id: string; name: string; address: string | null };
  }[];
};

export function serializeClientMeetingNote(note: NoteRow): ClientMeetingNote {
  const stored = note.people.map((name) => name.trim()).filter(Boolean);
  const people = stored.length > 0 ? stored : note.forName?.trim() ? [note.forName.trim()] : [];
  const projects = note.projects
    .map((link) => link.project)
    .sort((a, b) => a.name.localeCompare(b.name));
  return {
    id: note.id,
    title: note.title,
    body: note.body,
    people,
    projects,
    sortOrder: note.sortOrder,
    discussedAt: note.discussedAt?.toISOString() ?? null,
    createdAt: note.createdAt.toISOString(),
  };
}

const noteInclude = {
  projects: {
    include: {
      project: { select: { id: true, name: true, address: true } },
    },
  },
} as const;

export async function listClientMeetingNotes(clientId: string): Promise<ClientMeetingNote[]> {
  const rows = await prisma.opsClientMeetingNote.findMany({
    where: { clientId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: noteInclude,
  });
  return rows.map(serializeClientMeetingNote);
}

function projectIsCompleted(status: string): boolean {
  return status === "completed" || status === "handed_over";
}

export async function listClientMeetingNoteProjects(clientId: string): Promise<MeetingNoteProjectOption[]> {
  const rows = await prisma.opsProject.findMany({
    where: { clientId },
    select: { id: true, name: true, address: true, currentStatus: true, completedAt: true },
  });
  rows.sort((a, b) => {
    const aDone = projectIsCompleted(a.currentStatus);
    const bDone = projectIsCompleted(b.currentStatus);
    if (aDone !== bDone) return aDone ? 1 : -1;
    if (aDone && bDone) {
      const aTime = a.completedAt?.getTime() ?? 0;
      const bTime = b.completedAt?.getTime() ?? 0;
      if (aTime !== bTime) return bTime - aTime;
    }
    return a.name.localeCompare(b.name);
  });
  return rows.map((project) => ({
    id: project.id,
    name: project.name,
    address: project.address,
    currentStatus: project.currentStatus,
  }));
}

export function parseMeetingNoteFields(input: {
  title?: unknown;
  body?: unknown;
}): { ok: true; title: string; body: string } | { ok: false; error: string } {
  const title = String(input.title ?? "").trim();
  const body = String(input.body ?? "").trim();
  if (!title || title.length > TITLE_MAX) return { ok: false, error: "Add a short title." };
  if (body.length > BODY_MAX) return { ok: false, error: "Shorten the discussion." };
  return { ok: true, title, body };
}

export function parseMeetingNotePeople(
  input: unknown,
  legacyForName?: unknown
): { ok: true; people: string[] } | { ok: false; error: string } {
  const raw = Array.isArray(input)
    ? input
    : legacyForName != null && String(legacyForName).trim()
      ? [legacyForName]
      : [];
  const people: string[] = [];
  for (const item of raw) {
    const name = String(item ?? "").trim();
    if (!name) continue;
    if (name.length > NAME_MAX) return { ok: false, error: "Each person needs a shorter name." };
    if (people.some((existing) => existing.toLowerCase() === name.toLowerCase())) continue;
    people.push(name);
  }
  if (people.length > PEOPLE_MAX) return { ok: false, error: `Add up to ${PEOPLE_MAX} people.` };
  return { ok: true, people };
}

export function parseMeetingNoteProjectIds(
  input: unknown
): { ok: true; projectIds: string[] } | { ok: false; error: string } {
  if (input == null) return { ok: true, projectIds: [] };
  if (!Array.isArray(input)) return { ok: false, error: "Choose projects from this client." };
  const projectIds = Array.from(new Set(input.map((id) => String(id ?? "").trim()).filter(Boolean)));
  if (projectIds.length > PROJECTS_MAX) return { ok: false, error: `Choose up to ${PROJECTS_MAX} projects.` };
  return { ok: true, projectIds };
}

export async function replaceMeetingNoteProjects(noteId: string, clientId: string, projectIds: string[]) {
  const owned = await prisma.opsProject.findMany({
    where: { id: { in: projectIds }, clientId },
    select: { id: true },
  });
  if (owned.length !== projectIds.length) {
    throw new Error("Choose projects that belong to this client.");
  }
  await prisma.opsClientMeetingNoteProject.deleteMany({ where: { noteId } });
  if (projectIds.length === 0) return;
  await prisma.opsClientMeetingNoteProject.createMany({
    data: projectIds.map((projectId) => ({ noteId, projectId })),
  });
}
