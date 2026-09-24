import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

/** Progress when a completed private project is moved back to active work. */
export const PRIVATE_REACTIVATION_PROGRESS_PERCENT = 85;

export async function reactivatePrivateProject(projectId: string): Promise<
  | { ok: true; progressPercent: number }
  | { ok: false; error: string; status: 400 | 404 }
> {
  const project = await prisma.privateProject.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      status: true,
      designStage: true,
      client: { select: { slug: true } },
    },
  });
  if (!project) return { ok: false, error: "Project not found", status: 404 };
  if (project.status !== "completed") {
    return {
      ok: false,
      error: "Only completed projects can be brought back to active",
      status: 400,
    };
  }

  await prisma.privateProject.update({
    where: { id: projectId },
    data: {
      status: "active",
      completedAt: null,
      handoverOutcome: null,
      manualProgressPercent: PRIVATE_REACTIVATION_PROGRESS_PERCENT,
      ...(project.designStage === "council_approved"
        ? {
            designStage: "council_review" as const,
            stageStartedAt: new Date(),
          }
        : {}),
    },
  });

  revalidatePath("/dashboard/private");
  revalidatePath("/dashboard/private/projects");
  revalidatePath("/dashboard/private/projects/completed");
  revalidatePath(`/dashboard/private/projects/${projectId}`);
  if (project.client.slug) {
    revalidatePath(`/private/${project.client.slug}`);
  }

  return { ok: true, progressPercent: PRIVATE_REACTIVATION_PROGRESS_PERCENT };
}
