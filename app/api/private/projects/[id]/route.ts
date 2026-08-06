import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePrivateOpsSession } from "@/lib/private-access";
import { isPrivateDesignStage } from "@/lib/private-constants";
import { PRIVATE_STAGE_LABELS } from "@/lib/private-constants";
import { serializePrivateProject } from "@/lib/private-serialize";
import { parseDateOnly } from "@/lib/ops-hours";

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
  updates: { orderBy: { occurredAt: "desc" as const }, take: 20 },
  actionItems: { orderBy: { createdAt: "desc" as const } },
  hourLogs: {
    orderBy: { workDate: "desc" as const },
    take: 50,
    include: { athlete: { select: { id: true, fullName: true } } },
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
        return NextResponse.json({ error: "Invalid design stage" }, { status: 400 });
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
      data.assignedAthleteId = body.assignedAthleteId
        ? String(body.assignedAthleteId)
        : null;
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
    if (clientName !== undefined && !clientName) {
      return NextResponse.json({ error: "Client name is required" }, { status: 400 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (clientName !== undefined) {
        await tx.privateClient.update({
          where: { id: existing.clientId },
          data: { name: clientName },
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
