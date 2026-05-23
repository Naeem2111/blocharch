import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { athleteMonthlySummary, requireAthletePortalSession } from "@/lib/ops-access";
import { prisma } from "@/lib/prisma";

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
  const openBlockers = await prisma.opsProject.count({
    where: { assignedAthleteId: athlete.id, blockerFlag: true },
  });
  const recentSubmissions = await prisma.opsDailySubmission.findMany({
    where: { athleteId: athlete.id },
    orderBy: { submissionDate: "desc" },
    take: 5,
    select: {
      id: true,
      submissionDate: true,
      totalHours: true,
      checkInRequested: true,
    },
  });

  return NextResponse.json({
    profile: {
      fullName: athlete.fullName,
      athleteCode: athlete.athleteCode,
      blocharchStartDate: athlete.blocharchStartDate.toISOString().slice(0, 10),
      status: athlete.status,
      monthlyHourCap: athlete.monthlyHourCap,
    },
    summary,
    activeProjects,
    openBlockers,
    recentSubmissions: recentSubmissions.map((s) => ({
      id: s.id,
      submissionDate: s.submissionDate.toISOString().slice(0, 10),
      totalHours: Number(s.totalHours),
      checkInRequested: s.checkInRequested,
    })),
  });
}
