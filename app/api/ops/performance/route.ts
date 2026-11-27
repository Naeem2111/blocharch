import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { buildAthletePerformance } from "@/lib/athlete-performance";
import { requireOpsOverviewSession } from "@/lib/ops-access";

export async function GET(request: NextRequest) {
  const gate = await requireOpsOverviewSession(request);
  if (gate instanceof NextResponse) return gate;

  const params = request.nextUrl.searchParams;
  const report = await buildAthletePerformance({
    clientId: params.get("clientId"),
    stage: params.get("stage"),
    complexity: params.get("complexity"),
    from: params.get("from"),
    to: params.get("to"),
  });
  return NextResponse.json(report);
}
