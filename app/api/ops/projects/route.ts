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
import { syncProjectBoardOnAssign } from "@/lib/planner-project-sync";
import {
  normalizeAthleteProjectCode,
  validateAthleteProjectCodeDb,
} from "@/lib/ops-project-code";

export async function GET(request: NextRequest) {
  const gate = await requireOpsSession(request);
  if (gate instanceof NextResponse) return gate;

  const projects = await prisma.opsProject.findMany({
    orderBy: [{ dueDate: "asc" }, { name: "asc" }],
    include: {
      client: { select: { id: true, name: true, logoUrl: true, logoBgColor: true, logoTextTone: true } },
      assignedAthlete: { select: { id: true, fullName: true, athleteCode: true } },
      projectLeadAthlete: { select: { id: true, fullName: true, athleteCode: true } },
    },
  });

  return NextResponse.json({
    projects: projects.map((p) => ({
      id: p.id,
      clientId: p.clientId,
      clientName: p.client.name,
      clientLogoUrl: p.client.logoUrl,
      clientLogoBgColor: p.client.logoBgColor,
      clientLogoTextTone: p.client.logoTextTone,
      assignedAthleteId: p.assignedAthleteId,
      assignedAthleteName: p.assignedAthlete?.fullName ?? null,
      projectLeadAthleteId: p.projectLeadAthleteId,
      projectLeadAthleteName: p.projectLeadAthlete?.fullName ?? null,
      athleteCode: p.assignedAthlete?.athleteCode ?? null,
      name: p.name,
      projectNumber: p.projectNumber,
      address: p.address,
      projectLead: p.projectLead,
      complexity: p.complexity,
      startDate: p.startDate?.toISOString().slice(0, 10) ?? null,
      dueDate: p.dueDate?.toISOString().slice(0, 10) ?? null,
      handoverDate: p.handoverDate?.toISOString().slice(0, 10) ?? null,
      currentStage: p.currentStage,
      currentStatus: p.currentStatus,
      progressPercent: p.progressPercent,
      notes: p.notes,
      blockerFlag: p.blockerFlag,
      checkInRequested: p.checkInRequested,
      updatedAt: p.updatedAt.toISOString(),
    })),
  });
}

export async function POST(request: NextRequest) {
  const gate = await requireOpsSession(request);
  if (gate instanceof NextResponse) return gate;

  try {
    const body = await request.json();
    const clientId = String(body.clientId || "").trim();
    const name = String(body.name || "").trim();
    const projectNumber = normalizeAthleteProjectCode(String(body.projectNumber || ""));
    const assignedAthleteId = body.assignedAthleteId ? String(body.assignedAthleteId).trim() : null;

    const projectLeadAthleteId = body.projectLeadAthleteId
      ? String(body.projectLeadAthleteId).trim()
      : null;

    if (!clientId || !name || !assignedAthleteId || !projectNumber) {
      return NextResponse.json({ error: "Client, name, athlete, and athlete code are required" }, { status: 400 });
    }

    const client = await prisma.opsClient.findUnique({ where: { id: clientId } });
    if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

    const athlete = await prisma.opsAthlete.findUnique({ where: { id: assignedAthleteId } });
    if (!athlete) return NextResponse.json({ error: "Athlete not found" }, { status: 404 });

    if (projectLeadAthleteId) {
      const leadAthlete = await prisma.opsAthlete.findUnique({ where: { id: projectLeadAthleteId } });
      if (!leadAthlete) return NextResponse.json({ error: "Project lead not found" }, { status: 404 });
    }

    const codeError = await validateAthleteProjectCodeDb(prisma, {
      clientId,
      code: projectNumber,
      assignedAthleteId,
    });
    if (codeError) return NextResponse.json({ error: codeError }, { status: 400 });

    const complexity = isOpsProjectComplexity(String(body.complexity || ""))
      ? body.complexity
      : "medium";
    const currentStage = isOpsProjectPhase(String(body.currentStage || ""))
      ? body.currentStage
      : "existing_drawings";
    const currentStatus = isOpsProjectStatus(String(body.currentStatus || ""))
      ? body.currentStatus
      : "not_started";

    const project = await prisma.opsProject.create({
      data: {
        clientId,
        assignedAthleteId,
        projectLeadAthleteId,
        name,
        projectNumber,
        address: body.address ? String(body.address).trim() : null,
        projectLead: body.projectLead ? String(body.projectLead).trim() : null,
        complexity,
        currentStage,
        currentStatus,
        startDate: body.startDate ? parseDateOnly(String(body.startDate)) : null,
        dueDate: body.dueDate ? parseDateOnly(String(body.dueDate)) : null,
        handoverDate: body.handoverDate ? parseDateOnly(String(body.handoverDate)) : null,
        notes: body.notes ? String(body.notes).trim() : null,
      },
    });

    if (assignedAthleteId) {
      await syncProjectBoardOnAssign(project.id).catch(() => {});
    }

    return NextResponse.json({ project: { id: project.id, name: project.name } }, { status: 201 });
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && err.code === "P2002") {
      return NextResponse.json({ error: "This athlete code is already used for this client" }, { status: 400 });
    }
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
