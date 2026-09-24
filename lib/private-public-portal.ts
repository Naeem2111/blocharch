import { prisma } from "@/lib/prisma";
import {
  PRIVATE_STAGE_LABELS,
  PRIVATE_STAGE_ORDER,
  PRIVATE_STAGE_DONE_COPY,
} from "@/lib/private-constants";
import { resolvePrivateProgressPercent, privateStageMeta } from "@/lib/private-progress";
import {
  buildPortalPhaseGroups,
  resolvePhaseStructure,
  resolveCurrentDesignPhase,
  allDesignPhases,
  designPhaseListStatus,
} from "@/lib/private-phase-structure";
import { isoDateOnly, parseStageDateMap, resolveStageDates } from "@/lib/private-stage-dates";

export async function getPublicPrivateProjectBySlug(slug: string) {
  const client = await prisma.privateClient.findFirst({
    where: { slug, portalEnabled: true },
  });
  if (!client) return null;

  const project = await prisma.privateProject.findFirst({
    where: {
      clientId: client.id,
      status: { in: ["active", "completed", "on_hold"] },
    },
    orderBy: { updatedAt: "desc" },
    include: {
      updates: {
        where: { clientVisible: true },
        orderBy: { occurredAt: "desc" },
        take: 12,
      },
      actionItems: {
        where: { clientFacing: true },
        orderBy: [{ completedAt: "desc" }, { createdAt: "desc" }],
        take: 40,
      },
    },
  });
  if (!project) return null;

  let documents: Array<{ id: string; title: string; fileUrl: string }> = [];
  try {
    documents = await prisma.privateProjectDocument.findMany({
      where: { projectId: project.id, clientVisible: true },
      orderBy: { createdAt: "desc" },
      take: 40,
      select: { id: true, title: true, fileUrl: true },
    });
  } catch {
    documents = [];
  }

  const progressPercent = resolvePrivateProgressPercent({
    designStage: project.designStage,
    stageStartedAt: project.stageStartedAt,
    manualProgressPercent: project.manualProgressPercent,
  });
  const meta = privateStageMeta({
    designStage: project.designStage,
    stageStartedAt: project.stageStartedAt,
  });

  const phaseStructure = resolvePhaseStructure(project.phaseStructure);
  const currentPhase = resolveCurrentDesignPhase(
    phaseStructure,
    project.designStage,
    project.currentDesignPhaseId,
  );
  const phaseGroups = buildPortalPhaseGroups(
    phaseStructure,
    project.designStage,
    currentPhase?.id ?? project.currentDesignPhaseId,
  );
  const stageDates = resolveStageDates(parseStageDateMap(project.stageDates) ?? {}, {
    briefReceivedAt: isoDateOnly(project.briefReceivedAt),
    councilSubmittedAt: isoDateOnly(project.councilSubmittedAt),
  });

  const allPhases = allDesignPhases(phaseStructure);
  const currentPhaseId = currentPhase?.id ?? null;
  const stages =
    allPhases.length > 0
      ? allPhases.map((phase, i) => {
          const range = stageDates[phase.builtInKey ?? phase.id] ?? stageDates[phase.id];
          const status = currentPhaseId
            ? designPhaseListStatus(allPhases, phase.id, currentPhaseId)
            : null;
          const currentIdx = PRIVATE_STAGE_ORDER.indexOf(project.designStage);
          const builtInIdx = phase.builtInKey ? PRIVATE_STAGE_ORDER.indexOf(phase.builtInKey) : -1;
          const state =
            status === "completed"
              ? "done"
              : status === "current"
                ? "current"
                : status === "upcoming"
                  ? "upcoming"
                  : builtInIdx < 0
                    ? "upcoming"
                    : builtInIdx < currentIdx
                      ? "done"
                      : builtInIdx === currentIdx
                        ? "current"
                        : "upcoming";
          return {
            key: phase.id,
            label: phase.name,
            number: i + 1,
            state: state as "done" | "current" | "upcoming",
            dateFrom: range?.from ?? null,
            dateTo: range?.to ?? null,
            assignedDate: range?.from ?? null,
          };
        })
      : PRIVATE_STAGE_ORDER.map((key, i) => {
          const currentIdx = PRIVATE_STAGE_ORDER.indexOf(project.designStage);
          const range = stageDates[key];
          return {
            key,
            label: PRIVATE_STAGE_LABELS[key],
            number: i + 1,
            state: (i < currentIdx ? "done" : i === currentIdx ? "current" : "upcoming") as
              | "done"
              | "current"
              | "upcoming",
            dateFrom: range?.from ?? null,
            dateTo: range?.to ?? null,
            assignedDate: range?.from ?? null,
          };
        });

  let estCouncilDecision: string | null = null;
  if (project.councilSubmittedAt && project.designStage === "council_review") {
    const d = new Date(project.councilSubmittedAt);
    d.setUTCDate(d.getUTCDate() + 45);
    estCouncilDecision = d.toLocaleString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
  }

  return {
    clientName: client.name,
    project: {
      id: project.id,
      name: project.name,
      address: project.address ?? project.name,
      designStage: project.designStage,
      designStageLabel: currentPhase?.name ?? PRIVATE_STAGE_LABELS[project.designStage],
      progressPercent,
      stageMeta: meta,
      quietExplanation: meta.quietExplanation,
      doneCopy:
        project.designStage === "council_approved" ? PRIVATE_STAGE_DONE_COPY : null,
      briefReceivedAt: project.briefReceivedAt?.toISOString().slice(0, 10) ?? null,
      councilSubmittedAt: project.councilSubmittedAt?.toISOString().slice(0, 10) ?? null,
      dueDate: project.dueDate?.toISOString().slice(0, 10) ?? null,
      stageStartedAt: project.stageStartedAt.toISOString().slice(0, 10),
      stageDates,
      clientDescription: project.clientDescription,
      estCouncilDecision,
      updatedAt: project.updatedAt.toISOString().slice(0, 10),
      outOfScopeFlag: project.outOfScopeFlag,
    },
    stages,
    phaseGroups,
    actionItems: project.actionItems
      .filter((a) => !a.completedAt)
      .map((a) => ({ id: a.id, title: a.title })),
    completedActionItems: project.actionItems
      .filter((a) => a.completedAt)
      .map((a) => ({
        id: a.id,
        title: a.title,
        completedAt: a.completedAt!.toISOString().slice(0, 10),
      })),
    updates: project.updates.map((u) => ({
      title: u.title,
      body: u.body,
      occurredAt: u.occurredAt.toISOString().slice(0, 10),
    })),
    documents,
  };
}
