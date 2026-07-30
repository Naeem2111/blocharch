import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePrivateOpsSession } from "@/lib/private-access";

/** Active athletes for private-project assignment pickers. */
export async function GET(request: NextRequest) {
  const gate = await requirePrivateOpsSession(request);
  if (gate instanceof NextResponse) return gate;

  const athletes = await prisma.opsAthlete.findMany({
    where: { status: "active" },
    orderBy: { fullName: "asc" },
    select: {
      id: true,
      fullName: true,
      athleteCode: true,
      privateWeeklyCapHours: true,
    },
  });

  return NextResponse.json({ athletes });
}
