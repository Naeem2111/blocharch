import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type PhaseCompletionSample = {
  phase: string;
  totalHours: number;
  submissionId: string;
  projectId: string;
  completedOn: Date;
};

export type AverageHoursByPhase = {
  phase: string;
  averageHours: number;
  completionCount: number;
  totalHours: number;
};

function normalizePhase(phase: string): string {
  return phase === "existing_drawings" ? "survey_conversion" : phase;
}

type LineItemRow = {
  id: string;
  projectId: string;
  projectPhase: string;
  hoursWorked: { toNumber?: () => number } | number;
  completionPercent: number | null;
  createdAt: Date;
  submissionId: string;
  submission: { submissionDate: Date };
};

/** Build completion samples from ordered line items on one project + phase. */
export function phaseCompletionSamplesFromRows(items: LineItemRow[]): PhaseCompletionSample[] {
  const samples: PhaseCompletionSample[] = [];
  let running = 0;

  for (const item of items) {
    const hours =
      typeof item.hoursWorked === "number"
        ? item.hoursWorked
        : Number(item.hoursWorked?.toNumber?.() ?? item.hoursWorked);
    running += hours;

    const pct = item.completionPercent ?? 0;
    if (pct >= 100) {
      samples.push({
        phase: normalizePhase(item.projectPhase),
        totalHours: running,
        submissionId: item.submissionId,
        projectId: item.projectId,
        completedOn: item.submission.submissionDate,
      });
      running = 0;
    }
  }

  return samples;
}

export function averageHoursByPhaseFromSamples(
  samples: PhaseCompletionSample[]
): AverageHoursByPhase[] {
  const groups = new Map<string, number[]>();
  for (const s of samples) {
    const list = groups.get(s.phase) ?? [];
    list.push(s.totalHours);
    groups.set(s.phase, list);
  }

  return Array.from(groups.entries())
    .map(([phase, totals]) => {
      const completionCount = totals.length;
      const totalHours = totals.reduce((a, b) => a + b, 0);
      return {
        phase,
        averageHours: totalHours / completionCount,
        completionCount,
        totalHours,
      };
    })
    .sort((a, b) => b.averageHours - a.averageHours);
}

export type PhaseAverageQuery = {
  clientId?: string | null;
  athleteId?: string | null;
  from?: Date | null;
  to?: Date | null;
};

/** Average cumulative hours per completed phase submission (completionPercent ≥ 100). */
export async function buildAverageHoursByPhase(
  query: PhaseAverageQuery = {}
): Promise<AverageHoursByPhase[]> {
  const clientId = query.clientId?.trim() || null;
  const athleteId = query.athleteId?.trim() || null;

  const submissionWhere: Prisma.OpsDailySubmissionWhereInput = {};
  if (athleteId) submissionWhere.athleteId = athleteId;

  const where: Prisma.OpsSubmissionLineItemWhereInput = {
    projectId: { not: null },
    isHousekeeping: false,
    completionPercent: { gte: 100 },
    ...(clientId ? { clientId } : {}),
    submission: submissionWhere,
  };

  if (query.from || query.to) {
    submissionWhere.submissionDate = {
      ...(query.from ? { gte: query.from } : {}),
      ...(query.to ? { lte: query.to } : {}),
    };
  }

  const completionRows = await prisma.opsSubmissionLineItem.findMany({
    where,
    select: {
      id: true,
      projectId: true,
      projectPhase: true,
      submissionId: true,
      submission: { select: { submissionDate: true } },
    },
  });

  if (completionRows.length === 0) return [];

  const projectIds = Array.from(
    new Set(completionRows.map((r) => r.projectId).filter(Boolean) as string[])
  );

  const allRows = await prisma.opsSubmissionLineItem.findMany({
    where: {
      projectId: { in: projectIds },
      isHousekeeping: false,
      ...(clientId ? { clientId } : {}),
      submission: athleteId ? { athleteId } : {},
    },
    select: {
      id: true,
      projectId: true,
      projectPhase: true,
      hoursWorked: true,
      completionPercent: true,
      createdAt: true,
      submissionId: true,
      submission: { select: { submissionDate: true } },
    },
    orderBy: [{ submission: { submissionDate: "asc" } }, { createdAt: "asc" }],
  });

  const completionKeys = new Set(
    completionRows.map(
      (r) => `${r.projectId}:${normalizePhase(r.projectPhase)}:${r.submissionId}`
    )
  );

  const byProjectPhase = new Map<string, LineItemRow[]>();
  for (const row of allRows) {
    if (!row.projectId) continue;
    const key = `${row.projectId}:${normalizePhase(row.projectPhase)}`;
    const list = byProjectPhase.get(key) ?? [];
    list.push(row as LineItemRow);
    byProjectPhase.set(key, list);
  }

  const samples: PhaseCompletionSample[] = [];
  for (const group of Array.from(byProjectPhase.values())) {
    for (const sample of phaseCompletionSamplesFromRows(group)) {
      const key = `${sample.projectId}:${sample.phase}:${sample.submissionId}`;
      if (!completionKeys.has(key)) continue;
      if (query.from && sample.completedOn < query.from) continue;
      if (query.to && sample.completedOn > query.to) continue;
      samples.push(sample);
    }
  }

  return averageHoursByPhaseFromSamples(samples);
}
