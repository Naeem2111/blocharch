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
import { parseProjectDueInput } from "@/lib/project-deadline";
import { serializeOpsProjectRow } from "@/lib/ops-project-serialize";
import { syncProjectBoardOnAssign } from "@/lib/planner-project-sync";
import { normalizeAthleteProjectCode } from "@/lib/ops-project-code";
import { projectDisplayFields } from "@/lib/project-display";
import { validateProjectLeadContactDb } from "@/lib/ops-project-lead";
import {
  activeAthleteAssignmentsInclude,
  applyProjectAthleteAssignments,
  parseProjectAssignmentInput,
  serializeProjectAssignments,
} from "@/lib/ops-project-assignments";

const ACTIVE_STATUSES = ["completed", "handed_over"] as const;

export async function GET(request: NextRequest) {
  const gate = await requireOpsSession(request);
  if (gate instanceof NextResponse) return gate;

  const scope = request.nextUrl.searchParams.get("scope") || "active";
  const where =
    scope === "all"
      ? {}
      : scope === "archived"
        ? { currentStatus: { in: [...ACTIVE_STATUSES] } }
        : { currentStatus: { notIn: [...ACTIVE_STATUSES] } };

  const projects = await prisma.opsProject.findMany({
    where,
    orderBy: [{ dueDate: "asc" }, { name: "asc" }],
    include: {
      client: { select: { id: true, name: true, logoUrl: true, logoBgColor: true, logoTextTone: true } },
      assignedAthlete: { select: { id: true, fullName: true, athleteCode: true } },
      athleteAssignments: activeAthleteAssignmentsInclude,
      projectLeadContact: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json({
    projects: projects.map((p) =>
      serializeOpsProjectRow(p, {
        clientName: p.client.name,
        clientLogoUrl: p.client.logoUrl,
        clientLogoBgColor: p.client.logoBgColor,
        clientLogoTextTone: p.client.logoTextTone,
        assignedAthleteName: p.assignedAthlete?.fullName ?? null,
        projectLeadContactName: p.projectLeadContact?.name ?? null,
        projectLeadContactEmail: p.projectLeadContact?.email ?? null,
        athleteCode: p.assignedAthlete?.athleteCode ?? null,
        assignedAthletes: serializeProjectAssignments(p.athleteAssignments),
        updatedAt: p.updatedAt.toISOString(),
      })
    ),
  });
}

export async function POST(request: NextRequest) {
  const gate = await requireOpsSession(request);
  if (gate instanceof NextResponse) return gate;

  try {
    const body = await request.json();
    const clientId = String(body.clientId || "").trim();
    let name = String(body.name || "").trim();

    const hasMulti =
      body.assignedAthleteIds !== undefined || body.primaryAthleteId !== undefined;
    let athleteIds: string[] = [];
    let assignedAthleteId: string | null = null;

    if (hasMulti) {
      const parsed = parseProjectAssignmentInput(body);
      if ("error" in parsed) {
        return NextResponse.json({ error: parsed.error }, { status: 400 });
      }
      athleteIds = parsed.athleteIds;
      assignedAthleteId = parsed.primaryAthleteId;
    } else {
      assignedAthleteId = body.assignedAthleteId
        ? String(body.assignedAthleteId).trim()
        : null;
      athleteIds = assignedAthleteId ? [assignedAthleteId] : [];
    }

    const projectLeadContactId = body.projectLeadContactId
      ? String(body.projectLeadContactId).trim()
      : null;

    const complexity = isOpsProjectComplexity(String(body.complexity || ""))
      ? body.complexity
      : "medium";
    const currentStage = isOpsProjectPhase(String(body.currentStage || ""))
      ? body.currentStage
      : "survey_conversion";
    const currentStatus = isOpsProjectStatus(String(body.currentStatus || ""))
      ? body.currentStatus
      : "not_started";

    const client = await prisma.opsClient.findUnique({ where: { id: clientId } });
    if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

    const athlete = assignedAthleteId
      ? await prisma.opsAthlete.findUnique({ where: { id: assignedAthleteId } })
      : null;
    if (assignedAthleteId && !athlete) {
      return NextResponse.json({ error: "Athlete not found" }, { status: 404 });
    }

    const projectNumber = normalizeAthleteProjectCode(
      String(body.projectNumber || athlete?.athleteCode || "")
    );

    if (!clientId || !assignedAthleteId || !projectNumber) {
      return NextResponse.json(
        { error: "Client, assigned athlete, and athlete code are required" },
        { status: 400 }
      );
    }

    const address = body.address ? String(body.address).trim() : null;
    if (!name && address) {
      name = address;
    }
    if (!name) {
      return NextResponse.json({ error: "Project title is required" }, { status: 400 });
    }

    const leadError = await validateProjectLeadContactDb(prisma, clientId, projectLeadContactId);
    if (leadError) return NextResponse.json({ error: leadError }, { status: 400 });

    const project = await prisma.opsProject.create({
      data: {
        clientId,
        assignedAthleteId,
        projectLeadContactId,
        projectLeadAthleteId: null,
        name,
        projectNumber,
        address,
        projectLead: body.projectLead ? String(body.projectLead).trim() : null,
        complexity,
        currentStage,
        currentStatus,
        startDate: body.startDate ? parseDateOnly(String(body.startDate)) : null,
        dueDate: parseProjectDueInput(body),
        handoverDate: body.handoverDate ? parseDateOnly(String(body.handoverDate)) : null,
        notes: body.notes ? String(body.notes).trim() : null,
      },
    });

    const idsToAssign = athleteIds.length > 0 ? athleteIds : [];
    if (idsToAssign.length > 0) {
      await applyProjectAthleteAssignments(project.id, {
        athleteIds: idsToAssign,
        primaryAthleteId: assignedAthleteId,
      }).catch(() => {});
    }

    const { displayTitle } = projectDisplayFields(project);
    return NextResponse.json({ project: { id: project.id, name: project.name, displayTitle } }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
