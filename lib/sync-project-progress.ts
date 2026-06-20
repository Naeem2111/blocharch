import { prisma } from "@/lib/prisma";
import {
  isActiveProjectStatus,
  syncProjectAfterOpsUpdate,
} from "@/lib/planner-project-sync";

/** Apply latest completion % from a daily log to assigned projects. */
export async function syncProjectProgressFromLineItems(
  lineItems: Array<{ projectId: string; completionPercent?: number | null }>
) {
  const byProject = new Map<string, number>();
  for (const li of lineItems) {
    if (li.completionPercent == null || !Number.isFinite(li.completionPercent)) continue;
    const pct = Math.max(0, Math.min(100, Math.round(li.completionPercent)));
    const prev = byProject.get(li.projectId);
    if (prev === undefined || pct > prev) byProject.set(li.projectId, pct);
  }

  for (const [projectId, progressPercent] of Array.from(byProject.entries())) {
    const before = await prisma.opsProject.findUnique({
      where: { id: projectId },
      select: {
        assignedAthleteId: true,
        currentStatus: true,
        name: true,
        progressPercent: true,
      },
    });
    if (!before) continue;

    const updated = await prisma.opsProject.update({
      where: { id: projectId },
      data: { progressPercent },
      select: {
        assignedAthleteId: true,
        currentStatus: true,
        name: true,
      },
    });

    if (
      progressPercent >= 100 &&
      isActiveProjectStatus(before.currentStatus) &&
      updated.assignedAthleteId
    ) {
      const completed = await prisma.opsProject.update({
        where: { id: projectId },
        data: { currentStatus: "completed" },
        select: {
          assignedAthleteId: true,
          currentStatus: true,
          name: true,
        },
      });

      await syncProjectAfterOpsUpdate(
        projectId,
        {
          assignedAthleteId: before.assignedAthleteId,
          currentStatus: before.currentStatus,
          name: before.name,
        },
        {
          assignedAthleteId: completed.assignedAthleteId,
          currentStatus: completed.currentStatus,
          name: completed.name,
        }
      );
    }
  }
}
