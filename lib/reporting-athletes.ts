import type { Prisma } from "@prisma/client";
import { isAdminOnlyAccount } from "@/lib/admin-only-accounts";
import { prisma } from "@/lib/prisma";

const reportingAthleteSelect = {
  id: true,
  userId: true,
  fullName: true,
  athleteCode: true,
  status: true,
  profilePhotoUrl: true,
  profilePhotoBgColor: true,
  profilePhotoTextTone: true,
  monthlyHourCap: true,
  baseMonthlyPayZar: true,
  overtimeRateZar: true,
  blocharchStartDate: true,
  email: true,
  user: { select: { id: true, username: true, role: true, disabled: true } },
} satisfies Prisma.OpsAthleteSelect;

export type ReportingAthlete = Prisma.OpsAthleteGetPayload<{
  select: typeof reportingAthleteSelect;
}>;

/** Active athletes for assignment, dropdowns, and reporting (excludes admin-only accounts). */
export async function listReportingAthletes(
  options: { status?: "active" | "inactive" } = {}
): Promise<ReportingAthlete[]> {
  const athletes = await prisma.opsAthlete.findMany({
    where: options.status ? { status: options.status } : undefined,
    orderBy: { fullName: "asc" },
    select: reportingAthleteSelect,
  });

  return athletes.filter((a) => !a.user.disabled && !isAdminOnlyAccount(a.user.username));
}

export async function monthSubmissionHoursByAthlete(
  from: Date,
  to: Date
): Promise<Map<string, number>> {
  const grouped = await prisma.opsDailySubmission.groupBy({
    by: ["athleteId"],
    where: { submissionDate: { gte: from, lte: to } },
    _sum: { totalHours: true },
  });

  return new Map(
    grouped.map((row) => [row.athleteId, Number(row._sum.totalHours ?? 0)])
  );
}
