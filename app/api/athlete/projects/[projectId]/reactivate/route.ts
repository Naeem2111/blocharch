import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAthletePortalSession } from "@/lib/ops-access";
import { whereAthleteProjectAccess } from "@/lib/ops-project-assignments";
import {
  reactivateArchivedOpsProject,
  REACTIVATION_PROGRESS_PERCENT,
} from "@/lib/sync-project-progress";

type RouteContext = { params: Promise<{ projectId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const gate = await requireAthletePortalSession(request);
  if (gate instanceof NextResponse) return gate;
  const { athlete } = gate;

  const { projectId } = await context.params;
  const allowed = await prisma.opsProject.findFirst({
    where: whereAthleteProjectAccess(athlete.id, projectId),
    select: { id: true },
  });
  if (!allowed) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const result = await reactivateArchivedOpsProject(projectId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ok: true, progressPercent: REACTIVATION_PROGRESS_PERCENT });
}
