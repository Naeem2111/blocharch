import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { whereAthleteProjectAccess, whereProjectHoursByAthlete } from "@/lib/ops-project-assignments";
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
import { REACTIVATION_PROGRESS_PERCENT } from "@/lib/sync-project-progress";

type RouteContext = { params: Promise<{ projectId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const gate = await requireAthletePortalSession(request);
  if (gate instanceof NextResponse) return gate;
  const { athlete } = gate;

  const { projectId } = await context.params;
  const project = await prisma.opsProject.findFirst({
    where: whereAthleteProjectAccess(athlete.id, projectId),
    select: {
      ...athleteProjectSelect,
      completedAt: true,
      assignedAthlete: { select: { fullName: true, athleteCode: true } },
    },
  });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const hoursAgg = await prisma.opsSubmissionLineItem.aggregate({
    where: whereProjectHoursByAthlete(athlete.id, projectId),
    _sum: { hoursWorked: true },
  });

  const submissions = await prisma.opsDailySubmission.findMany({
    where: { athleteId: athlete.id, lineItems: { some: { projectId } } },
    orderBy: { submissionDate: "desc" },
    take: 60,
    include: {
      athlete: { select: { fullName: true, athleteCode: true } },
      lineItems: {
        where: { projectId },
      },
    },
  });

  const serialized = serializeProjectForAthlete(project);

  return NextResponse.json({
    project: {
      ...serialized,
      clientName: project.client.name,
      assignedAthleteName: project.assignedAthlete?.fullName ?? null,
      assignedAthleteCode: project.assignedAthlete?.athleteCode ?? null,
      hoursLogged: Number(hoursAgg._sum.hoursWorked ?? 0),
      completedAt: project.completedAt?.toISOString().slice(0, 10) ?? null,
    },
    submissions: submissions.map((s) => ({
      id: s.id,
      submissionDate: s.submissionDate.toISOString().slice(0, 10),
      athleteName: s.athlete.fullName,
      athleteCode: s.athlete.athleteCode,
      totalHours: Number(s.totalHours),
      isBackloggedSession: s.isBackloggedSession,
      dailyNote: s.dailyNote,
      lineItems: s.lineItems.map((li) => ({
        id: li.id,
        projectPhase: li.projectPhase,
        taskType: li.taskType,
        taskTypes: li.taskTypes,
        hoursWorked: Number(li.hoursWorked),
        completionPercent: li.completionPercent,
        completedSummary: li.completedSummary,
        notes: li.notes,
      })),
    })),
  });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const gate = await requireAthletePortalSession(request);
  if (gate instanceof NextResponse) return gate;
  const { athlete } = gate;

  const { projectId } = await context.params;
  const project = await prisma.opsProject.findFirst({
    where: whereAthleteProjectAccess(athlete.id, projectId),
  });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  try {
    const body = await request.json();
    const data: {
      currentStage?: typeof project.currentStage;
      currentStatus?: typeof project.currentStatus;
      progressPercent?: number;
      completedAt?: null;
      deadlineBeatenDays?: null;
      deadlineBeatenMinutes?: null;
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
        data.progressPercent = REACTIVATION_PROGRESS_PERCENT;
        data.completedAt = null;
        data.deadlineBeatenDays = null;
        data.deadlineBeatenMinutes = null;
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

    if (data.currentStatus === "in_progress" && (project.currentStatus === "completed" || project.currentStatus === "handed_over")) {
      const latestLine = await prisma.opsSubmissionLineItem.findFirst({
        where: {
          projectId,
          completionPercent: { not: null },
          submission: { athleteId: athlete.id },
        },
        orderBy: [{ submission: { submissionDate: "desc" } }, { submission: { updatedAt: "desc" } }],
        select: { id: true },
      });
      if (latestLine) {
        await prisma.opsSubmissionLineItem.update({
          where: { id: latestLine.id },
          data: { completionPercent: REACTIVATION_PROGRESS_PERCENT },
        });
      }
    }

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
