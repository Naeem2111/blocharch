import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAthletePortalSession } from "@/lib/ops-access";

export async function GET(request: NextRequest) {
  const gate = await requireAthletePortalSession(request);
  if (gate instanceof NextResponse) return gate;
  const { athlete } = gate;

  const [unreadNotifications, inboxTasks] = await Promise.all([
    prisma.opsAthleteNotification.count({
      where: { athleteId: athlete.id, readAt: null },
    }),
    prisma.plannerTask.count({
      where: {
        column: {
          board: { athleteId: athlete.id, kind: "blocharch_inbox" },
        },
        createdAt: { gte: new Date(Date.now() - 7 * 86400000) },
      },
    }),
  ]);

  return NextResponse.json({
    notifications: unreadNotifications,
    inboxRecent: inboxTasks,
    urgent: unreadNotifications > 0,
  });
}
