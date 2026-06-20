import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOpsSession } from "@/lib/ops-access";

export async function GET(request: NextRequest) {
  const gate = await requireOpsSession(request);
  if (gate instanceof NextResponse) return gate;

  const pendingCheckIns = await prisma.opsCheckInRequest.count({
    where: { status: { in: ["pending", "counter_proposed"] } },
  });

  return NextResponse.json({
    checkIns: pendingCheckIns,
    urgent: pendingCheckIns > 0,
  });
}
