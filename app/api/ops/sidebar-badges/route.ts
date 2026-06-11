import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOpsSession } from "@/lib/ops-access";

export async function GET(request: NextRequest) {
  const gate = await requireOpsSession(request);
  if (gate instanceof NextResponse) return gate;

  const [unreadNotifications, pendingCheckIns] = await Promise.all([
    prisma.opsNotification.count({ where: { readAt: null } }),
    prisma.opsCheckInRequest.count({
      where: { status: { in: ["pending", "counter_proposed"] } },
    }),
  ]);

  return NextResponse.json({
    notifications: unreadNotifications,
    checkIns: pendingCheckIns,
    urgent: unreadNotifications + pendingCheckIns > 0,
  });
}
