import type { Prisma } from "@prisma/client";
import { athleteProfileVisual } from "@/lib/athlete-profile-visual";
import { prisma } from "@/lib/prisma";
import { dateOnlyUtc, monthEndUtc, monthStartUtc } from "@/lib/ops-hours";
import { computeDeadlineBeat, formatDeadlineBeat } from "@/lib/project-deadline";

export type BeatenDeadlineProject = {
  projectId: string;
  projectName: string;
  clientName: string;
  dueDate: string;
  dueAt: string | null;
  completedDate: string;
  minutesBeaten: number;
  daysBeaten: number;
  beatenLabel: string;
};

export type BeatenDeadlinesByAthlete = {
  athleteId: string;
  athleteName: string;
  profilePhotoUrl: string | null;
  profilePhotoBgColor: string | null;
  profilePhotoTextTone: string | null;
  beatenCount: number;
  totalDaysBeaten: number;
  totalMinutesBeaten: number;
  averageDaysBeaten: number;
  projects: BeatenDeadlineProject[];
};

function resolveBeatenMinutes(
  project: {
    dueDate: Date;
    completedAt: Date | null;
    handoverDate: Date | null;
    updatedAt: Date;
    deadlineBeatenMinutes: number | null;
    deadlineBeatenDays: number | null;
  },
  completed: Date
): number | null {
  if (project.deadlineBeatenMinutes != null && project.deadlineBeatenMinutes > 0) {
    return project.deadlineBeatenMinutes;
  }
  if (project.deadlineBeatenDays != null && project.deadlineBeatenDays > 0) {
    return project.deadlineBeatenDays * 1440;
  }
  const beat = computeDeadlineBeat(project.dueDate, completed);
  return beat.minutes;
}

/** Projects completed before due datetime in the selected month. */
export async function buildBeatenDeadlines(
  reference: Date,
  clientId?: string | null,
  athleteId?: string | null
): Promise<BeatenDeadlinesByAthlete[]> {
  const from = monthStartUtc(reference);
  const to = monthEndUtc(reference);

  const where: Prisma.OpsProjectWhereInput = {
    currentStatus: { in: ["completed", "handed_over"] },
    dueDate: { not: null },
    assignedAthleteId: { not: null },
    ...(clientId ? { clientId } : {}),
    ...(athleteId ? { assignedAthleteId: athleteId } : {}),
  };

  const projects = await prisma.opsProject.findMany({
    where,
    include: {
      client: { select: { name: true } },
      assignedAthlete: {
        select: {
          id: true,
          fullName: true,
          profilePhotoUrl: true,
          profilePhotoBgColor: true,
          profilePhotoTextTone: true,
        },
      },
    },
  });

  const byAthlete = new Map<string, BeatenDeadlinesByAthlete>();

  for (const p of projects) {
    const dueDate = p.dueDate;
    if (!dueDate || !p.assignedAthlete) continue;

    const completed =
      p.completedAt != null
        ? p.completedAt
        : p.handoverDate
          ? dateOnlyUtc(p.handoverDate)
          : dateOnlyUtc(p.updatedAt);
    if (dateOnlyUtc(completed) < from || dateOnlyUtc(completed) > to) continue;

    const minutesBeaten = resolveBeatenMinutes(
      {
        dueDate,
        completedAt: p.completedAt,
        handoverDate: p.handoverDate,
        updatedAt: p.updatedAt,
        deadlineBeatenMinutes: p.deadlineBeatenMinutes,
        deadlineBeatenDays: p.deadlineBeatenDays,
      },
      completed
    );
    if (minutesBeaten == null || minutesBeaten <= 0) continue;

    const daysBeaten = Math.floor(minutesBeaten / 1440);
    const athleteKey = p.assignedAthlete.id;
    const profile = athleteProfileVisual(p.assignedAthlete);
    const entry = byAthlete.get(athleteKey) ?? {
      athleteId: athleteKey,
      athleteName: p.assignedAthlete.fullName,
      ...profile,
      beatenCount: 0,
      totalDaysBeaten: 0,
      totalMinutesBeaten: 0,
      averageDaysBeaten: 0,
      projects: [],
    };

    entry.beatenCount += 1;
    entry.totalMinutesBeaten += minutesBeaten;
    entry.totalDaysBeaten += daysBeaten;
    entry.projects.push({
      projectId: p.id,
      projectName: p.name,
      clientName: p.client.name,
      dueDate: dueDate.toISOString().slice(0, 10),
      dueAt: dueDate.toISOString(),
      completedDate: completed.toISOString(),
      minutesBeaten,
      daysBeaten,
      beatenLabel: formatDeadlineBeat(minutesBeaten) ?? `${minutesBeaten}m early`,
    });
    byAthlete.set(athleteKey, entry);
  }

  return Array.from(byAthlete.values())
    .map((a) => ({
      ...a,
      averageDaysBeaten:
        a.beatenCount > 0 ? Math.round((a.totalMinutesBeaten / a.beatenCount / 1440) * 10) / 10 : 0,
      projects: a.projects.sort((x, y) => y.minutesBeaten - x.minutesBeaten),
    }))
    .sort((a, b) => b.beatenCount - a.beatenCount || b.totalMinutesBeaten - a.totalMinutesBeaten);
}
