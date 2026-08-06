import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePrivateOpsSession } from "@/lib/private-access";
import { isPrivateDesignStage } from "@/lib/private-constants";
import { PRIVATE_STAGE_LABELS } from "@/lib/private-constants";
import { serializePrivateProject } from "@/lib/private-serialize";
import { parseDateOnly } from "@/lib/ops-hours";
import { resolveProjectTypeInput } from "@/lib/private-project-types";
import {
  parsePhaseSplitMap,
  validatePhaseSplitMap,
  defaultPhaseSplits,
} from "@/lib/private-phase-splits";
import {
  parsePhaseStructure,
  validatePhaseStructure,
  defaultPhaseStructure,
} from "@/lib/private-phase-structure";

const projectInclude = {
  client: {
    select: {
      id: true,
      name: true,
      contactEmail: true,
      contactPhone: true,
      slug: true,
    },
  },
  assignedAthlete: {
    select: {
      id: true,
      fullName: true,
      athleteCode: true,
      privateWeeklyCapHours: true,
    },
  },
  customProjectType: {
    select: { id: true, label: true },
  },
  updates: { orderBy: { occurredAt: "desc" as const }, take: 20 },
  actionItems: { orderBy: { createdAt: "desc" as const } },
  hourLogs: {
    orderBy: { workDate: "desc" as const },
    take: 50,
    include: { athlete: { select: { id: true, fullName: true } } },
  },
  expenses: {
    select: { designStage: true, amountZar: true },
  },
};

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const gate = await requirePrivateOpsSession(request);
  if (gate instanceof NextResponse) return gate;

  const project = await prisma.privateProject.findUnique({
    where: { id: params.id },
    include: projectInclude,
  });
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const hoursLife = await prisma.privateHourLog.aggregate({
    where: { projectId: project.id },
    _sum: { hours: true },
  });

  return NextResponse.json({
    project: serializePrivateProject(project, {
      hoursLifeToDate: Number(hoursLife._sum.hours ?? 0),
      openActionTitle:
        project.actionItems.find((a) => !a.completedAt && a.clientFacing)?.title ?? null,
      includeExpenseRecords: true,
    }),
    updates: project.updates.map((u) => ({
      id: u.id,
      title: u.title,
      body: u.body,
      clientVisible: u.clientVisible,
      occurredAt: u.occurredAt.toISOString().slice(0, 10),
    })),
    actionItems: project.actionItems.map((a) => ({
      id: a.id,
      title: a.title,
      clientFacing: a.clientFacing,
      completedAt: a.completedAt?.toISOString() ?? null,
    })),
    hourLogs: project.hourLogs.map((l) => ({
      id: l.id,
      workDate: l.workDate.toISOString().slice(0, 10),
      hours: Number(l.hours),
      notes: l.notes,
      athleteName: l.athlete.fullName,
    })),
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const gate = await requirePrivateOpsSession(request);
  if (gate instanceof NextResponse) return gate;

  const existing = await prisma.privateProject.findUnique({ where: { id: params.id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const body = await request.json();
    const data: Record<string, unknown> = {};

    if (body.designStage !== undefined) {
      if (!isPrivateDesignStage(String(body.designStage))) {
        return NextResponse.json({ error: "Invalid design phase" }, { status: 400 });
      }
      if (body.designStage !== existing.designStage) {
        data.designStage = body.designStage;
        data.stageStartedAt = new Date();
        if (body.designStage === "council_approved") {
          data.status = "completed";
          data.completedAt = new Date();
          data.handoverOutcome = body.handoverOutcome
            ? String(body.handoverOutcome)
            : "Approved on schedule";
        }
      }
    }
    if (body.stageNotes !== undefined) data.stageNotes = String(body.stageNotes || "") || null;
    if (body.assignedAthleteId !== undefined) {
      const athleteId = body.assignedAthleteId ? String(body.assignedAthleteId) : null;
      if (athleteId) {
        const athlete = await prisma.opsAthlete.findUnique({ where: { id: athleteId } });
        if (!athlete) {
          return NextResponse.json({ error: "Assigned athlete not found" }, { status: 400 });
        }
      }
      data.assignedAthleteId = athleteId;
    }
    if (body.feeZar !== undefined) data.feeZar = Number(body.feeZar);
    if (body.costZar !== undefined) data.costZar = Number(body.costZar);
    if (body.outOfScopeFlag !== undefined) data.outOfScopeFlag = Boolean(body.outOfScopeFlag);
    if (body.outOfScopeBilledZar !== undefined) {
      data.outOfScopeBilledZar = Number(body.outOfScopeBilledZar);
    }
    if (body.councilSubmittedAt !== undefined) {
      data.councilSubmittedAt = body.councilSubmittedAt
        ? parseDateOnly(String(body.councilSubmittedAt))
        : null;
    }
    if (body.briefReceivedAt !== undefined) {
      data.briefReceivedAt = body.briefReceivedAt
        ? parseDateOnly(String(body.briefReceivedAt))
        : null;
    }
    if (body.manualProgressPercent !== undefined) {
      if (body.manualProgressPercent === null || body.manualProgressPercent === "") {
        data.manualProgressPercent = null;
      } else {
        const n = Number(body.manualProgressPercent);
        if (!Number.isFinite(n) || n < 0 || n > 100) {
          return NextResponse.json({ error: "Progress must be between 0 and 100" }, { status: 400 });
        }
        data.manualProgressPercent = Math.round(n);
      }
    }
    if (body.projectType !== undefined) {
      const typeResolved = await resolveProjectTypeInput(body);
      if (!typeResolved.ok) {
        return NextResponse.json({ error: typeResolved.error }, { status: 400 });
      }
      data.projectType = typeResolved.projectType;
      data.customProjectTypeId = typeResolved.customProjectTypeId;
    }
    if (body.phaseFeePercents !== undefined) {
      const map = parsePhaseSplitMap(body.phaseFeePercents);
      if (!map) {
        return NextResponse.json({ error: "Invalid fee splits" }, { status: 400 });
      }
      const check = validatePhaseSplitMap(map);
      if (!check.ok) {
        return NextResponse.json(
          { error: `Fee splits must total 100% (currently ${check.sum}%)` },
          { status: 400 },
        );
      }
      data.phaseFeePercents = map;
    }
    if (body.phaseStructure !== undefined) {
      const structure = parsePhaseStructure(body.phaseStructure);
      if (!structure) {
        return NextResponse.json({ error: "Invalid stage structure" }, { status: 400 });
      }
      const check = validatePhaseStructure(structure);
      if (!check.ok) {
        return NextResponse.json({ error: check.error }, { status: 400 });
      }
      data.phaseStructure = structure;
    }
    if (body.status !== undefined) data.status = String(body.status);
    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (!name) {
        return NextResponse.json({ error: "Project name is required" }, { status: 400 });
      }
      data.name = name;
    }
    if (body.address !== undefined) {
      data.address = String(body.address || "").trim() || null;
    } else if (body.name !== undefined && existing.address === existing.name) {
      data.address = data.name;
    }

    const clientName =
      body.clientName !== undefined ? String(body.clientName).trim() : undefined;
    const clientContactEmail =
      body.clientContactEmail !== undefined
        ? String(body.clientContactEmail || "").trim() || null
        : undefined;
    const clientContactPhone =
      body.clientContactPhone !== undefined
        ? String(body.clientContactPhone || "").trim() || null
        : undefined;
    if (clientName !== undefined && !clientName) {
      return NextResponse.json({ error: "Client name is required" }, { status: 400 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (
        clientName !== undefined ||
        clientContactEmail !== undefined ||
        clientContactPhone !== undefined
      ) {
        await tx.privateClient.update({
          where: { id: existing.clientId },
          data: {
            ...(clientName !== undefined ? { name: clientName } : {}),
            ...(clientContactEmail !== undefined ? { contactEmail: clientContactEmail } : {}),
            ...(clientContactPhone !== undefined ? { contactPhone: clientContactPhone } : {}),
          },
        });
      }

      const project = await tx.privateProject.update({
        where: { id: params.id },
        data,
        include: {
          client: {
            select: {
              id: true,
              name: true,
              contactEmail: true,
              contactPhone: true,
              slug: true,
            },
          },
          assignedAthlete: {
            select: {
              id: true,
              fullName: true,
              athleteCode: true,
              privateWeeklyCapHours: true,
            },
          },
          customProjectType: { select: { id: true, label: true } },
        },
      });

      if (data.designStage && data.designStage !== existing.designStage) {
        const label =
          PRIVATE_STAGE_LABELS[data.designStage as keyof typeof PRIVATE_STAGE_LABELS];
        await tx.privateProjectUpdate.create({
          data: {
            projectId: project.id,
            title: label,
            body:
              data.designStage === "council_approved"
                ? "Design approved — construction is the next, separate phase."
                : `Moved to ${label}.`,
            clientVisible: true,
            occurredAt: new Date(),
          },
        });
      }

      return project;
    });

    return NextResponse.json({ project: serializePrivateProject(updated) });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not update project" }, { status: 500 });
  }
}
