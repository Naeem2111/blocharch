import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireOpsSession } from "@/lib/ops-access";
import { buildOpsOverview } from "@/lib/ops-commercial";

export async function GET(request: NextRequest) {
  const gate = await requireOpsSession(request);
  if (gate instanceof NextResponse) return gate;

  const overview = await buildOpsOverview(new Date());
  return NextResponse.json(overview);
}
