import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePrivateAthleteSession } from "@/lib/private-access";
import { parseDateOnly } from "@/lib/ops-hours";
import { privateAthleteHourlyRateZar, athletePrivateWorkEarnings } from "@/lib/private-athlete-earnings";
import { archivePrivateProjectIfComplete } from "@/lib/private-archive";
import { serializePrivateProject } from "@/lib/private-serialize";
import {
  activePrivateAthleteAssignmentsInclude,
  privateAssignedAthleteSelect,
  whereAthletePrivateProjects,
} from "@/lib/private-project-assignments";

type PhaseChoice = { phaseId: string; label: string };

function phaseChoices(project: {
  phaseGroups?: Array<{ stages: Array<{ phaseId: string; label: string }> }>;
  phases?: Array<{ phaseId: string; label: string }>;
  designStage?: string;
  designStageLabel?: string;
}): PhaseChoice[] {
  const fromGroups = (project.phaseGroups ?? []).flatMap((group) =>
    group.stages.map((stage) => ({ phaseId: stage.phaseId, label: stage.label })),
  );
  if (fromGroups.length > 0) return fromGroups;
  const fromPhases = (project.phases ?? []).map((stage) => ({
    phaseId: stage.phaseId,
    label: stage.label,
  }));
  if (fromPhases.length > 0) return fromPhases;
  if (project.designStage && project.designStageLabel) {
    return [{ phaseId: project.designStage, label: project.designStageLabel }];
  }
  return [];
}

async function assignedProjects(athleteId: string) {
  const rows = await prisma.privateProject.findMany({
    where: {
      AND: [whereAthletePrivateProjects(athleteId), { status: { in: ["active", "on_hold"] } }],
    },
    orderBy: { name: "asc" },
    include: {
      client: {
        select: { id: true, name: true, contactEmail: true, contactPhone: true, slug: true },
      },
      assignedAthlete: { select: privateAssignedAthleteSelect },
      athleteAssignments: activePrivateAthleteAssignmentsInclude,
      customProjectType: { select: { id: true, label: true } },
    },
  });
  return rows.map((row) => serializePrivateProject(row));
}

export async function GET(request: NextRequest) {
  const gate = await requirePrivateAthleteSession(request);
  if (gate instanceof NextResponse) return gate;

  const [projects, logs, earnings] = await Promise.all([
    assignedProjects(gate.athlete.id),
    prisma.privateHourLog.findMany({
      where: { athleteId: gate.athlete.id },
      orderBy: [{ workDate: "desc" }, { createdAt: "asc" }],
      take: 500,
      include: {
        project: { select: { id: true, name: true, client: { select: { name: true } } } },
      },
    }),
    athletePrivateWorkEarnings(gate.athlete.id, gate.athlete),
  ]);

  const days = new Map<
    string,
    {
      date: string;
      totalHours: number;
      entries: Array<{
        id: string;
        projectId: string;
        projectName: string;
        clientName: string;
        designPhaseId: string;
        designPhaseLabel: string;
        hours: number;
        completionPercent: number | null;
        completedSummary: string;
      }>;
    }
  >();

  for (const log of logs) {
    const date = log.workDate.toISOString().slice(0, 10);
    const day = days.get(date) ?? { date, totalHours: 0, entries: [] };
    const hours = Number(log.hours);
    day.totalHours += hours;
    day.entries.push({
      id: log.id,
      projectId: log.projectId,
      projectName: log.project.name,
      clientName: log.project.client.name,
      designPhaseId: log.designPhaseId ?? "",
      designPhaseLabel: log.designPhaseLabel ?? "",
      hours,
      completionPercent: log.completionPercent,
      completedSummary: log.notes ?? "",
    });
    days.set(date, day);
  }

  return NextResponse.json({
    projects: projects.map((project) => ({
      id: project.id,
      name: project.name,
      address: project.address,
      client: { id: project.client.id, name: project.client.name },
      designStage: project.designStage,
      designStageLabel: project.designStageLabel,
      currentDesignPhaseId: project.currentDesignPhaseId,
      progressPercent: project.progressPercent,
      phases: phaseChoices(project),
    })),
    days: Array.from(days.values()),
    monthHours: earnings.monthHours,
    monthEarningsZar: earnings.monthEarningsZar,
    hourlyRateZar: earnings.hourlyRateZar,
  });
}

export async function POST(request: NextRequest) {
  const gate = await requirePrivateAthleteSession(request);
  if (gate instanceof NextResponse) return gate;

  try {
    const body = await request.json();
    const workDate = parseDateOnly(String(body.date || ""));
    const rawEntries = Array.isArray(body.entries) ? body.entries : null;
    if (!workDate) {
      return NextResponse.json({ error: "Choose a date" }, { status: 400 });
    }
    if (!rawEntries || rawEntries.length === 0) {
      return NextResponse.json({ error: "Add at least one entry before saving the daily log." }, { status: 400 });
    }
    if (rawEntries.length > 20) {
      return NextResponse.json({ error: "A day can hold up to 20 entries." }, { status: 400 });
    }

    const projects = await assignedProjects(gate.athlete.id);
    const byId = new Map(projects.map((project) => [project.id, project]));

    const entries: Array<{
      projectId: string;
      designPhaseId: string;
      designPhaseLabel: string;
      hours: number;
      completionPercent: number;
      notes: string | null;
    }> = [];

    let totalHours = 0;
    for (const raw of rawEntries) {
      const projectId = String(raw?.projectId || "").trim();
      const project = byId.get(projectId);
      if (!project) {
        return NextResponse.json({ error: "Select a project assigned to you." }, { status: 400 });
      }
      const hours = Number(raw?.hours);
      if (!Number.isFinite(hours) || hours < 0.25 || hours > 24) {
        return NextResponse.json({ error: "Hours must be between 0.25 and 24." }, { status: 400 });
      }
      totalHours += hours;
      const phaseId = String(raw?.designPhaseId || "").trim();
      const phase = phaseChoices(project).find((choice) => choice.phaseId === phaseId);
      if (!phase) {
        return NextResponse.json({ error: "Choose a design phase for each entry." }, { status: 400 });
      }
      const completion = Number(raw?.completionPercent);
      if (!Number.isFinite(completion) || completion < 0 || completion > 100) {
        return NextResponse.json({ error: "Progress must be between 0 and 100." }, { status: 400 });
      }
      const notes = String(raw?.completedSummary || "").trim();
      if (notes.length > 2000) {
        return NextResponse.json({ error: "What was completed is too long." }, { status: 400 });
      }
      entries.push({
        projectId,
        designPhaseId: phase.phaseId,
        designPhaseLabel: phase.label,
        hours,
        completionPercent: Math.round(completion),
        notes: notes || null,
      });
    }

    if (totalHours > 24) {
      return NextResponse.json({ error: "A day cannot total more than 24 hours." }, { status: 400 });
    }

    const rate = privateAthleteHourlyRateZar(gate.athlete);
    const progressByProject = new Map<string, number>();
    for (const entry of entries) progressByProject.set(entry.projectId, entry.completionPercent);

    await prisma.$transaction(async (tx) => {
      const existing = await tx.privateHourLog.findMany({
        where: { athleteId: gate.athlete.id, workDate },
        select: { projectId: true, hours: true },
      });
      const deltas = new Map<string, number>();
      for (const row of existing) {
        deltas.set(row.projectId, (deltas.get(row.projectId) ?? 0) - Number(row.hours));
      }
      for (const entry of entries) {
        deltas.set(entry.projectId, (deltas.get(entry.projectId) ?? 0) + entry.hours);
      }

      await tx.privateHourLog.deleteMany({
        where: { athleteId: gate.athlete.id, workDate },
      });

      for (const [projectId, hoursDelta] of Array.from(deltas.entries())) {
        if (Math.abs(hoursDelta) < 0.001) continue;
        await tx.privateProject.update({
          where: { id: projectId },
          data: { costZar: { increment: Math.round(rate * hoursDelta * 100) / 100 } },
        });
      }

      await tx.privateHourLog.createMany({
        data: entries.map((entry) => ({
          projectId: entry.projectId,
          athleteId: gate.athlete.id,
          workDate,
          hours: entry.hours,
          notes: entry.notes,
          designPhaseId: entry.designPhaseId,
          designPhaseLabel: entry.designPhaseLabel,
          completionPercent: entry.completionPercent,
        })),
      });

    for (const [projectId, completionPercent] of Array.from(progressByProject.entries())) {
        await tx.privateProject.update({
          where: { id: projectId },
          data: { manualProgressPercent: completionPercent },
        });
      }
    });

    for (const [projectId, completionPercent] of Array.from(progressByProject.entries())) {
      if (completionPercent >= 100) await archivePrivateProjectIfComplete(projectId);
    }

    const earnings = await athletePrivateWorkEarnings(gate.athlete.id, gate.athlete);
    return NextResponse.json({
      ok: true,
      monthHours: earnings.monthHours,
      monthEarningsZar: earnings.monthEarningsZar,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not save the daily log" }, { status: 500 });
  }
}
