import type { PrivateDesignStage, PrivateProjectStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolvePrivateProgressPercent } from "@/lib/private-progress";
import { revalidatePath } from "next/cache";

const ARCHIVEABLE: PrivateProjectStatus[] = ["active", "on_hold"];

export function privateProjectShouldArchive(project: {
  status: PrivateProjectStatus | string;
  designStage: PrivateDesignStage;
  stageStartedAt: Date;
  manualProgressPercent?: number | null;
}): boolean {
  if (!ARCHIVEABLE.includes(project.status as PrivateProjectStatus)) return false;
  return (
    resolvePrivateProgressPercent({
      designStage: project.designStage,
      stageStartedAt: project.stageStartedAt,
      manualProgressPercent: project.manualProgressPercent,
    }) >= 100
  );
}

export function privateArchiveData(handoverOutcome?: string | null) {
  return {
    status: "completed" as const,
    completedAt: new Date(),
    handoverOutcome: handoverOutcome?.trim() || "Completed",
  };
}

function revalidatePrivateArchivePaths(projectId?: string, clientSlug?: string | null) {
  revalidatePath("/dashboard/private");
  revalidatePath("/dashboard/private/projects");
  revalidatePath("/dashboard/private/archives");
  revalidatePath("/dashboard/athlete/private");
  revalidatePath("/dashboard/athlete/private/archives");
  if (projectId) revalidatePath(`/dashboard/private/projects/${projectId}`);
  if (clientSlug) revalidatePath(`/private/${clientSlug}`);
}

/** Move a project to archives when progress is already 100% (or council approved). */
export async function archivePrivateProjectIfComplete(projectId: string): Promise<boolean> {
  const project = await prisma.privateProject.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      status: true,
      designStage: true,
      stageStartedAt: true,
      manualProgressPercent: true,
      handoverOutcome: true,
      client: { select: { slug: true } },
    },
  });
  if (!project || !privateProjectShouldArchive(project)) return false;

  await prisma.privateProject.update({
    where: { id: projectId },
    data: privateArchiveData(project.handoverOutcome),
  });
  revalidatePrivateArchivePaths(projectId, project.client.slug);
  return true;
}

/** Heal active/on-hold projects that already show 100% but never archived. */
export async function syncPrivateProjectsIntoArchives(limit = 50): Promise<number> {
  const candidates = await prisma.privateProject.findMany({
    where: {
      status: { in: ARCHIVEABLE },
      OR: [{ manualProgressPercent: { gte: 100 } }, { designStage: "council_approved" }],
    },
    select: {
      id: true,
      status: true,
      designStage: true,
      stageStartedAt: true,
      manualProgressPercent: true,
      handoverOutcome: true,
      client: { select: { slug: true } },
    },
    take: limit,
  });

  const toArchive = candidates.filter((p) => privateProjectShouldArchive(p));
  if (toArchive.length === 0) return 0;

  await prisma.$transaction(
    toArchive.map((p) =>
      prisma.privateProject.update({
        where: { id: p.id },
        data: privateArchiveData(p.handoverOutcome),
      }),
    ),
  );

  for (const p of toArchive) {
    revalidatePrivateArchivePaths(p.id, p.client.slug);
  }
  return toArchive.length;
}
