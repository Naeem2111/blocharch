import { prisma } from "@/lib/prisma";
import { computeMonthlyHoursSummary, monthEndUtc, monthStartUtc } from "@/lib/ops-hours";
import { getReportingRateOrDefault } from "@/lib/ops-exchange";
import { OPS_ALERT_THRESHOLDS, submissionEditCutoffUtc } from "@/lib/ops-alerts";

const STANDARD_MONTH_HOURS = 160;

export type CommercialLedgerRow = {
  athleteId: string;
  athleteName: string;
  athleteCode: string;
  clientId: string;
  clientName: string;
  hoursWorked: number;
  revenueGbp: number;
  athleteCostZar: number;
  athleteCostGbp: number;
  marginGbp: number;
  marginPercent: number;
};

export type CommercialSummary = {
  month: string;
  reportingRate: number;
  totalRevenueGbp: number;
  totalCostZar: number;
  totalCostGbp: number;
  grossMarginGbp: number;
  grossMarginPercent: number;
  rows: CommercialLedgerRow[];
  athleteTotals: Array<{
    athleteId: string;
    athleteName: string;
    hoursWorked: number;
    revenueGbp: number;
    costZar: number;
    costGbp: number;
    marginGbp: number;
  }>;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function dateOnlyUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export async function buildCommercialLedger(reference: Date): Promise<CommercialSummary> {
  const from = monthStartUtc(reference);
  const to = monthEndUtc(reference);
  const reportingRate = await getReportingRateOrDefault(reference);

  const lineItems = await prisma.opsSubmissionLineItem.findMany({
    where: {
      submission: {
        submissionDate: { gte: from, lte: to },
      },
    },
    include: {
      client: {
        include: { commercial: true },
      },
      submission: {
        include: { athlete: true },
      },
    },
  });

  const rowMap = new Map<string, CommercialLedgerRow>();

  for (const li of lineItems) {
    const athlete = li.submission.athlete;
    const client = li.client;
    const commercial = client.commercial;
    const laneCostGbp = commercial ? Number(commercial.laneCostGbp) : 0;
    const laneCount = commercial?.activeLaneCount ?? 1;
    const hourlyGbp = laneCostGbp / STANDARD_MONTH_HOURS;
    const hours = Number(li.hoursWorked);
    const revenueGbp = hours * hourlyGbp * laneCount;

    const key = `${athlete.id}:${client.id}`;
    const existing = rowMap.get(key);
    if (existing) {
      existing.hoursWorked += hours;
      existing.revenueGbp += revenueGbp;
    } else {
      rowMap.set(key, {
        athleteId: athlete.id,
        athleteName: athlete.fullName,
        athleteCode: athlete.athleteCode,
        clientId: client.id,
        clientName: client.name,
        hoursWorked: hours,
        revenueGbp,
        athleteCostZar: 0,
        athleteCostGbp: 0,
        marginGbp: 0,
        marginPercent: 0,
      });
    }
  }

  const athletes = await prisma.opsAthlete.findMany({ where: { status: "active" } });
  const athleteCostMap = new Map<string, { costZar: number; costGbp: number }>();

  for (const athlete of athletes) {
    const monthHoursAgg = await prisma.opsDailySubmission.aggregate({
      where: { athleteId: athlete.id, submissionDate: { gte: from, lte: to } },
      _sum: { totalHours: true },
    });
    const monthHours = Number(monthHoursAgg._sum.totalHours ?? 0);
    const summary = computeMonthlyHoursSummary({
      monthHours,
      monthlyHourCap: athlete.monthlyHourCap,
      baseMonthlyPayZar: Number(athlete.baseMonthlyPayZar),
      overtimeRateZar: Number(athlete.overtimeRateZar),
    });
    athleteCostMap.set(athlete.id, {
      costZar: summary.totalEarningsZar,
      costGbp: round2(summary.totalEarningsZar / reportingRate),
    });
  }

  const rows = Array.from(rowMap.values());
  const athleteHoursTotal = new Map<string, number>();
  for (const row of rows) {
    athleteHoursTotal.set(row.athleteId, (athleteHoursTotal.get(row.athleteId) ?? 0) + row.hoursWorked);
  }

  for (const row of rows) {
    const athleteTotalHours = athleteHoursTotal.get(row.athleteId) ?? 0;
    const athleteCost = athleteCostMap.get(row.athleteId);
    if (athleteCost && athleteTotalHours > 0) {
      const share = row.hoursWorked / athleteTotalHours;
      row.athleteCostZar = round2(athleteCost.costZar * share);
      row.athleteCostGbp = round2(athleteCost.costGbp * share);
    }
    row.revenueGbp = round2(row.revenueGbp);
    row.hoursWorked = round2(row.hoursWorked);
    row.marginGbp = round2(row.revenueGbp - row.athleteCostGbp);
    row.marginPercent = row.revenueGbp > 0 ? round2((row.marginGbp / row.revenueGbp) * 100) : 0;
  }

  rows.sort((a, b) => a.athleteName.localeCompare(b.athleteName) || a.clientName.localeCompare(b.clientName));

  const athleteTotalsMap = new Map<
    string,
    { athleteId: string; athleteName: string; hoursWorked: number; revenueGbp: number; costZar: number; costGbp: number; marginGbp: number }
  >();

  for (const row of rows) {
    const t = athleteTotalsMap.get(row.athleteId);
    if (t) {
      t.hoursWorked += row.hoursWorked;
      t.revenueGbp += row.revenueGbp;
      t.costZar += row.athleteCostZar;
      t.costGbp += row.athleteCostGbp;
      t.marginGbp += row.marginGbp;
    } else {
      athleteTotalsMap.set(row.athleteId, {
        athleteId: row.athleteId,
        athleteName: row.athleteName,
        hoursWorked: row.hoursWorked,
        revenueGbp: row.revenueGbp,
        costZar: row.athleteCostZar,
        costGbp: row.athleteCostGbp,
        marginGbp: row.marginGbp,
      });
    }
  }

  const athleteTotals = Array.from(athleteTotalsMap.values()).map((t) => ({
    ...t,
    hoursWorked: round2(t.hoursWorked),
    revenueGbp: round2(t.revenueGbp),
    costZar: round2(t.costZar),
    costGbp: round2(t.costGbp),
    marginGbp: round2(t.marginGbp),
  }));

  const totalRevenueGbp = round2(rows.reduce((s, r) => s + r.revenueGbp, 0));
  const totalCostZar = round2(Array.from(athleteCostMap.values()).reduce((s, c) => s + c.costZar, 0));
  const totalCostGbp = round2(totalCostZar / reportingRate);
  const grossMarginGbp = round2(totalRevenueGbp - totalCostGbp);

  return {
    month: from.toISOString().slice(0, 7),
    reportingRate,
    totalRevenueGbp,
    totalCostZar,
    totalCostGbp,
    grossMarginGbp,
    grossMarginPercent: totalRevenueGbp > 0 ? round2((grossMarginGbp / totalRevenueGbp) * 100) : 0,
    rows,
    athleteTotals,
  };
}

export type AnalyticsPayload = {
  month: string;
  hoursByPhase: Array<{ phase: string; hours: number }>;
  hoursByClient: Array<{ clientId: string; clientName: string; hours: number }>;
  hoursByAthlete: Array<{ athleteId: string; athleteName: string; hours: number }>;
  dueDateRisk: Array<{
    id: string;
    name: string;
    clientName: string;
    dueDate: string;
    daysUntilDue: number;
    currentStatus: string;
    assignedAthleteName: string | null;
  }>;
  profitabilityByClient: Array<{
    clientId: string;
    clientName: string;
    revenueGbp: number;
    costGbp: number;
    marginGbp: number;
    marginPercent: number;
  }>;
};

export async function buildAnalytics(reference: Date): Promise<AnalyticsPayload> {
  const from = monthStartUtc(reference);
  const to = monthEndUtc(reference);
  const ledger = await buildCommercialLedger(reference);

  const lineItems = await prisma.opsSubmissionLineItem.findMany({
    where: { submission: { submissionDate: { gte: from, lte: to } } },
    include: {
      submission: { include: { athlete: true } },
      client: { select: { id: true, name: true } },
    },
  });

  const phaseMap = new Map<string, number>();
  const clientHoursMap = new Map<string, { name: string; hours: number }>();
  const athleteHoursMap = new Map<string, { name: string; hours: number }>();

  for (const li of lineItems) {
    const hours = Number(li.hoursWorked);
    phaseMap.set(li.projectPhase, (phaseMap.get(li.projectPhase) ?? 0) + hours);

    const ch = clientHoursMap.get(li.clientId);
    if (ch) ch.hours += hours;
    else clientHoursMap.set(li.clientId, { name: li.client.name, hours });

    const ah = athleteHoursMap.get(li.submission.athleteId);
    if (ah) ah.hours += hours;
    else
      athleteHoursMap.set(li.submission.athleteId, {
        name: li.submission.athlete.fullName,
        hours,
      });
  }

  const now = dateOnlyUtc(new Date());
  const riskProjects = await prisma.opsProject.findMany({
    where: {
      dueDate: { not: null, lte: new Date(now.getTime() + 14 * 86400000) },
      currentStatus: { notIn: ["completed", "handed_over"] },
    },
    include: {
      client: { select: { name: true } },
      assignedAthlete: { select: { fullName: true } },
    },
    orderBy: { dueDate: "asc" },
    take: 20,
  });

  const clientProfitMap = new Map<string, { clientName: string; revenueGbp: number; costGbp: number }>();
  for (const row of ledger.rows) {
    const cp = clientProfitMap.get(row.clientId);
    if (cp) {
      cp.revenueGbp += row.revenueGbp;
      cp.costGbp += row.athleteCostGbp;
    } else {
      clientProfitMap.set(row.clientId, {
        clientName: row.clientName,
        revenueGbp: row.revenueGbp,
        costGbp: row.athleteCostGbp,
      });
    }
  }

  return {
    month: from.toISOString().slice(0, 7),
    hoursByPhase: Array.from(phaseMap.entries())
      .map(([phase, hours]) => ({ phase, hours: round2(hours) }))
      .sort((a, b) => b.hours - a.hours),
    hoursByClient: Array.from(clientHoursMap.entries())
      .map(([clientId, v]) => ({ clientId, clientName: v.name, hours: round2(v.hours) }))
      .sort((a, b) => b.hours - a.hours),
    hoursByAthlete: Array.from(athleteHoursMap.entries())
      .map(([athleteId, v]) => ({ athleteId, athleteName: v.name, hours: round2(v.hours) }))
      .sort((a, b) => b.hours - a.hours),
    dueDateRisk: riskProjects.map((p) => {
      const due = p.dueDate!;
      const daysUntilDue = Math.ceil((due.getTime() - now.getTime()) / 86400000);
      return {
        id: p.id,
        name: p.name,
        clientName: p.client.name,
        dueDate: due.toISOString().slice(0, 10),
        daysUntilDue,
        currentStatus: p.currentStatus,
        assignedAthleteName: p.assignedAthlete?.fullName ?? null,
      };
    }),
    profitabilityByClient: Array.from(clientProfitMap.entries())
      .map(([clientId, v]) => {
        const marginGbp = round2(v.revenueGbp - v.costGbp);
        return {
          clientId,
          clientName: v.clientName,
          revenueGbp: round2(v.revenueGbp),
          costGbp: round2(v.costGbp),
          marginGbp,
          marginPercent: v.revenueGbp > 0 ? round2((marginGbp / v.revenueGbp) * 100) : 0,
        };
      })
      .sort((a, b) => b.marginGbp - a.marginGbp),
  };
}

export async function buildOpsOverview(reference: Date) {
  const from = monthStartUtc(reference);
  const to = monthEndUtc(reference);
  const ledger = await buildCommercialLedger(reference);

  const [activeAthletes, activeProjects, openBlockers, checkInRequests, dailySubmissions] = await Promise.all([
    prisma.opsAthlete.count({ where: { status: "active" } }),
    prisma.opsProject.count({
      where: { currentStatus: { notIn: ["completed", "handed_over"] } },
    }),
    prisma.opsProject.count({ where: { blockerFlag: true } }),
    prisma.opsProject.count({ where: { checkInRequested: true } }),
    prisma.opsDailySubmission.findMany({
      where: { submissionDate: { gte: from, lte: to } },
      select: { totalHours: true },
    }),
  ]);

  let daily12Count = 0;
  let daily14Count = 0;
  for (const s of dailySubmissions) {
    const h = Number(s.totalHours);
    if (h >= OPS_ALERT_THRESHOLDS.dailyCriticalHours) daily14Count++;
    else if (h >= OPS_ALERT_THRESHOLDS.dailyWarningHours) daily12Count++;
  }

  const athletes = await prisma.opsAthlete.findMany({ where: { status: "active" } });
  let capExceededCount = 0;
  for (const a of athletes) {
    const agg = await prisma.opsDailySubmission.aggregate({
      where: { athleteId: a.id, submissionDate: { gte: from, lte: to } },
      _sum: { totalHours: true },
    });
    if (Number(agg._sum.totalHours ?? 0) > a.monthlyHourCap) capExceededCount++;
  }

  return {
    activeAthletes,
    activeProjects,
    openBlockers,
    checkInRequests,
    monthlyRevenueGbp: ledger.totalRevenueGbp,
    grossMarginGbp: ledger.grossMarginGbp,
    grossMarginPercent: ledger.grossMarginPercent,
    alertCounts: { daily12Count, daily14Count, capExceededCount },
  };
}

export async function lockStaleSubmissions(athleteId?: string) {
  const cutoff = submissionEditCutoffUtc();
  await prisma.opsDailySubmission.updateMany({
    where: {
      ...(athleteId ? { athleteId } : {}),
      lockedAt: null,
      submissionDate: { lt: cutoff },
    },
    data: { lockedAt: new Date() },
  });
}
