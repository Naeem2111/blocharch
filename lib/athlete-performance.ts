import type { OpsProjectPhase, OpsProjectStatus } from "@prisma/client";
import { athleteProfileVisual } from "@/lib/athlete-profile-visual";
import {
  COMPLEXITY_LABELS,
  displayProjectStageLabel,
  isOpsProjectComplexity,
  isOpsProjectPhase,
} from "@/lib/ops-constants";
import { dateOnlyUtc, parseDateOnly } from "@/lib/ops-hours";
import { quotedHoursByProjectIds } from "@/lib/ops-project-hours";
import { prisma } from "@/lib/prisma";

/** South Africa wall clock. Daily logs and deadlines are judged on this calendar. */
const WALL_OFFSET_MS = 2 * 60 * 60 * 1000;

export const PERFORMANCE_RULES = {
  deadlineBeaten: 15,
  deadlineMet: 8,
  perHourSaved: 1,
  perDayEarly: 1,
  earlyCapPerProject: 10,
  onTimeLog: 2,
  deadlineMissed: -12,
  perHourExceeded: -1,
  perBacklogDay: -2,
  perOutstandingDay: -2,
} as const;

const DONE = new Set<OpsProjectStatus>(["completed", "handed_over"]);
const HOLD = new Set<OpsProjectStatus>(["waiting_on_feedback", "blocked"]);

export type PerformanceFilters = {
  clientId: string | null;
  stage: string | null;
  complexity: string | null;
  from: string | null;
  to: string | null;
};

export type PerformanceBucket = {
  label: string;
  count: number;
  averageHours: number | null;
  averageTurnaroundDays: number | null;
  allocatedHours: number | null;
  actualHours: number;
  hoursSaved: number;
  hoursExceeded: number;
};

export type DeadlineRow = {
  projectId: string;
  name: string;
  clientName: string;
  stageLabel: string;
  complexityLabel: string;
  outcome: "met" | "beaten" | "missed" | "hold";
  hoursDelta: number | null;
  completedOn: string | null;
  dueOn: string | null;
};

export type PointsBreakdown = {
  beaten: number;
  met: number;
  saved: number;
  early: number;
  onTime: number;
  missed: number;
  exceeded: number;
  backlog: number;
  outstanding: number;
};

export type AthletePerformanceRow = {
  athleteId: string;
  athleteName: string;
  athleteCode: string;
  status: string;
  profilePhotoUrl: string | null;
  profilePhotoBgColor: string | null;
  profilePhotoTextTone: string | null;
  rank: number;
  points: number;
  projectsCompleted: number;
  stagesCompleted: number;
  hoursWorked: number;
  hoursSaved: number;
  hoursExceeded: number;
  allocatedHours: number | null;
  actualHours: number;
  averageTurnaroundDays: number | null;
  deadlinesMet: number;
  deadlinesBeaten: number;
  deadlinesMissed: number;
  hoursBeaten: number;
  hoursOverdue: number;
  averageHoursBeaten: number | null;
  deadlineSuccessRate: number | null;
  holds: number;
  logsOnTime: number;
  logsBacklogged: number;
  outstandingDays: number;
  daysBacklogged: number;
  logCompliance: number | null;
  streak: number;
  pointsBreakdown: PointsBreakdown;
  stages: PerformanceBucket[];
  complexities: PerformanceBucket[];
  deadlines: DeadlineRow[];
  deadlinesTruncated: boolean;
};

export type AthletePerformanceReport = {
  filters: PerformanceFilters & { scopedLogs: boolean };
  rules: typeof PERFORMANCE_RULES;
  athletes: AthletePerformanceRow[];
};

type Bucket = {
  label: string;
  count: number;
  hoursSum: number;
  turnaroundSum: number;
  turnaroundSamples: number;
  allocatedHours: number;
  quotedCount: number;
  actualHours: number;
  hoursSaved: number;
  hoursExceeded: number;
};

function wallDay(date: Date): string {
  return new Date(date.getTime() + WALL_OFFSET_MS).toISOString().slice(0, 10);
}

function dayKey(date: Date): string {
  return dateOnlyUtc(date).toISOString().slice(0, 10);
}

function addDays(day: string, amount: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + amount * 86400000).toISOString().slice(0, 10);
}

function isWeekday(day: string): boolean {
  const dow = new Date(`${day}T00:00:00Z`).getUTCDay();
  return dow !== 0 && dow !== 6;
}

function previousWeekday(day: string): string {
  let cursor = addDays(day, -1);
  while (!isWeekday(cursor)) cursor = addDays(cursor, -1);
  return cursor;
}

function inRange(day: string, from: string | null, to: string | null): boolean {
  if (from && day < from) return false;
  if (to && day > to) return false;
  return true;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function hoursBetween(later: Date, earlier: Date): number {
  return (later.getTime() - earlier.getTime()) / 3600000;
}

function stageLabel(stage: OpsProjectPhase, customLabel: string | null): string {
  if (stage === "custom" && customLabel?.trim()) return customLabel.trim();
  return displayProjectStageLabel(stage);
}

function blankBucket(label: string): Bucket {
  return {
    label,
    count: 0,
    hoursSum: 0,
    turnaroundSum: 0,
    turnaroundSamples: 0,
    allocatedHours: 0,
    quotedCount: 0,
    actualHours: 0,
    hoursSaved: 0,
    hoursExceeded: 0,
  };
}

function finishBucket(bucket: Bucket): PerformanceBucket {
  return {
    label: bucket.label,
    count: bucket.count,
    averageHours: bucket.count > 0 ? round1(bucket.hoursSum / bucket.count) : null,
    averageTurnaroundDays:
      bucket.turnaroundSamples > 0 ? round1(bucket.turnaroundSum / bucket.turnaroundSamples) : null,
    allocatedHours: bucket.quotedCount > 0 ? round1(bucket.allocatedHours) : null,
    actualHours: round1(bucket.actualHours),
    hoursSaved: round1(bucket.hoursSaved),
    hoursExceeded: round1(bucket.hoursExceeded),
  };
}

function currentStreak(onTimeDays: Set<string>, today: string): number {
  let cursor = isWeekday(today) && onTimeDays.has(today) ? today : previousWeekday(today);
  let streak = 0;
  while (onTimeDays.has(cursor) && streak < 4000) {
    streak += 1;
    cursor = previousWeekday(cursor);
  }
  return streak;
}

function logGap(recordedDay: string, createdAt: Date, markedBacklogged: boolean): number {
  const submittedDay = wallDay(createdAt);
  const gap = Math.round(
    (Date.parse(`${submittedDay}T00:00:00Z`) - Date.parse(`${recordedDay}T00:00:00Z`)) / 86400000
  );
  if (gap > 0) return gap;
  return markedBacklogged ? 1 : 0;
}

export async function buildAthletePerformance(input: {
  clientId?: string | null;
  stage?: string | null;
  complexity?: string | null;
  from?: string | null;
  to?: string | null;
  now?: Date;
}): Promise<AthletePerformanceReport> {
  const now = input.now ?? new Date();
  const today = wallDay(now);
  let from = input.from && parseDateOnly(input.from) ? input.from!.slice(0, 10) : null;
  let to = input.to && parseDateOnly(input.to) ? input.to!.slice(0, 10) : null;
  if (from && to && from > to) {
    const swap = from;
    from = to;
    to = swap;
  }
  const stage = input.stage && isOpsProjectPhase(input.stage) ? input.stage : null;
  const complexity =
    input.complexity && isOpsProjectComplexity(input.complexity) ? input.complexity : null;
  const clientId = input.clientId?.trim() || null;
  const scopedLogs = Boolean(clientId || stage || complexity);

  const stageFilter: { currentStage: OpsProjectPhase | { in: OpsProjectPhase[] } } | Record<string, never> =
    stage === "survey_conversion"
      ? { currentStage: { in: ["survey_conversion", "existing_drawings"] } }
      : stage
        ? { currentStage: stage }
        : {};

  const [athletes, projects] = await Promise.all([
    prisma.opsAthlete.findMany({
      select: {
        id: true,
        fullName: true,
        athleteCode: true,
        status: true,
        blocharchStartDate: true,
        profilePhotoUrl: true,
        profilePhotoBgColor: true,
        profilePhotoTextTone: true,
      },
      orderBy: { fullName: "asc" },
    }),
    prisma.opsProject.findMany({
      where: {
        ...(clientId ? { clientId } : {}),
        ...(complexity ? { complexity } : {}),
        ...stageFilter,
      },
      select: {
        id: true,
        name: true,
        assignedAthleteId: true,
        complexity: true,
        currentStage: true,
        currentStatus: true,
        startDate: true,
        dueDate: true,
        athleteDueDate: true,
        completedAt: true,
        updatedAt: true,
        client: { select: { name: true } },
        customStage: { select: { label: true } },
        athleteAssignments: {
          where: { isPrimary: true, removedAt: null },
          select: { athleteId: true },
          take: 1,
        },
      },
    }),
  ]);

  const projectIds = projects.map((project) => project.id);
  const submissionWhere = {
    ...(from || to
      ? {
          submissionDate: {
            ...(from ? { gte: parseDateOnly(from)! } : {}),
            ...(to ? { lte: parseDateOnly(to)! } : {}),
          },
        }
      : {}),
  };

  const [lines, submissions, quoted] = await Promise.all([
    projectIds.length === 0
      ? Promise.resolve([])
      : prisma.opsSubmissionLineItem.findMany({
          where: { projectId: { in: projectIds }, isHousekeeping: false },
          select: {
            projectId: true,
            hoursWorked: true,
            submission: {
              select: { athleteId: true, submissionDate: true },
            },
          },
        }),
    prisma.opsDailySubmission.findMany({
      where: submissionWhere,
      select: {
        athleteId: true,
        submissionDate: true,
        createdAt: true,
        isBackloggedSession: true,
        lineItems: {
          where: { isHousekeeping: false, projectId: { in: projectIds } },
          select: { id: true },
          take: 1,
        },
      },
    }),
    quotedHoursByProjectIds(projectIds),
  ]);

  const projectHours = new Map<string, number>();
  const periodHours = new Map<string, number>();
  for (const line of lines) {
    if (!line.projectId) continue;
    const hours = Number(line.hoursWorked) || 0;
    projectHours.set(line.projectId, (projectHours.get(line.projectId) ?? 0) + hours);
    const day = dayKey(line.submission.submissionDate);
    if (inRange(day, from, to)) {
      const athleteId = line.submission.athleteId;
      periodHours.set(athleteId, (periodHours.get(athleteId) ?? 0) + hours);
    }
  }

  type Mutable = {
    projectsCompleted: number;
    hoursWorked: number;
    hoursSaved: number;
    hoursExceeded: number;
    allocatedHours: number;
    quotedCount: number;
    actualHours: number;
    turnaroundSum: number;
    turnaroundSamples: number;
    deadlinesMet: number;
    deadlinesBeaten: number;
    deadlinesMissed: number;
    hoursBeaten: number;
    hoursOverdue: number;
    holds: number;
    logsOnTime: number;
    logsBacklogged: number;
    outstandingDays: number;
    daysBacklogged: number;
    onTimeDays: Set<string>;
    submittedDays: Set<string>;
    points: PointsBreakdown;
    stages: Map<string, Bucket>;
    complexities: Map<string, Bucket>;
    deadlines: DeadlineRow[];
  };

  const rows = new Map<string, Mutable>();
  const blank = (): Mutable => ({
    projectsCompleted: 0,
    hoursWorked: 0,
    hoursSaved: 0,
    hoursExceeded: 0,
    allocatedHours: 0,
    quotedCount: 0,
    actualHours: 0,
    turnaroundSum: 0,
    turnaroundSamples: 0,
    deadlinesMet: 0,
    deadlinesBeaten: 0,
    deadlinesMissed: 0,
    hoursBeaten: 0,
    hoursOverdue: 0,
    holds: 0,
    logsOnTime: 0,
    logsBacklogged: 0,
    outstandingDays: 0,
    daysBacklogged: 0,
    onTimeDays: new Set<string>(),
    submittedDays: new Set<string>(),
    points: {
      beaten: 0,
      met: 0,
      saved: 0,
      early: 0,
      onTime: 0,
      missed: 0,
      exceeded: 0,
      backlog: 0,
      outstanding: 0,
    },
    stages: new Map(),
    complexities: new Map(),
    deadlines: [],
  });

  for (const athlete of athletes) {
    const row = blank();
    row.hoursWorked = round1(periodHours.get(athlete.id) ?? 0);
    rows.set(athlete.id, row);
  }

  for (const project of projects) {
    const ownerId = project.assignedAthleteId ?? project.athleteAssignments[0]?.athleteId ?? null;
    if (!ownerId || !rows.has(ownerId)) continue;
    const row = rows.get(ownerId)!;
    const due = project.athleteDueDate ?? project.dueDate;
    const done = DONE.has(project.currentStatus);
    const completedAt = project.completedAt ?? (done ? project.updatedAt : null);
    const completedDay = completedAt ? wallDay(completedAt) : null;
    const dueDay = due ? wallDay(due) : null;
    const label = stageLabel(project.currentStage, project.customStage?.label ?? null);
    const complexityLabel = COMPLEXITY_LABELS[project.complexity];

    if (HOLD.has(project.currentStatus)) {
      const holdInView = !from && !to ? true : Boolean(dueDay && inRange(dueDay, from, to));
      if (holdInView) {
        row.holds += 1;
        row.deadlines.push({
          projectId: project.id,
          name: project.name,
          clientName: project.client.name,
          stageLabel: label,
          complexityLabel,
          outcome: "hold",
          hoursDelta: null,
          completedOn: null,
          dueOn: dueDay,
        });
      }
      continue;
    }

    let outcome: DeadlineRow["outcome"] | "open" | "unscheduled" = "unscheduled";
    let hoursDelta: number | null = null;
    if (due && done && completedAt) {
      if (inRange(completedDay!, from, to)) {
        if (completedAt.getTime() < due.getTime()) {
          outcome = "beaten";
          hoursDelta = hoursBetween(due, completedAt);
        } else if (completedDay! <= dueDay!) {
          outcome = "met";
          hoursDelta = 0;
        } else {
          outcome = "missed";
          hoursDelta = -hoursBetween(completedAt, due);
        }
      }
    } else if (due && !done && dueDay && dueDay < today && inRange(dueDay, from, to)) {
      outcome = "missed";
      hoursDelta = -hoursBetween(now, due);
    }

    const countsAsFinished = done && completedDay != null && inRange(completedDay, from, to);
    if (countsAsFinished) {
      row.projectsCompleted += 1;
      const actual = projectHours.get(project.id) ?? 0;
      const quote = quoted.get(project.id) ?? null;
      const saved = quote == null ? 0 : Math.max(0, quote - actual);
      const exceeded = quote == null ? 0 : Math.max(0, actual - quote);
      row.actualHours += actual;
      if (quote != null) {
        row.quotedCount += 1;
        row.allocatedHours += quote;
        row.hoursSaved += saved;
        row.hoursExceeded += exceeded;
        row.points.saved += saved * PERFORMANCE_RULES.perHourSaved;
        row.points.exceeded += exceeded * PERFORMANCE_RULES.perHourExceeded;
      }
      let turnaround: number | null = null;
      if (project.startDate && completedAt) {
        const days = hoursBetween(completedAt, project.startDate) / 24;
        if (days >= 0) {
          turnaround = days;
          row.turnaroundSum += days;
          row.turnaroundSamples += 1;
        }
      }
      const stageBucket = row.stages.get(label) ?? blankBucket(label);
      const complexityBucket = row.complexities.get(complexityLabel) ?? blankBucket(complexityLabel);
      for (const bucket of [stageBucket, complexityBucket]) {
        bucket.count += 1;
        bucket.hoursSum += actual;
        bucket.actualHours += actual;
        if (turnaround != null) {
          bucket.turnaroundSum += turnaround;
          bucket.turnaroundSamples += 1;
        }
        if (quote != null) {
          bucket.quotedCount += 1;
          bucket.allocatedHours += quote;
          bucket.hoursSaved += saved;
          bucket.hoursExceeded += exceeded;
        }
      }
      row.stages.set(label, stageBucket);
      row.complexities.set(complexityLabel, complexityBucket);
    }

    if (outcome === "beaten" && hoursDelta != null) {
      row.deadlinesBeaten += 1;
      row.hoursBeaten += hoursDelta;
      row.points.beaten += PERFORMANCE_RULES.deadlineBeaten;
      row.points.early += Math.min(
        PERFORMANCE_RULES.earlyCapPerProject,
        Math.floor(hoursDelta / 24) * PERFORMANCE_RULES.perDayEarly
      );
    } else if (outcome === "met") {
      row.deadlinesMet += 1;
      row.points.met += PERFORMANCE_RULES.deadlineMet;
    } else if (outcome === "missed") {
      row.deadlinesMissed += 1;
      row.hoursOverdue += Math.abs(hoursDelta ?? 0);
      row.points.missed += PERFORMANCE_RULES.deadlineMissed;
    }

    if (outcome === "beaten" || outcome === "met" || outcome === "missed") {
      row.deadlines.push({
        projectId: project.id,
        name: project.name,
        clientName: project.client.name,
        stageLabel: label,
        complexityLabel,
        outcome,
        hoursDelta: hoursDelta == null ? null : round1(hoursDelta),
        completedOn: completedDay,
        dueOn: dueDay,
      });
    }
  }

  for (const submission of submissions) {
    const row = rows.get(submission.athleteId);
    if (!row) continue;
    const recordedDay = dayKey(submission.submissionDate);
    if (!inRange(recordedDay, from, to)) continue;
    if (scopedLogs && submission.lineItems.length === 0) continue;
    const gap = logGap(recordedDay, submission.createdAt, submission.isBackloggedSession);
    row.submittedDays.add(recordedDay);
    if (gap > 0) {
      row.logsBacklogged += 1;
      row.daysBacklogged += gap;
      row.points.backlog += gap * PERFORMANCE_RULES.perBacklogDay;
    } else {
      row.logsOnTime += 1;
      row.onTimeDays.add(recordedDay);
      row.points.onTime += PERFORMANCE_RULES.onTimeLog;
    }
  }

  if (!scopedLogs) {
    const yesterday = addDays(today, -1);
    for (const athlete of athletes) {
      const row = rows.get(athlete.id);
      if (!row) continue;
      const start = dayKey(athlete.blocharchStartDate);
      let cursor = from && from > start ? from : start;
      const end = to && to < yesterday ? to : yesterday;
      let guard = 0;
      while (cursor <= end && guard < 4000) {
        if (isWeekday(cursor) && !row.submittedDays.has(cursor)) {
          row.outstandingDays += 1;
          row.points.outstanding += PERFORMANCE_RULES.perOutstandingDay;
        }
        cursor = addDays(cursor, 1);
        guard += 1;
      }
    }
  }

  const complexityOrder = ["Low", "Medium", "High"];
  const result: AthletePerformanceRow[] = [];
  for (const athlete of athletes) {
    const row = rows.get(athlete.id)!;
    const worked = row.hoursWorked > 0 || row.projectsCompleted > 0 || row.logsOnTime + row.logsBacklogged > 0;
    if (athlete.status !== "active" && !worked) continue;

    const scored =
      row.deadlinesMet + row.deadlinesBeaten + row.deadlinesMissed;
    const expectedLogs = row.logsOnTime + row.logsBacklogged + row.outstandingDays;
    const points: PointsBreakdown = {
      beaten: Math.round(row.points.beaten),
      met: Math.round(row.points.met),
      saved: Math.round(row.points.saved),
      early: Math.round(row.points.early),
      onTime: Math.round(row.points.onTime),
      missed: Math.round(row.points.missed),
      exceeded: Math.round(row.points.exceeded),
      backlog: Math.round(row.points.backlog),
      outstanding: Math.round(row.points.outstanding),
    };
    const total = Object.values(points).reduce((sum, value) => sum + value, 0);
    const deadlines = row.deadlines
      .sort((a, b) => (b.completedOn ?? b.dueOn ?? "").localeCompare(a.completedOn ?? a.dueOn ?? ""))
      .slice(0, 40);
    const profile = athleteProfileVisual(athlete);
    result.push({
      athleteId: athlete.id,
      athleteName: athlete.fullName,
      athleteCode: athlete.athleteCode,
      status: athlete.status,
      ...profile,
      rank: 0,
      points: total,
      projectsCompleted: row.projectsCompleted,
      stagesCompleted: row.projectsCompleted,
      hoursWorked: row.hoursWorked,
      hoursSaved: round1(row.hoursSaved),
      hoursExceeded: round1(row.hoursExceeded),
      allocatedHours: row.quotedCount > 0 ? round1(row.allocatedHours) : null,
      actualHours: round1(row.actualHours),
      averageTurnaroundDays:
        row.turnaroundSamples > 0 ? round1(row.turnaroundSum / row.turnaroundSamples) : null,
      deadlinesMet: row.deadlinesMet,
      deadlinesBeaten: row.deadlinesBeaten,
      deadlinesMissed: row.deadlinesMissed,
      hoursBeaten: round1(row.hoursBeaten),
      hoursOverdue: round1(row.hoursOverdue),
      averageHoursBeaten:
        row.deadlinesBeaten > 0 ? round1(row.hoursBeaten / row.deadlinesBeaten) : null,
      deadlineSuccessRate: scored > 0 ? round1(((row.deadlinesMet + row.deadlinesBeaten) / scored) * 100) : null,
      holds: row.holds,
      logsOnTime: row.logsOnTime,
      logsBacklogged: row.logsBacklogged,
      outstandingDays: row.outstandingDays,
      daysBacklogged: row.daysBacklogged,
      logCompliance: expectedLogs > 0 ? round1((row.logsOnTime / expectedLogs) * 100) : null,
      streak: currentStreak(row.onTimeDays, today),
      pointsBreakdown: points,
      stages: Array.from(row.stages.values())
        .map(finishBucket)
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
      complexities: Array.from(row.complexities.values())
        .map(finishBucket)
        .sort((a, b) => complexityOrder.indexOf(a.label) - complexityOrder.indexOf(b.label)),
      deadlines,
      deadlinesTruncated: row.deadlines.length > deadlines.length,
    });
  }

  result.sort(
    (a, b) => b.points - a.points || b.hoursSaved - a.hoursSaved || a.athleteName.localeCompare(b.athleteName)
  );
  let rank = 0;
  let previous = "";
  result.forEach((athlete, index) => {
    const key = `${athlete.points}|${athlete.hoursSaved}`;
    if (key !== previous) {
      rank = index + 1;
      previous = key;
    }
    athlete.rank = rank;
  });

  return {
    filters: { clientId, stage, complexity, from, to, scopedLogs },
    rules: PERFORMANCE_RULES,
    athletes: result,
  };
}
