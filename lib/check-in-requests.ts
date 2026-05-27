import type { OpsCheckInRequest } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createGoogleCalendarEvent, patchGoogleCalendarEvent } from "@/lib/google-calendar";
import { createOpsNotification } from "@/lib/ops-notifications";

export function serializeCheckInRequest(
  row: OpsCheckInRequest & {
    athlete: { fullName: string; athleteCode: string; email: string | null };
    project: { name: string; client: { name: string } } | null;
  }
) {
  return {
    id: row.id,
    athleteId: row.athleteId,
    athleteName: row.athlete.fullName,
    athleteCode: row.athlete.athleteCode,
    athleteEmail: row.athlete.email,
    projectId: row.projectId,
    projectName: row.project?.name ?? null,
    clientName: row.project?.client?.name ?? null,
    reason: row.reason,
    contextNotes: row.contextNotes,
    requestedStartAt: row.requestedStartAt.toISOString(),
    requestedEndAt: row.requestedEndAt.toISOString(),
    status: row.status,
    adminNote: row.adminNote,
    counterStartAt: row.counterStartAt?.toISOString() ?? null,
    counterEndAt: row.counterEndAt?.toISOString() ?? null,
    zoomLink: row.zoomLink,
    googleEventId: row.googleEventId,
    googleEventLink: row.googleEventLink,
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function loadCheckInRequest(id: string) {
  return prisma.opsCheckInRequest.findUnique({
    where: { id },
    include: {
      athlete: { select: { fullName: true, athleteCode: true, email: true } },
      project: { include: { client: { select: { name: true } } } },
    },
  });
}

function eventTitle(athleteName: string, projectName: string | null): string {
  return projectName
    ? `Blocharch check-in: ${athleteName} — ${projectName}`
    : `Blocharch check-in: ${athleteName}`;
}

function eventDescription(row: {
  reason: string;
  contextNotes: string | null;
  adminNote: string | null;
  zoomLink: string | null;
}): string {
  const parts = [`Reason: ${row.reason}`];
  if (row.contextNotes?.trim()) parts.push(`Athlete notes: ${row.contextNotes.trim()}`);
  if (row.adminNote?.trim()) parts.push(`Admin: ${row.adminNote.trim()}`);
  if (row.zoomLink?.trim()) parts.push(`Zoom: ${row.zoomLink.trim()}`);
  return parts.join("\n\n");
}

export async function createCheckInCalendarEvent(
  row: OpsCheckInRequest & {
    athlete: { fullName: string; email: string | null };
    project: { name: string } | null;
  },
  start: Date,
  end: Date
) {
  const created = await createGoogleCalendarEvent({
    title: eventTitle(row.athlete.fullName, row.project?.name ?? null),
    description: eventDescription(row),
    start,
    end,
    attendeeEmail: row.athlete.email,
  });

  if (!created) return { googleEventId: null as string | null, googleEventLink: null as string | null };

  return { googleEventId: created.eventId, googleEventLink: created.htmlLink };
}

export async function notifyAdminNewCheckIn(
  athleteId: string,
  athleteName: string,
  projectId: string | null,
  projectName: string | null,
  reason: string,
  slotLabel: string
) {
  await createOpsNotification({
    athleteId,
    projectId,
    type: "check_in_request",
    title: `${athleteName} — Book a Call request`,
    message: `${reason}\nPreferred: ${slotLabel}`,
    actionRequired: "Review under Check-in requests — approve, decline, or suggest another time",
  });
}

export async function syncCalendarEventDescription(
  googleEventId: string,
  row: { reason: string; contextNotes: string | null; adminNote: string | null; zoomLink: string | null }
) {
  await patchGoogleCalendarEvent(googleEventId, {
    description: eventDescription(row),
  });
}
