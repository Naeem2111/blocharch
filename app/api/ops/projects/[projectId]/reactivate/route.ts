import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireOpsOverviewSession } from "@/lib/ops-access";
import {
  reactivateArchivedOpsProject,
  REACTIVATION_PROGRESS_PERCENT,
} from "@/lib/sync-project-progress";

type RouteContext = { params: Promise<{ projectId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const gate = await requireOpsOverviewSession(request);
  if (gate instanceof NextResponse) return gate;

  const { projectId } = await context.params;
  const result = await reactivateArchivedOpsProject(projectId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ok: true, progressPercent: REACTIVATION_PROGRESS_PERCENT });
}
