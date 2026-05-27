import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAthletePortalSession } from "@/lib/ops-access";
import { isGoogleCalendarConfigured, listAvailableSlots } from "@/lib/google-calendar";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const gate = await requireAthletePortalSession(request);
  if (gate instanceof NextResponse) return gate;

  const pending = await prisma.opsCheckInRequest.findMany({
    where: { status: { in: ["pending", "counter_proposed", "approved", "confirmed"] } },
    select: { requestedStartAt: true, requestedEndAt: true, counterStartAt: true, counterEndAt: true },
  });

  const extraBusy = pending.flatMap((r) => {
    const blocks: Array<{ start: Date; end: Date }> = [
      { start: r.requestedStartAt, end: r.requestedEndAt },
    ];
    if (r.counterStartAt && r.counterEndAt) {
      blocks.push({ start: r.counterStartAt, end: r.counterEndAt });
    }
    return blocks;
  });

  const { slots, source } = await listAvailableSlots(extraBusy);

  return NextResponse.json({
    slots,
    source,
    calendarConnected: isGoogleCalendarConfigured(),
  });
}
