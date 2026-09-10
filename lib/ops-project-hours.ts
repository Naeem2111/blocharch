import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function hoursLoggedByProjectIds(projectIds: string[]): Promise<Map<string, number>> {
  const ids = projectIds.filter(Boolean);
  const map = new Map<string, number>();
  if (ids.length === 0) return map;

  const rows = await prisma.opsSubmissionLineItem.groupBy({
    by: ["projectId"],
    where: { projectId: { in: ids }, isHousekeeping: false },
    _sum: { hoursWorked: true },
  });

  for (const row of rows) {
    if (!row.projectId) continue;
    map.set(row.projectId, Number(row._sum.hoursWorked ?? 0));
  }
  return map;
}

export async function quotedHoursByProjectIds(
  projectIds: string[]
): Promise<Map<string, number | null>> {
  const ids = projectIds.filter(Boolean);
  const map = new Map<string, number | null>();
  if (ids.length === 0) return map;

  try {
    const rows = await prisma.$queryRaw<Array<{ id: string; quoted_hours: unknown }>>(
      Prisma.sql`SELECT id, quoted_hours FROM ops_projects WHERE id IN (${Prisma.join(
        ids.map((id) => Prisma.sql`${id}`)
      )})`
    );
    for (const row of rows) {
      map.set(row.id, row.quoted_hours == null ? null : Number(row.quoted_hours));
    }
  } catch {
    for (const id of ids) map.set(id, null);
  }
  return map;
}

export async function setQuotedHours(projectId: string, hours: number | null): Promise<void> {
  await prisma.$executeRaw(
    Prisma.sql`UPDATE ops_projects SET quoted_hours = ${hours} WHERE id = ${projectId}`
  );
}

export function formatHoursCompact(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function parseOptionalQuotedHours(
  value: unknown
): { hours: number | null } | { error: string } {
  if (value === null || value === "") return { hours: null };
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) {
    return { error: "Total hours must be a number 0 or greater" };
  }
  return { hours: Math.round(n * 100) / 100 };
}
