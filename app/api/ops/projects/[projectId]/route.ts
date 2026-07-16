import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  isOpsProjectComplexity,
  isOpsProjectPhase,
  isOpsProjectStatus,
} from "@/lib/ops-constants";
import { requireOpsSession } from "@/lib/ops-access";
import { parseDateOnly } from "@/lib/ops-hours";
import { syncProjectAfterOpsUpdate } from "@/lib/planner-project-sync";
import { reactivateProjectOnAthleteReassign, syncProjectProgressForProjects } from "@/lib/sync-project-progress";
import { normalizeAthleteProjectCode } from "@/lib/ops-project-code";
import { validateProjectLeadContactDb } from "@/lib/ops-project-lead";
import { deleteProjectAndSyncSubmissions } from "@/lib/sync-submission-totals";
import { parseProjectDueInput } from "@/lib/project-deadline";
import { serializeOpsProjectRow } from "@/lib/ops-project-serialize";
import {
  activeAthleteAssignmentsInclude,
  applyProjectAthleteAssignments,
  ensureProjectAssignmentRows,
  parseProjectAssignmentInput,
  serializeProjectAssignments,
} from "@/lib/ops-project-assignments";

type RouteContext = { params: Promise<{ projectId: string }> };

function serializeOpsProject(
  project: Parameters<typeof serializeOpsProjectRow>[0] & {
    client: { id: string; name: string };
    assignedAthlete: { id: string; fullName: string; athleteCode: string } | null;
    athleteAssignments?: Array<{
      athleteId: string;
      isPrimary: boolean;
      assignedAt: Date;
      removedAt: Date | null;
      athlete: { id: string; fullName: string; athleteCode: string };
    }>;
    projectLeadContact: { id: string; name: string; email: string | null } | null;
  },
  hoursLogged: number
) {
  return serializeOpsProjectRow(project, {
    clientName: project.client.name,
    assignedAthleteName: project.assignedAthlete?.fullName ?? null,
    assignedAthleteCode: project.assignedAthlete?.athleteCode ?? null,
    assignedAthletes: project.athleteAssignments
      ? serializeProjectAssignments(project.athleteAssignments)
      : [],
    projectLeadContactName: project.projectLeadContact?.name ?? null,
    projectLeadContactEmail: project.projectLeadContact?.email ?? null,
    hoursLogged,
  });
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const gate = await requireOpsSession(_request);
  if (gate instanceof NextResponse) return gate;

  const { projectId } = await context.params;
  await ensureProjectAssignmentRows(projectId).catch(() => {});
  const project = await prisma.opsProject.findUnique({
    where: { id: projectId },
    include: {
      client: { select: { id: true, name: true } },
      assignedAthlete: { select: { id: true, fullName: true, athleteCode: true } },
      athleteAssignments: activeAthleteAssignmentsInclude,
      projectLeadContact: { select: { id: true, name: true, email: true } },
    },
  });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const hoursAgg = await prisma.opsSubmissionLineItem.aggregate({
    where: { projectId },
    _sum: { hoursWorked: true },
  });

  const submissions = await prisma.opsDailySubmission.findMany({
    where: { lineItems: { some: { projectId } } },
    orderBy: { submissionDate: "desc" },
    take: 60,
    include: {
      athlete: { select: { fullName: true, athleteCode: true } },
      lineItems: {
        where: { projectId },
        include: {
          client: { select: { name: true } },
        },
      },
    },
  });

  return NextResponse.json({
    project: serializeOpsProject(project, Number(hoursAgg._sum.hoursWorked ?? 0)),
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
  const gate = await requireOpsSession(request);
  if (gate instanceof NextResponse) return gate;

  const { projectId } = await context.params;
  const existing = await prisma.opsProject.findUnique({ where: { id: projectId } });
  if (!existing) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  try {
    const body = await request.json();
    const data: Record<string, unknown> = {};
    let assignmentUpdate: { athleteIds: string[]; primaryAthleteId: string | null } | null = null;

    const hasAssignmentFields =
      body.assignedAthleteId !== undefined ||
      body.assignedAthleteIds !== undefined ||
      body.primaryAthleteId !== undefined;

    if (hasAssignmentFields) {
      const parsed = parseProjectAssignmentInput(body);
      if ("error" in parsed) {
        return NextResponse.json({ error: parsed.error }, { status: 400 });
      }
      assignmentUpdate = parsed;
    }

    if (body.name != null) {
      const name = String(body.name).trim();
      if (!name) return NextResponse.json({ error: "Project name required" }, { status: 400 });
      data.name = name;
    }
    if (body.projectNumber != null) {
      const projectNumber = normalizeAthleteProjectCode(String(body.projectNumber));
      if (!projectNumber) return NextResponse.json({ error: "Athlete code is required" }, { status: 400 });
      data.projectNumber = projectNumber;
    }
    if (body.projectLeadContactId !== undefined) {
      const cid = body.projectLeadContactId ? String(body.projectLeadContactId).trim() : null;
      const leadError = await validateProjectLeadContactDb(prisma, existing.clientId, cid);
      if (leadError) return NextResponse.json({ error: leadError }, { status: 400 });
      data.projectLeadContactId = cid;
      data.projectLeadAthleteId = null;
    }
    if (body.address !== undefined) data.address = body.address ? String(body.address).trim() : null;
    if (body.projectLead !== undefined) data.projectLead = body.projectLead ? String(body.projectLead).trim() : null;
    if (body.notes !== undefined) data.notes = body.notes ? String(body.notes).trim() : null;
    if (body.progressPercent !== undefined) {
      const pct = body.progressPercent == null ? null : Math.max(0, Math.min(100, Math.round(Number(body.progressPercent))));
      data.progressPercent = pct;
    }

    if (body.complexity != null) {
      const c = String(body.complexity);
      if (!isOpsProjectComplexity(c)) return NextResponse.json({ error: "Invalid complexity" }, { status: 400 });
      data.complexity = c;
    }
    if (body.currentStage != null) {
      const s = String(body.currentStage);
      if (!isOpsProjectPhase(s)) return NextResponse.json({ error: "Invalid stage" }, { status: 400 });
      data.currentStage = s;
    }
    if (body.currentStatus != null) {
      const s = String(body.currentStatus);
      if (!isOpsProjectStatus(s)) return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      data.currentStatus = s;
    }

    if (body.startDate !== undefined) data.startDate = body.startDate ? parseDateOnly(String(body.startDate)) : null;
    if (body.dueDate !== undefined || body.dueAt !== undefined || body.dueTime !== undefined || body.dueAmPm !== undefined) {
      data.dueDate = parseProjectDueInput({
        dueAt: body.dueAt,
        dueDate: body.dueDate,
        dueTime: body.dueTime,
        dueAmPm: body.dueAmPm,
      });
    }
    if (body.handoverDate !== undefined) data.handoverDate = body.handoverDate ? parseDateOnly(String(body.handoverDate)) : null;

    if (body.blockerFlag !== undefined) data.blockerFlag = Boolean(body.blockerFlag);
    if (body.checkInRequested !== undefined) data.checkInRequested = Boolean(body.checkInRequested);

    if (Object.keys(data).length === 0 && !assignmentUpdate) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    let nextPrimaryAthleteId = existing.assignedAthleteId;

    if (assignmentUpdate) {
      if (assignmentUpdate.primaryAthleteId !== existing.assignedAthleteId) {
        const reopen = await reactivateProjectOnAthleteReassign(
          projectId,
          existing.assignedAthleteId,
          assignmentUpdate.primaryAthleteId,
          existing.currentStatus
        );
        if (reopen) {
          data.currentStatus = reopen.currentStatus;
          data.progressPercent = reopen.progressPercent;
          data.completedAt = reopen.completedAt;
          data.deadlineBeatenDays = reopen.deadlineBeatenDays;
          data.deadlineBeatenMinutes = reopen.deadlineBeatenMinutes;
        }
      }

      try {
        const applied = await applyProjectAthleteAssignments(projectId, assignmentUpdate);
        nextPrimaryAthleteId = applied.primaryAthleteId;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Invalid assignment";
        return NextResponse.json({ error: msg }, { status: 400 });
      }
    }

    const projectInclude = {
      client: { select: { id: true, name: true } },
      assignedAthlete: { select: { id: true, fullName: true, athleteCode: true } },
      athleteAssignments: activeAthleteAssignmentsInclude,
      projectLeadContact: { select: { id: true, name: true, email: true } },
    } as const;

    const project =
      Object.keys(data).length > 0
        ? await prisma.opsProject.update({
            where: { id: projectId },
            include: projectInclude,
            data,
          })
        : await prisma.opsProject.findUnique({
            where: { id: projectId },
            include: projectInclude,
          });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    await syncProjectAfterOpsUpdate(
      projectId,
      {
        assignedAthleteId: existing.assignedAthleteId,
        currentStatus: existing.currentStatus,
        name: existing.name,
      },
      {
        assignedAthleteId: nextPrimaryAthleteId,
        currentStatus: project.currentStatus as import("@prisma/client").OpsProjectStatus,
        name: project.name,
      }
    ).catch(() => {});

    await syncProjectProgressForProjects([projectId]).catch(() => {});

    const hoursAgg = await prisma.opsSubmissionLineItem.aggregate({
      where: { projectId },
      _sum: { hoursWorked: true },
    });

    return NextResponse.json({
      project: serializeOpsProject(project, Number(hoursAgg._sum.hoursWorked ?? 0)),
    });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const gate = await requireOpsSession(request);
  if (gate instanceof NextResponse) return gate;

  const { projectId } = await context.params;
  const deleted = await deleteProjectAndSyncSubmissions(projectId);
  if (!deleted) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  return NextResponse.json({ ok: true });
}
