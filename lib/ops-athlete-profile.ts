import type { OpsAthlete } from "@prisma/client";
import type { SessionUser } from "@/lib/auth";
import { isStaffAdmin } from "@/lib/admin-only-accounts";
import { prisma } from "@/lib/prisma";
import { ensureAthleteSystemBoards } from "@/lib/planner-system-boards";

function titleCaseUsername(username: string): string {
  return username
    .split(/[._-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

async function resolveUniqueAthleteCode(username: string): Promise<string> {
  const base = username.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 12) || "STAFF";
  let candidate = base;
  let n = 2;
  while (await prisma.opsAthlete.findUnique({ where: { athleteCode: candidate } })) {
    const suffix = String(n++);
    candidate = `${base.slice(0, Math.max(2, 12 - suffix.length))}${suffix}`;
  }
  return candidate;
}

/** Staff admins get an OpsAthlete profile for project assignment and reporting. */
export async function ensureLinkedAthleteProfile(user: SessionUser): Promise<OpsAthlete | null> {
  if (!isStaffAdmin(user)) return null;

  const existing = await prisma.opsAthlete.findUnique({ where: { userId: user.id } });
  if (existing) return existing;

  const athleteCode = await resolveUniqueAthleteCode(user.username);
  const fullName = titleCaseUsername(user.username);

  return prisma.$transaction(async (tx) => {
    const created = await tx.opsAthlete.create({
      data: {
        userId: user.id,
        fullName,
        athleteCode,
        blocharchStartDate: new Date(),
        status: "active",
      },
    });
    await ensureAthleteSystemBoards(created.id, user.id, tx);
    return created;
  });
}
