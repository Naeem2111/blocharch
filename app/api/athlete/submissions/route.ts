import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { OpsProjectPhase, OpsTaskType, OpsUrgencyStatus } from "@prisma/client";
import {
  isOpsProjectPhase,
  isOpsTaskType,
  isOpsUrgencyStatus,
} from "@/lib/ops-constants";
import {
  athleteMonthlySummary,
  requireAthletePortalSession,
} from "@/lib/ops-access";
import { computeMonthlyHoursSummary, dateOnlyUtc, parseDateOnly } from "@/lib/ops-hours";

type LineItemInput = {
  clientId: string;
  projectId: string;
  projectPhase: OpsProjectPhase;
  taskType: OpsTaskType;
  hoursWorked: number;
  completionPercent?: number | null;
  urgencyStatus?: OpsUrgencyStatus;
  completedSummary?: string | null;
  blockerFlag?: boolean;
  blockerNote?: string | null;
  notes?: string | null;
};

function parseLineItems(raw: unknown): LineItemInput[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const items: LineItemInput[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") return null;
    const o = row as Record<string, unknown>;
    const hoursWorked = Number(o.hoursWorked);
    if (!Number.isFinite(hoursWorked) || hoursWorked <= 0 || hoursWorked > 24) return null;
    const projectPhase = String(o.projectPhase || "");
    const taskType = String(o.taskType || "");
    if (!isOpsProjectPhase(projectPhase) || !isOpsTaskType(taskType)) return null;
    const urgency = String(o.urgencyStatus || "normal");
    items.push({
      clientId: String(o.clientId || "").trim(),
      projectId: String(o.projectId || "").trim(),
      projectPhase,
      taskType,
      hoursWorked,
      completionPercent: o.completionPercent != null ? Number(o.completionPercent) : null,
      urgencyStatus: isOpsUrgencyStatus(urgency) ? urgency : "normal",
      completedSummary: o.completedSummary ? String(o.completedSummary) : null,
      blockerFlag: Boolean(o.blockerFlag),
      blockerNote: o.blockerNote ? String(o.blockerNote) : null,
      notes: o.notes ? String(o.notes) : null,
    });
  }
  return items;
}

export async function GET(request: NextRequest) {
  const gate = await requireAthletePortalSession(request);
  if (gate instanceof NextResponse) return gate;
  const { athlete } = gate;

  const submissions = await prisma.opsDailySubmission.findMany({
    where: { athleteId: athlete.id },
    orderBy: { submissionDate: "desc" },
    take: 30,
    include: {
      lineItems: {
        include: {
          project: { select: { name: true, projectNumber: true } },
          client: { select: { name: true } },
        },
      },
    },
  });

  return NextResponse.json({
    submissions: submissions.map((s) => ({
      id: s.id,
      submissionDate: s.submissionDate.toISOString().slice(0, 10),
      wellbeingScore: s.wellbeingScore,
      checkInRequested: s.checkInRequested,
      dailyNote: s.dailyNote,
      totalHours: Number(s.totalHours),
      lockedAt: s.lockedAt?.toISOString() ?? null,
      lineItems: s.lineItems.map((li) => ({
        id: li.id,
        clientName: li.client.name,
        projectName: li.project.name,
        projectNumber: li.project.projectNumber,
        projectPhase: li.projectPhase,
        taskType: li.taskType,
        hoursWorked: Number(li.hoursWorked),
        blockerFlag: li.blockerFlag,
      })),
    })),
  });
}

export async function POST(request: NextRequest) {
  const gate = await requireAthletePortalSession(request);
  if (gate instanceof NextResponse) return gate;
  const { athlete } = gate;

  try {
    const body = await request.json();
    const dateRaw = body.submissionDate ? String(body.submissionDate) : "";
    const submissionDate = parseDateOnly(dateRaw) ?? dateOnlyUtc(new Date());
    const lineItems = parseLineItems(body.lineItems);
    if (!lineItems) {
      return NextResponse.json({ error: "At least one valid project entry is required" }, { status: 400 });
    }

    const existing = await prisma.opsDailySubmission.findUnique({
      where: {
        athleteId_submissionDate: { athleteId: athlete.id, submissionDate },
      },
    });
    if (existing?.lockedAt) {
      return NextResponse.json({ error: "This submission is locked" }, { status: 400 });
    }

    for (const li of lineItems) {
      const project = await prisma.opsProject.findFirst({
        where: { id: li.projectId, assignedAthleteId: athlete.id, clientId: li.clientId },
      });
      if (!project) {
        return NextResponse.json({ error: "Invalid project selection" }, { status: 400 });
      }
    }

    const totalHours = lineItems.reduce((sum, li) => sum + li.hoursWorked, 0);
    const wellbeingScore =
      body.wellbeingScore != null ? Math.max(1, Math.min(5, Number(body.wellbeingScore))) : null;

    const submission = await prisma.$transaction(async (tx) => {
      if (existing) {
        await tx.opsSubmissionLineItem.deleteMany({ where: { submissionId: existing.id } });
        await tx.opsDailySubmission.update({
          where: { id: existing.id },
          data: {
            wellbeingScore,
            checkInRequested: Boolean(body.checkInRequested),
            dailyNote: body.dailyNote ? String(body.dailyNote).trim() : null,
            totalHours,
          },
        });
        await tx.opsSubmissionLineItem.createMany({
          data: lineItems.map((li) => ({
            submissionId: existing.id,
            clientId: li.clientId,
            projectId: li.projectId,
            projectPhase: li.projectPhase,
            taskType: li.taskType,
            hoursWorked: li.hoursWorked,
            completionPercent: li.completionPercent ?? null,
            urgencyStatus: (li.urgencyStatus ?? "normal") as OpsUrgencyStatus,
            completedSummary: li.completedSummary,
            blockerFlag: li.blockerFlag ?? false,
            blockerNote: li.blockerNote,
            notes: li.notes,
          })),
        });
        for (const li of lineItems) {
          if (li.blockerFlag) {
            await tx.opsProject.update({
              where: { id: li.projectId },
              data: { blockerFlag: true },
            });
          }
        }
        return tx.opsDailySubmission.findUniqueOrThrow({
          where: { id: existing.id },
          include: { lineItems: true },
        });
      }

      const created = await tx.opsDailySubmission.create({
        data: {
          athleteId: athlete.id,
          submissionDate,
          wellbeingScore,
          checkInRequested: Boolean(body.checkInRequested),
          dailyNote: body.dailyNote ? String(body.dailyNote).trim() : null,
          totalHours,
          lineItems: {
            create: lineItems.map((li) => ({
              clientId: li.clientId,
              projectId: li.projectId,
              projectPhase: li.projectPhase,
              taskType: li.taskType,
              hoursWorked: li.hoursWorked,
              completionPercent: li.completionPercent ?? null,
              urgencyStatus: (li.urgencyStatus ?? "normal") as OpsUrgencyStatus,
              completedSummary: li.completedSummary,
              blockerFlag: li.blockerFlag ?? false,
              blockerNote: li.blockerNote,
              notes: li.notes,
            })),
          },
        },
        include: { lineItems: true },
      });

      for (const li of lineItems) {
        if (li.blockerFlag) {
          await tx.opsProject.update({
            where: { id: li.projectId },
            data: { blockerFlag: true },
          });
        }
      }

      if (body.checkInRequested) {
        await tx.opsProject.updateMany({
          where: { id: { in: lineItems.map((li) => li.projectId) } },
          data: { checkInRequested: true },
        });
      }

      return created;
    });

    const monthSummary = await athleteMonthlySummary(athlete);
    const todayHours = Number(submission.totalHours);
    const preview = computeMonthlyHoursSummary({
      monthHours: monthSummary.monthHours,
      monthlyHourCap: athlete.monthlyHourCap,
      baseMonthlyPayZar: Number(athlete.baseMonthlyPayZar),
      overtimeRateZar: Number(athlete.overtimeRateZar),
    });

    return NextResponse.json(
      {
        submission: {
          id: submission.id,
          submissionDate: submission.submissionDate.toISOString().slice(0, 10),
          totalHours: Number(submission.totalHours),
        },
        calculation: {
          todayHours,
          monthHoursBefore: monthSummary.monthHours - todayHours,
          monthHoursAfter: preview.monthHours,
          hoursRemaining: preview.hoursRemaining,
          overtimeTriggered: preview.overtimeTriggered,
          overtimeHours: preview.monthOvertimeHours,
          totalEarningsZar: preview.totalEarningsZar,
        },
      },
      { status: existing ? 200 : 201 }
    );
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
