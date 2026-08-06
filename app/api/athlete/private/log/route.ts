import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePrivateAthleteSession } from "@/lib/private-access";
import { parseDateOnly } from "@/lib/ops-hours";
import { privateAthleteHourlyRateZar } from "@/lib/private-athlete-earnings";
import { resolvePrivateProgressPercent } from "@/lib/private-progress";

export async function GET(request: NextRequest) {
  const gate = await requirePrivateAthleteSession(request);
  if (gate instanceof NextResponse) return gate;

  const logs = await prisma.privateHourLog.findMany({
    where: { athleteId: gate.athlete.id },
    orderBy: [{ workDate: "desc" }, { createdAt: "desc" }],
    take: 40,
    include: {
      project: { select: { id: true, name: true, address: true } },
    },
  });

  const projects = await prisma.privateProject.findMany({
    where: {
      assignedAthleteId: gate.athlete.id,
      status: { in: ["active", "on_hold"] },
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      address: true,
      designStage: true,
      stageStartedAt: true,
      manualProgressPercent: true,
    },
  });

  return NextResponse.json({
    projects: projects.map((p) => ({
      id: p.id,
      name: p.name,
      address: p.address,
      progressPercent: resolvePrivateProgressPercent({
        designStage: p.designStage,
        stageStartedAt: p.stageStartedAt,
        manualProgressPercent: p.manualProgressPercent,
      }),
    })),
    logs: logs.map((l) => ({
      id: l.id,
      projectId: l.projectId,
      projectName: l.project.name,
      workDate: l.workDate.toISOString().slice(0, 10),
      hours: Number(l.hours),
      notes: l.notes,
    })),
  });
}

export async function POST(request: NextRequest) {
  const gate = await requirePrivateAthleteSession(request);
  if (gate instanceof NextResponse) return gate;

  try {
    const body = await request.json();
    const projectId = String(body.projectId || "").trim();
    const hours = Number(body.hours);
    const notes = body.notes ? String(body.notes).trim() : null;
    const workDate = body.date
      ? parseDateOnly(String(body.date))
      : parseDateOnly(new Date().toISOString().slice(0, 10));

    if (!projectId) {
      return NextResponse.json({ error: "Project is required" }, { status: 400 });
    }
    if (!Number.isFinite(hours) || hours <= 0 || hours > 24) {
      return NextResponse.json({ error: "Hours must be between 0 and 24" }, { status: 400 });
    }
    if (!workDate) {
      return NextResponse.json({ error: "Invalid date" }, { status: 400 });
    }

    const project = await prisma.privateProject.findFirst({
      where: {
        id: projectId,
        assignedAthleteId: gate.athlete.id,
        status: { in: ["active", "on_hold"] },
      },
    });
    if (!project) {
      return NextResponse.json({ error: "Project not found or not assigned to you" }, { status: 404 });
    }

    const rawProgress = body.completionPercent ?? body.progressPercent;
    let manualProgressPercent: number | undefined;
    if (rawProgress !== undefined && rawProgress !== null && rawProgress !== "") {
      const n = Number(rawProgress);
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        return NextResponse.json({ error: "Progress must be between 0 and 100" }, { status: 400 });
      }
      manualProgressPercent = Math.round(n);
    }

    const hourlyZar = privateAthleteHourlyRateZar(gate.athlete);
    const log = await prisma.$transaction(async (tx) => {
      const created = await tx.privateHourLog.create({
        data: {
          projectId,
          athleteId: gate.athlete.id,
          workDate,
          hours,
          notes,
        },
      });
      await tx.privateProject.update({
        where: { id: projectId },
        data: {
          costZar: { increment: hourlyZar * hours },
          ...(manualProgressPercent !== undefined ? { manualProgressPercent } : {}),
        },
      });
      return created;
    });

    return NextResponse.json(
      {
        log: {
          id: log.id,
          projectId: log.projectId,
          workDate: log.workDate.toISOString().slice(0, 10),
          hours: Number(log.hours),
          notes: log.notes,
        },
      },
      { status: 201 },
    );
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not log hours" }, { status: 500 });
  }
}
