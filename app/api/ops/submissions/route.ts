import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOpsSession } from "@/lib/ops-access";

export async function GET(request: NextRequest) {
  const gate = await requireOpsSession(request);
  if (gate instanceof NextResponse) return gate;

  const submissions = await prisma.opsDailySubmission.findMany({
    orderBy: [{ submissionDate: "desc" }, { updatedAt: "desc" }],
    take: 60,
    include: {
      athlete: { select: { fullName: true, athleteCode: true } },
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
      lockedAt: s.lockedAt?.toISOString() ?? null,
      updatedAt: s.updatedAt.toISOString(),
    })),
  });
}
