import { prisma } from "@/lib/prisma";

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

  await Promise.all(
    Array.from(byProject.entries()).map(([projectId, progressPercent]) =>
      prisma.opsProject.update({
        where: { id: projectId },
        data: { progressPercent },
      })
    )
  );
}
