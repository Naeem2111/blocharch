import { prisma } from "@/lib/prisma";
import {
  LANE_HOURS_WARNING,
  LANE_MONTHLY_HOURS,
  TASK_TYPE_LABELS,
  displayProjectStageLabel,
  laneIncludedHours,
} from "@/lib/ops-constants";
import { monthEndUtc, monthStartUtc } from "@/lib/ops-hours";
import type { OpsProjectPhase, OpsTaskType } from "@prisma/client";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function formatHours(n: number): string {
  const rounded = round2(n);
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export type ClientPortalOvertimeEntry = {
  id: string;
  date: string;
  projectName: string;
  taskLabel: string;
  hours: number;
  costGbp: number;
  laneNumber: number;
};

export type ClientPortalLaneHours = {
  laneNumber: number;
  laneLabel: string;
  athleteId: string;
  athleteName: string;
  hoursUsed: number;
  overtimeHours: number;
  hoursRemaining: number;
  warning: boolean;
  allowanceReached: boolean;
};

export type ClientPortalPhaseAverage = {
  phase: OpsProjectPhase;
  label: string;
  averageHours: number;
  packCount: number;
};

export type ClientPortalHours = {
  monthLabel: string;
  hoursUsed: number;
  includedHours: number;
  hoursRemaining: number;
  overtimeHours: number;
  overtimeRateGbp: number;
  overtimeCostGbp: number;
  lanes: ClientPortalLaneHours[];
  overtimeEntries: ClientPortalOvertimeEntry[];
};

function taskLabel(taskType: OpsTaskType, taskTypes: string[]): string {
  const types = taskTypes.length > 0 ? taskTypes : [taskType];
  return types
    .map((t) => (t in TASK_TYPE_LABELS ? TASK_TYPE_LABELS[t as OpsTaskType] : t))
    .join(", ");
}

export async function getClientPortalHours(input: {
  clientId: string;
  activeLaneCount: number;
  overtimeRateGbp: number;
  asOf?: Date;
}): Promise<ClientPortalHours> {
  const asOf = input.asOf ?? new Date();
  const from = monthStartUtc(asOf);
  const to = monthEndUtc(asOf);
  const overtimeRateGbp = Math.max(0, Number(input.overtimeRateGbp) || 0);
  const includedHours = laneIncludedHours(input.activeLaneCount);

  const items = await prisma.opsSubmissionLineItem.findMany({
    where: {
      clientId: input.clientId,
      isHousekeeping: false,
      submission: { submissionDate: { gte: from, lte: to } },
    },
    include: {
      submission: {
        select: {
          submissionDate: true,
          athlete: { select: { id: true, fullName: true, athleteCode: true } },
        },
      },
      project: { select: { name: true } },
    },
    orderBy: [{ createdAt: "asc" }],
  });

  items.sort((a, b) => {
    const da = a.submission.submissionDate.getTime();
    const db = b.submission.submissionDate.getTime();
    if (da !== db) return da - db;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  const athleteOrder: string[] = [];
  const byAthlete = new Map<
    string,
    { name: string; code: string; hours: number; items: typeof items }
  >();

  for (const item of items) {
    const athlete = item.submission.athlete;
    if (!byAthlete.has(athlete.id)) {
      athleteOrder.push(athlete.id);
      byAthlete.set(athlete.id, {
        name: athlete.fullName,
        code: athlete.athleteCode,
        hours: 0,
        items: [],
      });
    }
    const bucket = byAthlete.get(athlete.id)!;
    bucket.hours += Number(item.hoursWorked);
    bucket.items.push(item);
  }

  athleteOrder.sort((a, b) => {
    const aa = byAthlete.get(a)!;
    const bb = byAthlete.get(b)!;
    return (aa.code || aa.name).localeCompare(bb.code || bb.name);
  });

  const lanes: ClientPortalLaneHours[] = [];
  const overtimeEntries: ClientPortalOvertimeEntry[] = [];

  athleteOrder.forEach((athleteId, index) => {
    const bucket = byAthlete.get(athleteId)!;
    const hoursUsed = round2(bucket.hours);
    const overtimeHours = round2(Math.max(0, hoursUsed - LANE_MONTHLY_HOURS));
    const hoursRemaining = round2(Math.max(0, LANE_MONTHLY_HOURS - hoursUsed));
    const allowanceReached = hoursUsed >= LANE_MONTHLY_HOURS;
    const warning = !allowanceReached && hoursUsed >= LANE_HOURS_WARNING;
    const laneNumber = index + 1;

    lanes.push({
      laneNumber,
      laneLabel: `Lane ${laneNumber}`,
      athleteId,
      athleteName: bucket.name,
      hoursUsed,
      overtimeHours,
      hoursRemaining,
      warning,
      allowanceReached,
    });

    let running = 0;
    for (const item of bucket.items) {
      const h = Number(item.hoursWorked);
      running += h;
      const overtimeOnItem = round2(Math.max(0, Math.min(h, running - LANE_MONTHLY_HOURS)));
      if (overtimeOnItem <= 0) continue;
      overtimeEntries.push({
        id: item.id,
        date: item.submission.submissionDate.toISOString().slice(0, 10),
        projectName: item.project?.name ?? "Unassigned",
        taskLabel: taskLabel(item.taskType, item.taskTypes),
        hours: overtimeOnItem,
        costGbp: round2(overtimeOnItem * overtimeRateGbp),
        laneNumber,
      });
    }
  });

  const hoursUsed = round2(lanes.reduce((sum, lane) => sum + lane.hoursUsed, 0));
  const overtimeHours = round2(lanes.reduce((sum, lane) => sum + lane.overtimeHours, 0));

  return {
    monthLabel: asOf.toLocaleString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }),
    hoursUsed,
    includedHours,
    hoursRemaining: round2(Math.max(0, includedHours - hoursUsed)),
    overtimeHours,
    overtimeRateGbp,
    overtimeCostGbp: round2(overtimeHours * overtimeRateGbp),
    lanes,
    overtimeEntries,
  };
}

export async function getClientPortalPhaseAverages(
  completedProjects: Array<{ id: string; currentStage: OpsProjectPhase }>
): Promise<ClientPortalPhaseAverage[]> {
  const packs = completedProjects.filter((p) => p.currentStage !== "housekeeping_internal");
  if (packs.length === 0) return [];

  const rows = await prisma.opsSubmissionLineItem.groupBy({
    by: ["projectId"],
    where: { projectId: { in: packs.map((p) => p.id) }, isHousekeeping: false },
    _sum: { hoursWorked: true },
  });
  const hoursByProject = new Map(rows.map((r) => [r.projectId, Number(r._sum.hoursWorked ?? 0)]));

  const byPhase = new Map<OpsProjectPhase, { hours: number; count: number }>();
  for (const pack of packs) {
    const phase =
      pack.currentStage === "existing_drawings" ? "survey_conversion" : pack.currentStage;
    const current = byPhase.get(phase) ?? { hours: 0, count: 0 };
    current.hours += hoursByProject.get(pack.id) ?? 0;
    current.count += 1;
    byPhase.set(phase, current);
  }

  const order: OpsProjectPhase[] = [
    "survey_conversion",
    "proposed_drawings",
    "planning_submission",
    "tender_construction_pack",
    "construction",
  ];

  return order
    .filter((phase) => byPhase.has(phase))
    .map((phase) => {
      const row = byPhase.get(phase)!;
      return {
        phase,
        label: displayProjectStageLabel(phase),
        averageHours: round2(row.hours / row.count),
        packCount: row.count,
      };
    });
}

export function formatPortalHours(n: number): string {
  return formatHours(n);
}
