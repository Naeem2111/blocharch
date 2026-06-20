import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  isOpsProjectPhase,
  isOpsProjectStatus,
} from "@/lib/ops-constants";
import {
  athleteProjectSelect,
  requireAthletePortalSession,
  serializeProjectForAthlete,
} from "@/lib/ops-access";
import { syncProjectAfterOpsUpdate } from "@/lib/planner-project-sync";

/** Progress when a completed project is moved back to active work. */
const REACTIVATION_PROGRESS_PERCENT = 50;

type RouteContext = { params: Promise<{ projectId: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const gate = await requireAthletePortalSession(request);
  if (gate instanceof NextResponse) return gate;
  const { athlete } = gate;

  const { projectId } = await context.params;
  const project = await prisma.opsProject.findFirst({
    where: { id: projectId, assignedAthleteId: athlete.id },
  });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  try {
    const body = await request.json();
    const data: {
      currentStage?: typeof project.currentStage;
      currentStatus?: typeof project.currentStatus;
      progressPercent?: number;
      notes?: string | null;
    } = {};

    if (body.currentStage != null) {
      const stage = String(body.currentStage);
      if (!isOpsProjectPhase(stage)) {
        return NextResponse.json({ error: "Invalid project stage" }, { status: 400 });
      }
      data.currentStage = stage;
    }

    if (body.currentStatus != null) {
      const status = String(body.currentStatus);
      if (!isOpsProjectStatus(status)) {
        return NextResponse.json({ error: "Invalid project status" }, { status: 400 });
      }
      const wasCompleted = project.currentStatus === "completed" || project.currentStatus === "handed_over";
      if (wasCompleted && status !== "in_progress") {
        return NextResponse.json(
          { error: "Reactivate completed projects by setting status to In Progress" },
          { status: 400 }
        );
      }
      if (!wasCompleted && (status === "completed" || status === "handed_over")) {
        return NextResponse.json(
          { error: "Projects complete automatically at 100% progress in the Daily Log" },
          { status: 400 }
        );
      }
      data.currentStatus = status;
      if (wasCompleted && status === "in_progress") {
        const pct = project.progressPercent;
        if (pct != null && pct >= 100) {
          data.progressPercent = REACTIVATION_PROGRESS_PERCENT;
        }
      }
    }

    if (body.notes !== undefined) {
      data.notes = body.notes ? String(body.notes).trim() : null;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const updated = await prisma.opsProject.update({
      where: { id: projectId },
      data,
      select: athleteProjectSelect,
    });

    if (data.currentStatus !== undefined) {
      await syncProjectAfterOpsUpdate(
        projectId,
        {
          assignedAthleteId: project.assignedAthleteId,
          currentStatus: project.currentStatus,
          name: project.name,
        },
        {
          assignedAthleteId: athlete.id,
          currentStatus: updated.currentStatus,
          name: updated.name,
        }
      );
    }

    return NextResponse.json({ project: serializeProjectForAthlete(updated) });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
