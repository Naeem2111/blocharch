import { prisma } from "@/lib/prisma";
import { ensureAdminOutboxBoard, ensureAthleteSystemBoards } from "@/lib/planner-system-boards";

/** Backfill fixed boards for existing athletes and admin outbox (idempotent). */
export async function provisionMissingPlannerBoards() {
  const admin = await prisma.user.findFirst({
    where: { role: "admin", disabled: false },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (admin) {
    await ensureAdminOutboxBoard(admin.id);
  }

  const athletes = await prisma.opsAthlete.findMany({
    select: { id: true, userId: true },
  });

  for (const a of athletes) {
    await ensureAthleteSystemBoards(a.id, a.userId);
  }
}
