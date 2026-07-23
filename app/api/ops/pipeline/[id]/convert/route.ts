import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  isOpsProjectComplexity,
  isOpsProjectPhase,
  isOpsProjectStatus,
} from "@/lib/ops-constants";
import { requireOpsPipelineSession } from "@/lib/ops-access";
import { parseDateOnly } from "@/lib/ops-hours";
import { parseProjectDueInput } from "@/lib/project-deadline";
import { serializeOpsProjectRow } from "@/lib/ops-project-serialize";
import { syncProjectBoardOnAssign } from "@/lib/planner-project-sync";
import { normalizeAthleteProjectCode } from "@/lib/ops-project-code";
import { projectDisplayFields } from "@/lib/project-display";
import {
  applyProjectAthleteAssignments,
  parseProjectAssignmentInput,
} from "@/lib/ops-project-assignments";

type RouteContext = { params: Promise<{ id: string }> };

/** Promote a pipeline item to a live OpsProject. */
export async function POST(request: NextRequest, context: RouteContext) {
  const gate = await requireOpsPipelineSession(request);
  if (gate instanceof NextResponse) return gate;

  const { id } = await context.params;
  const pipeline = await prisma.opsPipelineProject.findUnique({
    where: { id },
    include: { client: { select: { id: true, name: true } } },
  });
  if (!pipeline) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (pipeline.convertedAt) {
    return NextResponse.json({ error: "Already converted to a project" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const parsed = parseProjectAssignmentInput(body);
    if ("error" in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const { athleteIds, primaryAthleteId } = parsed;
    if (!primaryAthleteId) {
      return NextResponse.json({ error: "Select at least one assigned athlete" }, { status: 400 });
    }

    const athlete = await prisma.opsAthlete.findUnique({ where: { id: primaryAthleteId } });
    if (!athlete) return NextResponse.json({ error: "Athlete not found" }, { status: 404 });

    const projectNumber = normalizeAthleteProjectCode(
      String(body.projectNumber || athlete.athleteCode || "")
    );
    if (!projectNumber) {
      return NextResponse.json({ error: "Project number / athlete code is required" }, { status: 400 });
    }

    const complexity = isOpsProjectComplexity(String(body.complexity || "")) ? body.complexity : "medium";
    const stageFromBody = String(body.currentStage || "").trim();
    const currentStage =
      (stageFromBody && isOpsProjectPhase(stageFromBody) ? stageFromBody : null) ??
      pipeline.expectedStage ??
      "survey_conversion";
    const currentStatus = isOpsProjectStatus(String(body.currentStatus || ""))
      ? body.currentStatus
      : "not_started";

    const startDate = body.startDate
      ? parseDateOnly(String(body.startDate))
      : pipeline.targetStartDate;
    const dueDate =
      body.dueDate || body.dueTime
        ? parseProjectDueInput(body)
        : pipeline.targetDueDate;

    const project = await prisma.$transaction(async (tx) => {
      const created = await tx.opsProject.create({
        data: {
          clientId: pipeline.clientId,
          assignedAthleteId: primaryAthleteId,
          name: pipeline.name,
          projectNumber,
          address: pipeline.address,
          complexity,
          currentStage,
          currentStatus,
          startDate,
          dueDate,
          clientDescription: pipeline.description,
          notes: pipeline.notes,
        },
      });

      await tx.opsPipelineProject.update({
        where: { id: pipeline.id },
        data: {
          convertedProjectId: created.id,
          convertedAt: new Date(),
        },
      });

      return created;
    });

    if (athleteIds.length > 0) {
      await applyProjectAthleteAssignments(project.id, {
        athleteIds,
        primaryAthleteId,
      }).catch(() => {});
    }

    await syncProjectBoardOnAssign(project.id).catch(() => {});

    const full = await prisma.opsProject.findUnique({
      where: { id: project.id },
      include: {
        client: { select: { name: true, logoUrl: true, logoBgColor: true, logoTextTone: true } },
        assignedAthlete: { select: { fullName: true, athleteCode: true } },
      },
    });

    const { displayTitle } = projectDisplayFields(project);
    return NextResponse.json({
      project: full
        ? serializeOpsProjectRow(full, {
            clientName: full.client.name,
            clientLogoUrl: full.client.logoUrl,
            clientLogoBgColor: full.client.logoBgColor,
            clientLogoTextTone: full.client.logoTextTone,
            assignedAthleteName: full.assignedAthlete?.fullName ?? null,
            athleteCode: full.assignedAthlete?.athleteCode ?? null,
          })
        : { id: project.id, name: project.name, displayTitle },
      pipelineId: pipeline.id,
    });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
