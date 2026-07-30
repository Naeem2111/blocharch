import { prisma } from "@/lib/prisma";
import {
  PRIVATE_STAGE_LABELS,
  PRIVATE_STAGE_ORDER,
  PRIVATE_STAGE_DONE_COPY,
} from "@/lib/private-constants";
import { computePrivateProgressPercent, privateStageMeta } from "@/lib/private-progress";

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
        where: { clientFacing: true, completedAt: null },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!project) return null;

  const progressPercent = computePrivateProgressPercent({
    designStage: project.designStage,
    stageStartedAt: project.stageStartedAt,
  });
  const meta = privateStageMeta({
    designStage: project.designStage,
    stageStartedAt: project.stageStartedAt,
  });

  const stages = PRIVATE_STAGE_ORDER.map((key, i) => {
    const currentIdx = PRIVATE_STAGE_ORDER.indexOf(project.designStage);
    return {
      key,
      label: PRIVATE_STAGE_LABELS[key],
      number: i + 1,
      state: i < currentIdx ? "done" : i === currentIdx ? "current" : "upcoming",
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
      designStageLabel: PRIVATE_STAGE_LABELS[project.designStage],
      progressPercent,
      stageMeta: meta,
      stageNotes: project.stageNotes,
      quietExplanation: meta.quietExplanation,
      doneCopy:
        project.designStage === "council_approved" ? PRIVATE_STAGE_DONE_COPY : null,
      briefReceivedAt: project.briefReceivedAt?.toISOString().slice(0, 10) ?? null,
      councilSubmittedAt: project.councilSubmittedAt?.toISOString().slice(0, 10) ?? null,
      estCouncilDecision,
      updatedAt: project.updatedAt.toISOString().slice(0, 10),
      outOfScopeFlag: project.outOfScopeFlag,
    },
    stages,
    actionItems: project.actionItems.map((a) => a.title),
    updates: project.updates.map((u) => ({
      title: u.title,
      body: u.body,
      occurredAt: u.occurredAt.toISOString().slice(0, 10),
    })),
  };
}
