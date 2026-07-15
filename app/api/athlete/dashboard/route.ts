import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { athleteMonthlySummary, requireAthletePortalSession } from "@/lib/ops-access";
import { prisma } from "@/lib/prisma";
import {
  buildBlockerAlert,
  buildCheckInAlert,
  buildDailyHourAlerts,
  buildMonthlyCapAlert,
  type OpsAlertSeverity,
} from "@/lib/ops-alerts";
import { dateOnlyUtc } from "@/lib/ops-hours";

export async function GET(request: NextRequest) {
  const gate = await requireAthletePortalSession(request);
  if (gate instanceof NextResponse) return gate;
  const { athlete } = gate;

  const summary = await athleteMonthlySummary(athlete);
  const activeProjects = await prisma.opsProject.count({
    where: {
      assignedAthleteId: athlete.id,
      currentStatus: { notIn: ["completed", "handed_over"] },
    },
  });
  const completedProjects = await prisma.opsProject.count({
    where: {
      assignedAthleteId: athlete.id,
      currentStatus: { in: ["completed", "handed_over"] },
    },
  });
  const openBlockers = await prisma.opsProject.count({
    where: { assignedAthleteId: athlete.id, blockerFlag: true },
  });
  const checkInRequests = await prisma.opsCheckInRequest.count({
    where: { athleteId: athlete.id, status: { in: ["pending", "counter_proposed"] } },
  });

  const unreadNotifications = await prisma.opsAthleteNotification.findMany({
    where: { athleteId: athlete.id, readAt: null },
    orderBy: { createdAt: "desc" },
    take: 8,
  });

  const today = dateOnlyUtc(new Date());
  const todaySubmission = await prisma.opsDailySubmission.findUnique({
    where: {
      athleteId_submissionDate: { athleteId: athlete.id, submissionDate: today },
    },
    select: { totalHours: true },
  });
  const todayHours = Number(todaySubmission?.totalHours ?? 0);

  const alerts = [
    ...buildDailyHourAlerts(todayHours),
    buildMonthlyCapAlert(summary.monthHours, athlete.monthlyHourCap),
    buildBlockerAlert(openBlockers),
    buildCheckInAlert(checkInRequests),
    ...unreadNotifications.map((n) => ({
      code: `notification_${n.id}`,
      severity: (n.type === "task_assigned" ? "warning" : "info") as OpsAlertSeverity,
      message: n.message ? `${n.title} — ${n.message}` : n.title,
      linkPath: n.linkPath ?? "/dashboard/athlete/notifications",
    })),
  ].filter(Boolean);

  const recentSubmissions = await prisma.opsDailySubmission.findMany({
    where: { athleteId: athlete.id },
    orderBy: { submissionDate: "desc" },
    take: 5,
    select: {
      id: true,
      submissionDate: true,
      totalHours: true,
      checkInRequested: true,
      lockedAt: true,
    },
  });

  const beatenWhere = {
    assignedAthleteId: athlete.id,
    OR: [{ deadlineBeatenMinutes: { gt: 0 } }, { deadlineBeatenDays: { gt: 0 } }],
  };

  const [beatenCount, beatenDeadlineProjects] = await Promise.all([
    prisma.opsProject.count({ where: beatenWhere }),
    prisma.opsProject.findMany({
      where: beatenWhere,
      orderBy: [{ completedAt: "desc" }, { updatedAt: "desc" }],
      take: 10,
      select: {
        id: true,
        name: true,
        dueDate: true,
        completedAt: true,
        deadlineBeatenDays: true,
        deadlineBeatenMinutes: true,
        client: { select: { name: true } },
      },
    }),
  ]);

  const totalMinutesAgg = await prisma.opsProject.aggregate({
    where: beatenWhere,
    _sum: { deadlineBeatenMinutes: true, deadlineBeatenDays: true },
  });

  const totalMinutesBeaten =
    Number(totalMinutesAgg._sum?.deadlineBeatenMinutes ?? 0) ||
    Number(totalMinutesAgg._sum?.deadlineBeatenDays ?? 0) * 1440;

  const beatenDeadlines = {
    count: beatenCount,
    totalDaysBeaten: Math.floor(totalMinutesBeaten / 1440),
    totalMinutesBeaten,
    recent: beatenDeadlineProjects.map((p) => ({
      id: p.id,
      name: p.name,
      clientName: p.client.name,
      dueDate: p.dueDate?.toISOString().slice(0, 10) ?? null,
      dueAt: p.dueDate?.toISOString() ?? null,
      completedAt: p.completedAt?.toISOString() ?? null,
      minutesBeaten:
        p.deadlineBeatenMinutes ??
        (p.deadlineBeatenDays != null && p.deadlineBeatenDays > 0
          ? p.deadlineBeatenDays * 1440
          : 0),
      daysBeaten: p.deadlineBeatenDays ?? 0,
    })),
  };

  return NextResponse.json({
    profile: {
      fullName: athlete.fullName,
      athleteCode: athlete.athleteCode,
      profilePhotoUrl: athlete.profilePhotoUrl,
      profilePhotoBgColor: athlete.profilePhotoBgColor,
      profilePhotoTextTone: athlete.profilePhotoTextTone,
      blocharchStartDate: athlete.blocharchStartDate.toISOString().slice(0, 10),
      status: athlete.status,
      monthlyHourCap: athlete.monthlyHourCap,
    },
    summary,
    activeProjects,
    completedProjects,
    openBlockers,
    checkInRequests,
    unreadNotificationCount: unreadNotifications.length,
    todayHours,
    alerts,
    recentSubmissions: recentSubmissions.map((s) => ({
      id: s.id,
      submissionDate: s.submissionDate.toISOString().slice(0, 10),
      totalHours: Number(s.totalHours),
      checkInRequested: s.checkInRequested,
      lockedAt: s.lockedAt?.toISOString() ?? null,
    })),
    beatenDeadlines,
  });
}
