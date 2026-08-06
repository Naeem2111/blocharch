import type { OpsAthlete } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { monthEndUtc, monthStartUtc } from "@/lib/ops-hours";

/** Hourly rate used when logging private hours to project cost — kept in sync with athlete private log API. */
export function privateAthleteHourlyRateZar(
  athlete: Pick<OpsAthlete, "baseMonthlyPayZar" | "monthlyHourCap">,
): number {
  return Number(athlete.baseMonthlyPayZar) / Math.max(1, athlete.monthlyHourCap);
}

export async function athletePrivateWorkEarnings(
  athleteId: string,
  athlete: Pick<OpsAthlete, "baseMonthlyPayZar" | "monthlyHourCap">,
  reference = new Date(),
) {
  const hourlyRateZar = privateAthleteHourlyRateZar(athlete);
  const from = monthStartUtc(reference);
  const to = monthEndUtc(reference);

  const [monthAgg, lifetimeAgg] = await Promise.all([
    prisma.privateHourLog.aggregate({
      where: { athleteId, workDate: { gte: from, lte: to } },
      _sum: { hours: true },
    }),
    prisma.privateHourLog.aggregate({
      where: { athleteId },
      _sum: { hours: true },
    }),
  ]);

  const monthHours = Number(monthAgg._sum.hours ?? 0);
  const lifetimeHours = Number(lifetimeAgg._sum.hours ?? 0);

  return {
    hourlyRateZar,
    monthHours,
    lifetimeHours,
    monthEarningsZar: Math.round(monthHours * hourlyRateZar),
    lifetimeEarningsZar: Math.round(lifetimeHours * hourlyRateZar),
  };
}
