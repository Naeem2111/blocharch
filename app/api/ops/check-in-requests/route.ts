import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOpsSession } from "@/lib/ops-access";
import { serializeCheckInRequest } from "@/lib/check-in-requests";
import { isGoogleCalendarConfigured } from "@/lib/google-calendar";

const include = {
  athlete: { select: { fullName: true, athleteCode: true, email: true } },
  project: { include: { client: { select: { name: true } } } },
} as const;

export async function GET(request: NextRequest) {
  const gate = await requireOpsSession(request);
  if (gate instanceof NextResponse) return gate;

  const status = request.nextUrl.searchParams.get("status")?.trim();
  const where =
    status === "pending"
      ? { status: { in: ["pending", "counter_proposed"] as const } }
      : status && status !== "all"
        ? { status: status as "pending" | "approved" | "declined" | "counter_proposed" | "confirmed" | "cancelled" }
        : undefined;

  const rows = await prisma.opsCheckInRequest.findMany({
    where,
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 100,
    include,
  });

  const pendingCount = await prisma.opsCheckInRequest.count({
    where: { status: { in: ["pending", "counter_proposed"] } },
  });

  return NextResponse.json({
    requests: rows.map(serializeCheckInRequest),
    pendingCount,
    calendarConnected: isGoogleCalendarConfigured(),
  });
}
