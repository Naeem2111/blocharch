import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePrivateOpsSession } from "@/lib/private-access";
import { serializePrivateProject } from "@/lib/private-serialize";
import { PRIVATE_STAGE_LABELS } from "@/lib/private-constants";

function startOfWeekUtc(d = new Date()): Date {
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + diff));
  return monday;
}

function endOfWeekUtc(start: Date): Date {
  return new Date(start.getTime() + 7 * 86_400_000);
}

function monthBounds(d = new Date()) {
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
  return { start, end };
}

export async function GET(request: NextRequest) {
  const gate = await requirePrivateOpsSession(request);
  if (gate instanceof NextResponse) return gate;

  const weekStart = startOfWeekUtc();
  const weekEnd = endOfWeekUtc(weekStart);
  const { start: monthStart, end: monthEnd } = monthBounds();

  const activeProjects = await prisma.privateProject.findMany({
    where: { status: "active" },
    include: {
      client: { select: { id: true, name: true, contactEmail: true, contactPhone: true, slug: true } },
      assignedAthlete: {
        select: { id: true, fullName: true, athleteCode: true, privateWeeklyCapHours: true },
      },
      actionItems: {
        where: { completedAt: null, clientFacing: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  const athleteIds = Array.from(
    new Set(activeProjects.map((p) => p.assignedAthleteId).filter(Boolean) as string[]),
  );

  const weekLogs = athleteIds.length
    ? await prisma.privateHourLog.groupBy({
        by: ["athleteId"],
        where: {
          athleteId: { in: athleteIds },
          workDate: { gte: weekStart, lt: weekEnd },
        },
        _sum: { hours: true },
      })
    : [];

  const hoursByAthlete = new Map(
    weekLogs.map((r) => [r.athleteId, Number(r._sum.hours ?? 0)]),
  );

  const athletes = athleteIds.length
    ? await prisma.opsAthlete.findMany({
        where: { id: { in: athleteIds } },
        select: { id: true, fullName: true, privateWeeklyCapHours: true },
      })
    : [];

  const capacity = athletes.map((a) => ({
    athleteId: a.id,
    athleteName: a.fullName,
    privateHoursThisWeek: hoursByAthlete.get(a.id) ?? 0,
    weeklyCap: a.privateWeeklyCapHours,
    overCap: (hoursByAthlete.get(a.id) ?? 0) > a.privateWeeklyCapHours,
  }));

  const feeSum = activeProjects.reduce((s, p) => s + Number(p.feeZar), 0);
  const costSum = activeProjects.reduce((s, p) => s + Number(p.costZar), 0);
  const monthLogs = await prisma.privateHourLog.findMany({
    where: { workDate: { gte: monthStart, lt: monthEnd } },
    select: { hours: true, projectId: true },
  });

  // Revenue this month: recognise fee share for projects with activity, else sum fee of active / 12 as simple proxy — pack says "recognised this month". Use out-of-scope + proportional isn't defined; show fee of projects updated this month + logged activity.
  const projectsTouchedIds = new Set(monthLogs.map((l) => l.projectId));
  const monthFee = activeProjects
    .filter((p) => projectsTouchedIds.has(p.id) || (p.updatedAt >= monthStart && p.updatedAt < monthEnd))
    .reduce((s, p) => s + Number(p.feeZar), 0);
  // Prefer life fee recognition display as pack sample (R 84,000) — use sum of fees for projects with month activity, fallback to all active fees / rough; better: store recognised — for v1 use outOfScope + display total active fee margin stats.
  const revenueThisMonth = monthFee > 0 ? monthFee : feeSum;
  const costThisMonth = activeProjects
    .filter((p) => projectsTouchedIds.has(p.id) || (p.updatedAt >= monthStart && p.updatedAt < monthEnd))
    .reduce((s, p) => s + Number(p.costZar), 0);
  const costForMargin = costThisMonth > 0 ? costThisMonth : costSum;
  const blendedMargin =
    revenueThisMonth > 0
      ? Math.round(((revenueThisMonth - costForMargin) / revenueThisMonth) * 100)
      : null;

  const inCouncilReview = activeProjects.filter((p) => p.designStage === "council_review").length;

  const needsAttention = activeProjects
    .filter(
      (p) =>
        p.designStage === "council_review" ||
        p.actionItems.length > 0 ||
        p.outOfScopeFlag,
    )
    .slice(0, 8)
    .map((p) => ({
      id: p.id,
      name: p.name,
      reason:
        p.actionItems[0]?.title ??
        (p.outOfScopeFlag
          ? "Out-of-scope flag set"
          : PRIVATE_STAGE_LABELS[p.designStage]),
    }));

  const upcomingMoves = activeProjects
    .filter((p) => p.designStage !== "council_approved")
    .slice(0, 6)
    .map((p) => ({
      id: p.id,
      name: p.name,
      from: PRIVATE_STAGE_LABELS[p.designStage],
      hint: `Currently in ${PRIVATE_STAGE_LABELS[p.designStage]}`,
    }));

  return NextResponse.json({
    stats: {
      activePrivateProjects: activeProjects.length,
      athletesOnPrivate: athleteIds.length,
      revenueThisMonthZar: revenueThisMonth,
      blendedMarginPercent: blendedMargin,
      inCouncilReview,
    },
    capacity,
    needsAttention,
    upcomingMoves,
    projects: activeProjects.map((p) =>
      serializePrivateProject(p, {
        openActionTitle: p.actionItems[0]?.title ?? null,
      }),
    ),
  });
}
