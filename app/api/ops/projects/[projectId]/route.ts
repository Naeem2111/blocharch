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
import {
  normalizeAthleteProjectCode,
  validateAthleteProjectCodeDb,
} from "@/lib/ops-project-code";
import type { OpsProjectStatus } from "@prisma/client";

type RouteContext = { params: Promise<{ projectId: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const gate = await requireOpsSession(request);
  if (gate instanceof NextResponse) return gate;

  const { projectId } = await context.params;
  const existing = await prisma.opsProject.findUnique({ where: { id: projectId } });
  if (!existing) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  try {
    const body = await request.json();
    const data: Record<string, unknown> = {};

    if (body.name != null) {
      const name = String(body.name).trim();
      if (!name) return NextResponse.json({ error: "Project name required" }, { status: 400 });
      data.name = name;
    }
    if (body.assignedAthleteId !== undefined) {
      const aid = body.assignedAthleteId ? String(body.assignedAthleteId).trim() : null;
      if (aid) {
        const athlete = await prisma.opsAthlete.findUnique({ where: { id: aid } });
        if (!athlete) return NextResponse.json({ error: "Athlete not found" }, { status: 404 });
      }
      data.assignedAthleteId = aid;
    }
    if (body.projectNumber != null) {
      const projectNumber = normalizeAthleteProjectCode(String(body.projectNumber));
      if (!projectNumber) return NextResponse.json({ error: "Athlete code is required" }, { status: 400 });
      data.projectNumber = projectNumber;
    }
    if (body.projectLeadAthleteId !== undefined) {
      const lid = body.projectLeadAthleteId ? String(body.projectLeadAthleteId).trim() : null;
      if (lid) {
        const leadAthlete = await prisma.opsAthlete.findUnique({ where: { id: lid } });
        if (!leadAthlete) return NextResponse.json({ error: "Project lead not found" }, { status: 404 });
      }
      data.projectLeadAthleteId = lid;
    }
    if (body.address !== undefined) data.address = body.address ? String(body.address).trim() : null;
    if (body.projectLead !== undefined) data.projectLead = body.projectLead ? String(body.projectLead).trim() : null;
    if (body.notes !== undefined) data.notes = body.notes ? String(body.notes).trim() : null;

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
    if (body.dueDate !== undefined) data.dueDate = body.dueDate ? parseDateOnly(String(body.dueDate)) : null;
    if (body.handoverDate !== undefined) data.handoverDate = body.handoverDate ? parseDateOnly(String(body.handoverDate)) : null;

    if (body.blockerFlag !== undefined) data.blockerFlag = Boolean(body.blockerFlag);
    if (body.checkInRequested !== undefined) data.checkInRequested = Boolean(body.checkInRequested);

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const nextClientId = existing.clientId;
    const nextProjectNumber =
      typeof data.projectNumber === "string" ? data.projectNumber : existing.projectNumber;
    const nextAthleteId =
      data.assignedAthleteId !== undefined
        ? (data.assignedAthleteId as string | null)
        : existing.assignedAthleteId;

    const codeError = await validateAthleteProjectCodeDb(prisma, {
      clientId: nextClientId,
      code: nextProjectNumber,
      assignedAthleteId: nextAthleteId,
      excludeProjectId: projectId,
    });
    if (codeError) return NextResponse.json({ error: codeError }, { status: 400 });

    const project = await prisma.opsProject.update({
      where: { id: projectId },
      data,
      include: {
        client: { select: { id: true, name: true } },
        assignedAthlete: { select: { id: true, fullName: true, athleteCode: true } },
        projectLeadAthlete: { select: { id: true, fullName: true, athleteCode: true } },
      },
    });

    await syncProjectAfterOpsUpdate(
      projectId,
      {
        assignedAthleteId: existing.assignedAthleteId,
        currentStatus: existing.currentStatus,
        name: existing.name,
      },
      {
        assignedAthleteId: project.assignedAthleteId,
        currentStatus: project.currentStatus as OpsProjectStatus,
        name: project.name,
      }
    ).catch(() => {});

    return NextResponse.json({
      project: {
        id: project.id,
        clientId: project.clientId,
        clientName: project.client.name,
        assignedAthleteId: project.assignedAthleteId,
        assignedAthleteName: project.assignedAthlete?.fullName ?? null,
        projectLeadAthleteId: project.projectLeadAthleteId,
        projectLeadAthleteName: project.projectLeadAthlete?.fullName ?? null,
        name: project.name,
        projectNumber: project.projectNumber,
        address: project.address,
        projectLead: project.projectLead,
        complexity: project.complexity,
        startDate: project.startDate?.toISOString().slice(0, 10) ?? null,
        dueDate: project.dueDate?.toISOString().slice(0, 10) ?? null,
        handoverDate: project.handoverDate?.toISOString().slice(0, 10) ?? null,
        currentStage: project.currentStage,
        currentStatus: project.currentStatus,
        notes: project.notes,
        blockerFlag: project.blockerFlag,
        checkInRequested: project.checkInRequested,
      },
    });
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && err.code === "P2002") {
      return NextResponse.json({ error: "Project number already exists for this client" }, { status: 400 });
    }
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const gate = await requireOpsSession(request);
  if (gate instanceof NextResponse) return gate;

  const { projectId } = await context.params;
  const existing = await prisma.opsProject.findUnique({ where: { id: projectId } });
  if (!existing) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  await prisma.opsProject.delete({ where: { id: projectId } });
  return NextResponse.json({ ok: true });
}
