import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOpsSession } from "@/lib/ops-access";

export async function GET(request: NextRequest) {
  const gate = await requireOpsSession(request);
  if (gate instanceof NextResponse) return gate;

  const limit = Math.min(500, Math.max(1, parseInt(request.nextUrl.searchParams.get("limit") || "120", 10)));

  const submissions = await prisma.opsDailySubmission.findMany({
    orderBy: [{ submissionDate: "desc" }, { updatedAt: "desc" }],
    take: limit,
    include: {
      athlete: { select: { fullName: true, athleteCode: true } },
      lineItems: {
        include: {
          project: { select: { name: true } },
          client: { select: { name: true } },
        },
      },
    },
  });

  return NextResponse.json({
    submissions: submissions.map((s) => ({
      id: s.id,
      athleteId: s.athleteId,
      athleteName: s.athlete.fullName,
      athleteCode: s.athlete.athleteCode,
      submissionDate: s.submissionDate.toISOString().slice(0, 10),
      totalHours: Number(s.totalHours),
      wellbeingScore: s.wellbeingScore,
      checkInRequested: s.checkInRequested,
      dailyNote: s.dailyNote,
      lockedAt: s.lockedAt?.toISOString() ?? null,
      updatedAt: s.updatedAt.toISOString(),
      lineItems: s.lineItems.map((li) => ({
        projectName: li.project.name,
        clientName: li.client.name,
        projectPhase: li.projectPhase,
        taskType: li.taskType,
        taskTypes: li.taskTypes?.length ? li.taskTypes : [li.taskType],
        hoursWorked: Number(li.hoursWorked),
        completionPercent: li.completionPercent,
        blockerFlag: li.blockerFlag,
        blockerNote: li.blockerNote,
        completedSummary: li.completedSummary,
        notes: li.notes,
      })),
    })),
  });
}
