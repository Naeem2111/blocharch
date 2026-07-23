import type { Prisma } from "@prisma/client";
import { athleteProfileVisual } from "@/lib/athlete-profile-visual";
import { prisma } from "@/lib/prisma";
import {
  LANE_MONTHLY_HOURS,
  laneIncludedHours,
  monthlyLaneRevenueGbp,
} from "@/lib/ops-constants";
import { computeMonthlyHoursSummary, monthEndUtc, monthStartUtc } from "@/lib/ops-hours";
import { getCostConversionSnapshot } from "@/lib/ops-exchange";
import { OPS_ALERT_THRESHOLDS } from "@/lib/ops-alerts";
import { countPendingCheckInRequests } from "@/lib/check-in-admin";
import { buildBeatenDeadlines, type BeatenDeadlinesByAthlete } from "@/lib/analytics-deadlines";
import { buildAverageHoursByPhase } from "@/lib/phase-average-hours";
import { formatProjectDueAt } from "@/lib/project-deadline";
import { listReportingAthletes, monthSubmissionHoursByAthlete } from "@/lib/reporting-athletes";

export { LANE_MONTHLY_HOURS };

export type ClientLaneCommercialRow = {
  clientId: string;
  clientName: string;
  clientLogoUrl: string | null;
  clientLogoBgColor: string | null;
  clientLogoTextTone: string | null;
  clientStatus: string;
  pricingTier: string;
  laneCostGbp: number;
  activeLaneCount: number;
  /** Fixed monthly fee: lane cost × number of lanes (active clients only). */
  monthlyLaneRevenueGbp: number;
  includedHours: number;
  /** Hours logged on projects this month (lane utilization). */
  hoursUsed: number;
  utilizationPercent: number;
  overtimeHours: number;
  overtimeRevenueGbp: number;
  totalClientRevenueGbp: number;
  projectCount: number;
};

export type CommercialLedgerRow = {
  athleteId: string;
  athleteName: string;
  athleteCode: string;
  profilePhotoUrl: string | null;
  profilePhotoBgColor: string | null;
  profilePhotoTextTone: string | null;
  clientId: string;
  clientName: string;
  clientLogoUrl: string | null;
  clientLogoBgColor: string | null;
  clientLogoTextTone: string | null;
  /** Hours on this client's projects (usage tracking). */
  hoursWorked: number;
  /** Share of client lane + overtime revenue attributed by hours. */
  revenueGbp: number;
  athleteCostZar: number;
  athleteCostGbp: number;
  marginGbp: number;
  marginPercent: number;
};

export type CommercialSummary = {
  month: string;
  reportingRate: number;
  appliedRate: number;
  costConversionMode: "manual" | "live";
  liveRate: number | null;
  totalRevenueGbp: number;
  totalLaneRevenueGbp: number;
  totalOvertimeRevenueGbp: number;
  totalCostZar: number;
  totalCostGbp: number;
  totalLaneCostGbp: number;
  totalOvertimeCostGbp: number;
  grossMarginGbp: number;
  grossMarginPercent: number;
  /** Per-client lane billing — present as soon as client + lanes exist. */
  clientLanes: ClientLaneCommercialRow[];
  /** Per-athlete utilization on each client (from daily log / projects). */
  rows: CommercialLedgerRow[];
  athleteTotals: Array<{
    athleteId: string;
    athleteName: string;
    profilePhotoUrl: string | null;
    profilePhotoBgColor: string | null;
    profilePhotoTextTone: string | null;
    hoursWorked: number;
    overtimeHours: number;
    revenueGbp: number;
    basePayGbp: number;
    overtimePayGbp: number;
    costZar: number;
    costGbp: number;
    marginGbp: number;
  }>;
  clientFilter?: string | null;
};

export function filterCommercialLedgerByClient(
  ledger: CommercialSummary,
  clientId: string
): CommercialSummary {
  const clientLanes = ledger.clientLanes.filter((l) => l.clientId === clientId);
  const rows = ledger.rows.filter((r) => r.clientId === clientId);
  const fullTotalsByAthlete = new Map(ledger.athleteTotals.map((a) => [a.athleteId, a]));

  const athleteAgg = new Map<
    string,
    {
      athleteId: string;
      athleteName: string;
      hoursWorked: number;
      revenueGbp: number;
      costGbp: number;
      marginGbp: number;
    }
  >();

  for (const row of rows) {
    const t = athleteAgg.get(row.athleteId);
    if (t) {
      t.hoursWorked += row.hoursWorked;
      t.revenueGbp += row.revenueGbp;
      t.costGbp += row.athleteCostGbp;
      t.marginGbp += row.marginGbp;
    } else {
      athleteAgg.set(row.athleteId, {
        athleteId: row.athleteId,
        athleteName: row.athleteName,
        hoursWorked: row.hoursWorked,
        revenueGbp: row.revenueGbp,
        costGbp: row.athleteCostGbp,
        marginGbp: row.marginGbp,
      });
    }
  }

  const athleteTotals = Array.from(athleteAgg.values()).map((t) => {
    const full = fullTotalsByAthlete.get(t.athleteId);
    const share = full && full.costGbp > 0 ? t.costGbp / full.costGbp : 1;
    return {
      athleteId: t.athleteId,
      athleteName: t.athleteName,
      profilePhotoUrl: full?.profilePhotoUrl ?? null,
      profilePhotoBgColor: full?.profilePhotoBgColor ?? null,
      profilePhotoTextTone: full?.profilePhotoTextTone ?? null,
      hoursWorked: round2(t.hoursWorked),
      overtimeHours: round2((full?.overtimeHours ?? 0) * share),
      revenueGbp: round2(t.revenueGbp),
      basePayGbp: round2((full?.basePayGbp ?? t.costGbp) * share),
      overtimePayGbp: round2((full?.overtimePayGbp ?? 0) * share),
      costZar: round2((full?.costZar ?? 0) * share),
      costGbp: round2(t.costGbp),
      marginGbp: round2(t.marginGbp),
    };
  });

  const totalLaneRevenueGbp = round2(clientLanes.reduce((s, c) => s + c.monthlyLaneRevenueGbp, 0));
  const totalOvertimeRevenueGbp = round2(clientLanes.reduce((s, c) => s + c.overtimeRevenueGbp, 0));
  const totalRevenueGbp = round2(clientLanes.reduce((s, c) => s + c.totalClientRevenueGbp, 0));
  const totalCostGbp = round2(athleteTotals.reduce((s, a) => s + a.costGbp, 0));
  const totalCostZar = round2(athleteTotals.reduce((s, a) => s + a.costZar, 0));
  const totalLaneCostGbp = round2(athleteTotals.reduce((s, a) => s + a.basePayGbp, 0));
  const totalOvertimeCostGbp = round2(athleteTotals.reduce((s, a) => s + a.overtimePayGbp, 0));
  const grossMarginGbp = round2(totalRevenueGbp - totalCostGbp);

  return {
    ...ledger,
    clientFilter: clientId,
    totalRevenueGbp,
    totalLaneRevenueGbp,
    totalOvertimeRevenueGbp,
    totalCostZar,
    totalCostGbp,
    totalLaneCostGbp,
    totalOvertimeCostGbp,
    grossMarginGbp,
    grossMarginPercent: totalRevenueGbp > 0 ? round2((grossMarginGbp / totalRevenueGbp) * 100) : 0,
    clientLanes,
    rows,
    athleteTotals,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function dateOnlyUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export async function buildCommercialLedger(reference: Date): Promise<CommercialSummary> {
  const from = monthStartUtc(reference);
  const to = monthEndUtc(reference);
  const { appliedRate, reportingRate, mode, liveRate } = await getCostConversionSnapshot(reference);

  const [clients, lineItems, athletes] = await Promise.all([
    prisma.opsClient.findMany({
      include: {
        commercial: true,
        _count: { select: { projects: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.opsSubmissionLineItem.findMany({
      where: {
        submission: {
          submissionDate: { gte: from, lte: to },
        },
      },
      include: {
        client: { include: { commercial: true } },
        submission: { include: { athlete: true } },
      },
    }),
    listReportingAthletes({ status: "active" }),
  ]);

  const hoursByClient = new Map<string, number>();
  const hoursByAthleteClient = new Map<string, number>();
  const athleteClientMeta = new Map<
    string,
    { athlete: (typeof lineItems)[0]["submission"]["athlete"]; client: (typeof lineItems)[0]["client"] }
  >();

  for (const li of lineItems) {
    const hours = Number(li.hoursWorked);
    hoursByClient.set(li.clientId, (hoursByClient.get(li.clientId) ?? 0) + hours);
    const key = `${li.submission.athlete.id}:${li.clientId}`;
    hoursByAthleteClient.set(key, (hoursByAthleteClient.get(key) ?? 0) + hours);
    if (!athleteClientMeta.has(key)) {
      athleteClientMeta.set(key, { athlete: li.submission.athlete, client: li.client });
    }
  }

  const clientLanes: ClientLaneCommercialRow[] = [];
  const clientRevenueTotal = new Map<string, number>();

  for (const client of clients) {
    const commercial = client.commercial;
    if (!commercial) continue;

    const laneCostGbp = Number(commercial.laneCostGbp);
    const activeLaneCount = commercial.activeLaneCount;
    const includedHours = laneIncludedHours(activeLaneCount);
    const hoursUsed = round2(hoursByClient.get(client.id) ?? 0);
    const utilizationPercent =
      includedHours > 0 ? round2(Math.min(100, (hoursUsed / includedHours) * 100)) : 0;

    const overtimeHours =
      client.status === "active" ? round2(Math.max(0, hoursUsed - includedHours)) : 0;
    const overtimeBillingGbp = Number(commercial.overtimeBillingGbp);
    const overtimeRevenueGbp = round2(overtimeHours * overtimeBillingGbp);

    const monthlyLaneRevenue =
      client.status === "active" ? round2(monthlyLaneRevenueGbp(laneCostGbp, activeLaneCount)) : 0;
    const totalClientRevenueGbp = round2(monthlyLaneRevenue + overtimeRevenueGbp);

    clientRevenueTotal.set(client.id, totalClientRevenueGbp);

    clientLanes.push({
      clientId: client.id,
      clientName: client.name,
      clientLogoUrl: client.logoUrl,
      clientLogoBgColor: client.logoBgColor,
      clientLogoTextTone: client.logoTextTone,
      clientStatus: client.status,
      pricingTier: commercial.pricingTier,
      laneCostGbp,
      activeLaneCount,
      monthlyLaneRevenueGbp: monthlyLaneRevenue,
      includedHours,
      hoursUsed,
      utilizationPercent,
      overtimeHours,
      overtimeRevenueGbp,
      totalClientRevenueGbp,
      projectCount: client._count.projects,
    });
  }

  const rowMap = new Map<string, CommercialLedgerRow>();

  for (const [key, hoursWorked] of Array.from(hoursByAthleteClient.entries())) {
    const meta = athleteClientMeta.get(key);
    if (!meta) continue;
    const { athlete, client } = meta;
    const clientId = client.id;
    const totalHoursOnClient = hoursByClient.get(clientId) ?? 0;
    const clientRevenue = clientRevenueTotal.get(clientId) ?? 0;
    const revenueGbp =
      totalHoursOnClient > 0 ? round2((hoursWorked / totalHoursOnClient) * clientRevenue) : 0;

    rowMap.set(key, {
      athleteId: athlete.id,
      athleteName: athlete.fullName,
      athleteCode: athlete.athleteCode,
      ...athleteProfileVisual(athlete),
      clientId: client.id,
      clientName: client.name,
      clientLogoUrl: client.logoUrl,
      clientLogoBgColor: client.logoBgColor,
      clientLogoTextTone: client.logoTextTone,
      hoursWorked: round2(hoursWorked),
      revenueGbp,
      athleteCostZar: 0,
      athleteCostGbp: 0,
      marginGbp: 0,
      marginPercent: 0,
    });
  }

  const athleteCostMap = new Map<
    string,
    {
      costZar: number;
      costGbp: number;
      baseCostGbp: number;
      overtimeCostGbp: number;
      monthHours: number;
      monthOvertimeHours: number;
    }
  >();

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
      costGbp: round2(summary.totalEarningsZar / appliedRate),
      baseCostGbp: round2(summary.baseEarningsZar / appliedRate),
      overtimeCostGbp: round2(summary.overtimeEarningsZar / appliedRate),
      monthHours: summary.monthHours,
      monthOvertimeHours: summary.monthOvertimeHours,
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
    row.marginGbp = round2(row.revenueGbp - row.athleteCostGbp);
    row.marginPercent = row.revenueGbp > 0 ? round2((row.marginGbp / row.revenueGbp) * 100) : 0;
  }

  rows.sort((a, b) => a.athleteName.localeCompare(b.athleteName) || a.clientName.localeCompare(b.clientName));

  const athleteTotalsMap = new Map<
    string,
    {
      athleteId: string;
      athleteName: string;
      profilePhotoUrl: string | null;
      profilePhotoBgColor: string | null;
      profilePhotoTextTone: string | null;
      hoursWorked: number;
      revenueGbp: number;
      marginGbp: number;
    }
  >();

  for (const row of rows) {
    const t = athleteTotalsMap.get(row.athleteId);
    if (t) {
      t.hoursWorked += row.hoursWorked;
      t.revenueGbp += row.revenueGbp;
      t.marginGbp += row.marginGbp;
    } else {
      athleteTotalsMap.set(row.athleteId, {
        athleteId: row.athleteId,
        athleteName: row.athleteName,
        profilePhotoUrl: row.profilePhotoUrl,
        profilePhotoBgColor: row.profilePhotoBgColor,
        profilePhotoTextTone: row.profilePhotoTextTone,
        hoursWorked: row.hoursWorked,
        revenueGbp: row.revenueGbp,
        marginGbp: row.marginGbp,
      });
    }
  }

  for (const athlete of athletes) {
    if (athleteTotalsMap.has(athlete.id)) continue;
    const cost = athleteCostMap.get(athlete.id);
    const monthHours = cost?.monthHours ?? 0;
    if (monthHours <= 0) continue;
    const profile = athleteProfileVisual(athlete);
    athleteTotalsMap.set(athlete.id, {
      athleteId: athlete.id,
      athleteName: athlete.fullName,
      ...profile,
      hoursWorked: monthHours,
      revenueGbp: 0,
      marginGbp: round2(0 - (cost?.costGbp ?? 0)),
    });
  }

  const athleteTotals = Array.from(athleteTotalsMap.values()).map((t) => {
    const cost = athleteCostMap.get(t.athleteId);
    const costGbp = cost?.costGbp ?? 0;
    return {
      athleteId: t.athleteId,
      athleteName: t.athleteName,
      profilePhotoUrl: t.profilePhotoUrl,
      profilePhotoBgColor: t.profilePhotoBgColor,
      profilePhotoTextTone: t.profilePhotoTextTone,
      hoursWorked: round2(t.hoursWorked),
      overtimeHours: round2(cost?.monthOvertimeHours ?? 0),
      revenueGbp: round2(t.revenueGbp),
      basePayGbp: round2(cost?.baseCostGbp ?? 0),
      overtimePayGbp: round2(cost?.overtimeCostGbp ?? 0),
      costZar: round2(cost?.costZar ?? 0),
      costGbp: round2(costGbp),
      marginGbp: round2(t.revenueGbp - costGbp),
    };
  });

  const totalLaneRevenueGbp = round2(
    clientLanes.reduce((s, c) => s + c.monthlyLaneRevenueGbp, 0)
  );
  const totalOvertimeRevenueGbp = round2(
    clientLanes.reduce((s, c) => s + c.overtimeRevenueGbp, 0)
  );
  const totalRevenueGbp = round2(
    clientLanes.reduce((s, c) => s + c.totalClientRevenueGbp, 0)
  );
  const totalCostZar = round2(Array.from(athleteCostMap.values()).reduce((s, c) => s + c.costZar, 0));
  const totalCostGbp = round2(totalCostZar / appliedRate);
  const totalLaneCostGbp = round2(
    Array.from(athleteCostMap.values()).reduce((s, c) => s + c.baseCostGbp, 0)
  );
  const totalOvertimeCostGbp = round2(
    Array.from(athleteCostMap.values()).reduce((s, c) => s + c.overtimeCostGbp, 0)
  );
  const grossMarginGbp = round2(totalRevenueGbp - totalCostGbp);

  return {
    month: from.toISOString().slice(0, 7),
    reportingRate,
    appliedRate,
    costConversionMode: mode,
    liveRate,
    totalRevenueGbp,
    totalLaneRevenueGbp,
    totalOvertimeRevenueGbp,
    totalCostZar,
    totalCostGbp,
    totalLaneCostGbp,
    totalOvertimeCostGbp,
    grossMarginGbp,
    grossMarginPercent: totalRevenueGbp > 0 ? round2((grossMarginGbp / totalRevenueGbp) * 100) : 0,
    clientLanes,
    rows,
    athleteTotals,
  };
}

function mergeCommercialSummaries(base: CommercialSummary, add: CommercialSummary): CommercialSummary {
  const rowMap = new Map(
    base.rows.map((row) => [`${row.athleteId}:${row.clientId}`, { ...row }])
  );
  for (const row of add.rows) {
    const key = `${row.athleteId}:${row.clientId}`;
    const existing = rowMap.get(key);
    if (existing) {
      existing.hoursWorked = round2(existing.hoursWorked + row.hoursWorked);
      existing.revenueGbp = round2(existing.revenueGbp + row.revenueGbp);
      existing.athleteCostZar = round2(existing.athleteCostZar + row.athleteCostZar);
      existing.athleteCostGbp = round2(existing.athleteCostGbp + row.athleteCostGbp);
      existing.marginGbp = round2(existing.revenueGbp - existing.athleteCostGbp);
      existing.marginPercent =
        existing.revenueGbp > 0 ? round2((existing.marginGbp / existing.revenueGbp) * 100) : 0;
    } else {
      rowMap.set(key, { ...row });
    }
  }

  const laneMap = new Map(base.clientLanes.map((lane) => [lane.clientId, { ...lane }]));
  for (const lane of add.clientLanes) {
    const existing = laneMap.get(lane.clientId);
    if (existing) {
      existing.hoursUsed = round2(existing.hoursUsed + lane.hoursUsed);
      existing.overtimeHours = round2(existing.overtimeHours + lane.overtimeHours);
      existing.overtimeRevenueGbp = round2(existing.overtimeRevenueGbp + lane.overtimeRevenueGbp);
      existing.monthlyLaneRevenueGbp = round2(existing.monthlyLaneRevenueGbp + lane.monthlyLaneRevenueGbp);
      existing.totalClientRevenueGbp = round2(existing.totalClientRevenueGbp + lane.totalClientRevenueGbp);
      existing.utilizationPercent =
        existing.includedHours > 0
          ? round2(Math.min(100, (existing.hoursUsed / existing.includedHours) * 100))
          : 0;
    } else {
      laneMap.set(lane.clientId, { ...lane });
    }
  }

  const athleteMap = new Map(base.athleteTotals.map((a) => [a.athleteId, { ...a }]));
  for (const athlete of add.athleteTotals) {
    const existing = athleteMap.get(athlete.athleteId);
    if (existing) {
      existing.hoursWorked = round2(existing.hoursWorked + athlete.hoursWorked);
      existing.overtimeHours = round2(existing.overtimeHours + athlete.overtimeHours);
      existing.revenueGbp = round2(existing.revenueGbp + athlete.revenueGbp);
      existing.basePayGbp = round2(existing.basePayGbp + athlete.basePayGbp);
      existing.overtimePayGbp = round2(existing.overtimePayGbp + athlete.overtimePayGbp);
      existing.costZar = round2(existing.costZar + athlete.costZar);
      existing.costGbp = round2(existing.costGbp + athlete.costGbp);
      existing.marginGbp = round2(existing.revenueGbp - existing.costGbp);
    } else {
      athleteMap.set(athlete.athleteId, { ...athlete });
    }
  }

  return {
    month: "all",
    reportingRate: add.reportingRate,
    appliedRate: add.appliedRate,
    costConversionMode: add.costConversionMode,
    liveRate: add.liveRate,
    totalRevenueGbp: round2(base.totalRevenueGbp + add.totalRevenueGbp),
    totalLaneRevenueGbp: round2(base.totalLaneRevenueGbp + add.totalLaneRevenueGbp),
    totalOvertimeRevenueGbp: round2(base.totalOvertimeRevenueGbp + add.totalOvertimeRevenueGbp),
    totalCostZar: round2(base.totalCostZar + add.totalCostZar),
    totalCostGbp: round2(base.totalCostGbp + add.totalCostGbp),
    totalLaneCostGbp: round2(base.totalLaneCostGbp + add.totalLaneCostGbp),
    totalOvertimeCostGbp: round2(base.totalOvertimeCostGbp + add.totalOvertimeCostGbp),
    grossMarginGbp: round2(base.grossMarginGbp + add.grossMarginGbp),
    grossMarginPercent:
      base.totalRevenueGbp + add.totalRevenueGbp > 0
        ? round2(
            ((base.grossMarginGbp + add.grossMarginGbp) /
              (base.totalRevenueGbp + add.totalRevenueGbp)) *
              100
          )
        : 0,
    clientLanes: Array.from(laneMap.values()).sort((a, b) => a.clientName.localeCompare(b.clientName)),
    rows: Array.from(rowMap.values()).sort(
      (a, b) => a.athleteName.localeCompare(b.athleteName) || a.clientName.localeCompare(b.clientName)
    ),
    athleteTotals: Array.from(athleteMap.values()).sort((a, b) =>
      a.athleteName.localeCompare(b.athleteName)
    ),
  };
}

async function analyticsEarliestMonth(): Promise<Date | null> {
  const first = await prisma.opsDailySubmission.findFirst({
    orderBy: { submissionDate: "asc" },
    select: { submissionDate: true },
  });
  return first ? monthStartUtc(first.submissionDate) : null;
}

/** Cumulative commercial ledger from first logged work through today. */
export async function buildCommercialLedgerAllTime(): Promise<CommercialSummary> {
  const start = await analyticsEarliestMonth();
  if (!start) return buildCommercialLedger(new Date());

  let cursor = start;
  const end = monthEndUtc(new Date());
  let merged: CommercialSummary | null = null;

  while (cursor.getTime() <= end.getTime()) {
    const ledger = await buildCommercialLedger(cursor);
    merged = merged ? mergeCommercialSummaries(merged, ledger) : { ...ledger, month: "all" };
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
  }

  return merged ?? buildCommercialLedger(new Date());
}

export type AnalyticsPayload = {
  month: string;
  hoursByPhase: Array<{
    phase: string;
    averageHours: number;
    completionCount: number;
    totalHours: number;
  }>;
  hoursByClient: Array<{ clientId: string; clientName: string; clientLogoUrl: string | null; clientLogoBgColor: string | null; clientLogoTextTone: string | null; hours: number }>;
  hoursByAthlete: Array<{
    athleteId: string;
    athleteName: string;
    profilePhotoUrl: string | null;
    profilePhotoBgColor: string | null;
    profilePhotoTextTone: string | null;
    hours: number;
  }>;
  dueDateRisk: Array<{
    id: string;
    name: string;
    clientName: string;
    clientLogoUrl: string | null;
    clientLogoBgColor: string | null;
    clientLogoTextTone: string | null;
    dueDate: string;
    daysUntilDue: number;
    progressPercent: number;
    currentStatus: string;
    assignedAthleteName: string | null;
  }>;
  dueDateCalendar: Array<{
    id: string;
    name: string;
    clientName: string;
    clientLogoUrl: string | null;
    clientLogoBgColor: string | null;
    clientLogoTextTone: string | null;
    dueDate: string;
    progressPercent: number;
    currentStatus: string;
    assignedAthleteName: string | null;
  }>;
  profitabilityByClient: Array<{
    clientId: string;
    clientName: string;
    clientLogoUrl: string | null;
    clientLogoBgColor: string | null;
    clientLogoTextTone: string | null;
    revenueGbp: number;
    costGbp: number;
    marginGbp: number;
    marginPercent: number;
  }>;
  beatenDeadlinesByAthlete: BeatenDeadlinesByAthlete[];
  clientFilter: string | null;
  athleteFilter: string | null;
};

export type BuildAnalyticsOptions = {
  clientId?: string | null;
  athleteId?: string | null;
  allTime?: boolean;
};

export async function buildAnalytics(
  reference: Date,
  options: BuildAnalyticsOptions = {}
): Promise<AnalyticsPayload> {
  const clientId = options.clientId?.trim() || null;
  const athleteId = options.athleteId?.trim() || null;
  const allTime = options.allTime === true;
  const from = monthStartUtc(reference);
  const to = monthEndUtc(reference);
  const ledger = allTime ? await buildCommercialLedgerAllTime() : await buildCommercialLedger(reference);

  const lineItemWhere: Prisma.OpsSubmissionLineItemWhereInput = {
    submission: {
      ...(allTime ? {} : { submissionDate: { gte: from, lte: to } }),
      ...(athleteId ? { athleteId } : {}),
    },
    ...(clientId ? { clientId } : {}),
  };

  const lineItems = await prisma.opsSubmissionLineItem.findMany({
    where: lineItemWhere,
    include: {
      submission: { include: { athlete: true } },
      client: { select: { id: true, name: true, logoUrl: true, logoBgColor: true, logoTextTone: true } },
    },
  });

  const clientHoursMap = new Map<string, { name: string; logoUrl: string | null; logoBgColor: string | null; logoTextTone: string | null; hours: number }>();
  const athleteHoursMap = new Map<
    string,
    {
      name: string;
      profilePhotoUrl: string | null;
      profilePhotoBgColor: string | null;
      profilePhotoTextTone: string | null;
      hours: number;
    }
  >();

  for (const li of lineItems) {
    const hours = Number(li.hoursWorked);

    const ch = clientHoursMap.get(li.clientId);
    if (ch) ch.hours += hours;
    else clientHoursMap.set(li.clientId, { name: li.client.name, logoUrl: li.client.logoUrl, logoBgColor: li.client.logoBgColor, logoTextTone: li.client.logoTextTone, hours });

    const athlete = li.submission.athlete;
    const ah = athleteHoursMap.get(athlete.id);
    if (ah) ah.hours += hours;
    else {
      const profile = athleteProfileVisual(athlete);
      athleteHoursMap.set(athlete.id, {
        name: athlete.fullName,
        ...profile,
        hours,
      });
    }
  }

  const [reportingAthletes, monthHoursByAthlete] = await Promise.all([
    listReportingAthletes({ status: "active" }),
    allTime
      ? monthSubmissionHoursByAthlete(new Date(0), new Date())
      : monthSubmissionHoursByAthlete(from, to),
  ]);

  for (const athlete of reportingAthletes) {
    if (athleteId && athlete.id !== athleteId) continue;
    const monthHours = monthHoursByAthlete.get(athlete.id) ?? 0;
    if (monthHours <= 0) continue;
    const existing = athleteHoursMap.get(athlete.id);
    if (existing) {
      if (existing.hours < monthHours) existing.hours = monthHours;
      continue;
    }
    const profile = athleteProfileVisual(athlete);
    athleteHoursMap.set(athlete.id, {
      name: athlete.fullName,
      ...profile,
      hours: monthHours,
    });
  }

  const now = dateOnlyUtc(new Date());
  const projectFilter = {
    ...(clientId ? { clientId } : {}),
    ...(athleteId ? { assignedAthleteId: athleteId } : {}),
  };
  const riskProjects = await prisma.opsProject.findMany({
    where: {
      dueDate: { not: null, lte: new Date(now.getTime() + 14 * 86400000) },
      currentStatus: { notIn: ["completed", "handed_over"] },
      ...projectFilter,
    },
    include: {
      client: { select: { name: true, logoUrl: true, logoBgColor: true, logoTextTone: true } },
      assignedAthlete: { select: { fullName: true } },
    },
    orderBy: { dueDate: "asc" },
    take: 20,
  });

  const calendarProjects = await prisma.opsProject.findMany({
    where: {
      dueDate: allTime ? { not: null } : { gte: from, lte: to },
      currentStatus: { notIn: ["completed", "handed_over"] },
      ...projectFilter,
    },
    include: {
      client: { select: { name: true, logoUrl: true, logoBgColor: true, logoTextTone: true } },
      assignedAthlete: { select: { fullName: true } },
    },
    orderBy: { dueDate: "asc" },
  });

  let profitabilityByClient: AnalyticsPayload["profitabilityByClient"];

  if (athleteId) {
    const profitMap = new Map<
      string,
      {
        clientName: string;
        clientLogoUrl: string | null;
        clientLogoBgColor: string | null;
        clientLogoTextTone: string | null;
        revenueGbp: number;
        costGbp: number;
      }
    >();
    for (const row of ledger.rows) {
      if (clientId && row.clientId !== clientId) continue;
      if (row.athleteId !== athleteId) continue;
      const existing = profitMap.get(row.clientId);
      if (existing) {
        existing.revenueGbp += row.revenueGbp;
        existing.costGbp += row.athleteCostGbp;
      } else {
        profitMap.set(row.clientId, {
          clientName: row.clientName,
          clientLogoUrl: row.clientLogoUrl,
          clientLogoBgColor: row.clientLogoBgColor,
          clientLogoTextTone: row.clientLogoTextTone,
          revenueGbp: row.revenueGbp,
          costGbp: row.athleteCostGbp,
        });
      }
    }
    profitabilityByClient = Array.from(profitMap.entries())
      .map(([clientIdKey, v]) => {
        const marginGbp = round2(v.revenueGbp - v.costGbp);
        return {
          clientId: clientIdKey,
          clientName: v.clientName,
          clientLogoUrl: v.clientLogoUrl,
          clientLogoBgColor: v.clientLogoBgColor,
          clientLogoTextTone: v.clientLogoTextTone,
          revenueGbp: round2(v.revenueGbp),
          costGbp: round2(v.costGbp),
          marginGbp,
          marginPercent: v.revenueGbp > 0 ? round2((marginGbp / v.revenueGbp) * 100) : 0,
        };
      })
      .sort((a, b) => b.marginGbp - a.marginGbp);
  } else {
    const clientCostMap = new Map<string, number>();
    for (const row of ledger.rows) {
      if (clientId && row.clientId !== clientId) continue;
      clientCostMap.set(row.clientId, (clientCostMap.get(row.clientId) ?? 0) + row.athleteCostGbp);
    }

    profitabilityByClient = ledger.clientLanes
      .filter((lane) => !clientId || lane.clientId === clientId)
      .map((lane) => {
        const costGbp = round2(clientCostMap.get(lane.clientId) ?? 0);
        const revenueGbp = lane.totalClientRevenueGbp;
        const marginGbp = round2(revenueGbp - costGbp);
        return {
          clientId: lane.clientId,
          clientName: lane.clientName,
          clientLogoUrl: lane.clientLogoUrl,
          clientLogoBgColor: lane.clientLogoBgColor,
          clientLogoTextTone: lane.clientLogoTextTone,
          revenueGbp,
          costGbp,
          marginGbp,
          marginPercent: revenueGbp > 0 ? round2((marginGbp / revenueGbp) * 100) : 0,
        };
      })
      .sort((a, b) => b.marginGbp - a.marginGbp);
  }

  const beatenDeadlinesByAthlete = await buildBeatenDeadlines(reference, clientId, athleteId, allTime);

  const hoursByPhaseRaw = await buildAverageHoursByPhase({
    clientId,
    athleteId,
    from: allTime ? null : from,
    to: allTime ? null : to,
  });

  return {
    month: allTime ? "all" : from.toISOString().slice(0, 7),
    hoursByPhase: hoursByPhaseRaw.map((p) => ({
      phase: p.phase,
      averageHours: round2(p.averageHours),
      completionCount: p.completionCount,
      totalHours: round2(p.totalHours),
    })),
    hoursByClient: Array.from(clientHoursMap.entries())
      .map(([clientId, v]) => ({
        clientId,
        clientName: v.name,
        clientLogoUrl: v.logoUrl,
        clientLogoBgColor: v.logoBgColor,
        clientLogoTextTone: v.logoTextTone,
        hours: round2(v.hours),
      }))
      .sort((a, b) => b.hours - a.hours),
    hoursByAthlete: Array.from(athleteHoursMap.entries())
      .map(([athleteId, v]) => ({
        athleteId,
        athleteName: v.name,
        profilePhotoUrl: v.profilePhotoUrl,
        profilePhotoBgColor: v.profilePhotoBgColor,
        profilePhotoTextTone: v.profilePhotoTextTone,
        hours: round2(v.hours),
      }))
      .sort((a, b) => b.hours - a.hours),
    dueDateRisk: riskProjects.map((p) => {
      const due = p.dueDate!;
      const daysUntilDue = Math.ceil((due.getTime() - now.getTime()) / 86400000);
      return {
        id: p.id,
        name: p.name,
        clientName: p.client.name,
        clientLogoUrl: p.client.logoUrl,
        clientLogoBgColor: p.client.logoBgColor,
        clientLogoTextTone: p.client.logoTextTone,
        dueDate: due.toISOString().slice(0, 10),
        dueAt: due.toISOString(),
        dueLabel: formatProjectDueAt(due),
        daysUntilDue,
        progressPercent: p.progressPercent ?? 0,
        currentStatus: p.currentStatus,
        assignedAthleteName: p.assignedAthlete?.fullName ?? null,
      };
    }),
    dueDateCalendar: calendarProjects.map((p) => ({
      id: p.id,
      name: p.name,
      clientName: p.client.name,
      clientLogoUrl: p.client.logoUrl,
      clientLogoBgColor: p.client.logoBgColor,
      clientLogoTextTone: p.client.logoTextTone,
      dueDate: p.dueDate!.toISOString().slice(0, 10),
      dueAt: p.dueDate!.toISOString(),
      dueLabel: formatProjectDueAt(p.dueDate),
      progressPercent: p.progressPercent ?? 0,
      currentStatus: p.currentStatus,
      assignedAthleteName: p.assignedAthlete?.fullName ?? null,
    })),
    profitabilityByClient,
    beatenDeadlinesByAthlete,
    clientFilter: clientId,
    athleteFilter: athleteId,
  };
}

export async function buildOpsOverview(
  reference: Date,
  options: { includeFinancials?: boolean } = {}
) {
  const includeFinancials = options.includeFinancials !== false;
  const from = monthStartUtc(reference);
  const to = monthEndUtc(reference);
  const ledger = await buildCommercialLedger(reference);
  const beatenDeadlinesByAthlete = await buildBeatenDeadlines(reference);
  const beatenMap = new Map(beatenDeadlinesByAthlete.map((a) => [a.athleteId, a]));

  const [activeAthletes, activeProjects, openBlockers, checkInRequests, dailySubmissions, reportingAthletes] =
    await Promise.all([
      listReportingAthletes({ status: "active" }).then((rows) => rows.length),
      prisma.opsProject.count({
        where: { currentStatus: { notIn: ["completed", "handed_over"] } },
      }),
      prisma.opsProject.count({ where: { blockerFlag: true } }),
      countPendingCheckInRequests(),
      prisma.opsDailySubmission.findMany({
        where: { submissionDate: { gte: from, lte: to } },
        select: { totalHours: true },
      }),
      listReportingAthletes({ status: "active" }),
    ]);

  let daily12Count = 0;
  let daily14Count = 0;
  for (const s of dailySubmissions) {
    const h = Number(s.totalHours);
    if (h >= OPS_ALERT_THRESHOLDS.dailyCriticalHours) daily14Count++;
    else if (h >= OPS_ALERT_THRESHOLDS.dailyWarningHours) daily12Count++;
  }

  const athletes = reportingAthletes;
  const athleteMonthHours = new Map<string, number>();
  let capExceededCount = 0;
  for (const a of athletes) {
    const agg = await prisma.opsDailySubmission.aggregate({
      where: { athleteId: a.id, submissionDate: { gte: from, lte: to } },
      _sum: { totalHours: true },
    });
    const monthHours = Number(agg._sum.totalHours ?? 0);
    athleteMonthHours.set(a.id, monthHours);
    if (monthHours > a.monthlyHourCap) capExceededCount++;
  }

  type PerformerRow = {
    athleteId: string;
    athleteName: string;
    profilePhotoUrl: string | null;
    profilePhotoBgColor: string | null;
    profilePhotoTextTone: string | null;
    hoursWorked: number;
    revenueGbp: number;
    marginGbp: number;
    marginPercent: number;
    beatenCount: number;
    totalDaysBeaten: number;
    averageDaysBeaten: number;
  };

  const performerMap = new Map<string, PerformerRow>();
  const athleteProfileById = new Map(
    athletes.map((a) => [a.id, athleteProfileVisual(a)] as const)
  );

  for (const t of ledger.athleteTotals) {
    const beaten = beatenMap.get(t.athleteId);
    const profile = athleteProfileById.get(t.athleteId) ?? athleteProfileVisual(null);
    performerMap.set(t.athleteId, {
      athleteId: t.athleteId,
      athleteName: t.athleteName,
      ...profile,
      hoursWorked: t.hoursWorked,
      revenueGbp: t.revenueGbp,
      marginGbp: t.marginGbp,
      marginPercent: t.revenueGbp > 0 ? round2((t.marginGbp / t.revenueGbp) * 100) : 0,
      beatenCount: beaten?.beatenCount ?? 0,
      totalDaysBeaten: beaten?.totalDaysBeaten ?? 0,
      averageDaysBeaten: beaten?.averageDaysBeaten ?? 0,
    });
  }

  for (const beaten of beatenDeadlinesByAthlete) {
    if (performerMap.has(beaten.athleteId)) continue;
    performerMap.set(beaten.athleteId, {
      athleteId: beaten.athleteId,
      athleteName: beaten.athleteName,
      profilePhotoUrl: beaten.profilePhotoUrl,
      profilePhotoBgColor: beaten.profilePhotoBgColor,
      profilePhotoTextTone: beaten.profilePhotoTextTone,
      hoursWorked: 0,
      revenueGbp: 0,
      marginGbp: 0,
      marginPercent: 0,
      beatenCount: beaten.beatenCount,
      totalDaysBeaten: beaten.totalDaysBeaten,
      averageDaysBeaten: beaten.averageDaysBeaten,
    });
  }

  for (const athlete of athletes) {
    if (performerMap.has(athlete.id)) continue;
    const monthHours = athleteMonthHours.get(athlete.id) ?? 0;
    if (monthHours <= 0) continue;
    const profile = athleteProfileById.get(athlete.id) ?? athleteProfileVisual(athlete);
    performerMap.set(athlete.id, {
      athleteId: athlete.id,
      athleteName: athlete.fullName,
      ...profile,
      hoursWorked: round2(monthHours),
      revenueGbp: 0,
      marginGbp: 0,
      marginPercent: 0,
      beatenCount: 0,
      totalDaysBeaten: 0,
      averageDaysBeaten: 0,
    });
  }

  const topPerformers = Array.from(performerMap.values())
    .sort(
      (a, b) =>
        b.beatenCount - a.beatenCount ||
        b.totalDaysBeaten - a.totalDaysBeaten ||
        b.hoursWorked - a.hoursWorked ||
        b.marginGbp - a.marginGbp
    )
    .slice(0, 8);

  return {
    month: from.toISOString().slice(0, 7),
    activeAthletes,
    activeProjects,
    openBlockers,
    checkInRequests,
    ...(includeFinancials
      ? {
          monthlyRevenueGbp: ledger.totalRevenueGbp,
          grossMarginGbp: ledger.grossMarginGbp,
          grossMarginPercent: ledger.grossMarginPercent,
        }
      : {}),
    alertCounts: { daily12Count, daily14Count, capExceededCount },
    topPerformers,
    beatenDeadlinesByAthlete,
  };
}

export async function lockStaleSubmissions(_athleteId?: string) {
  // Auto-lock disabled — athletes can edit previous daily logs by default.
  // Manual lock/unlock remains available via Commercial if re-enabled later.
}
