import type { OpsExchangeRateType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { monthStartUtc } from "@/lib/ops-hours";

export function isOpsExchangeRateType(v: string): v is OpsExchangeRateType {
  return v === "live" || v === "reporting";
}

/** First day of month UTC for a reference date. */
export function effectiveMonthUtc(date: Date): Date {
  return monthStartUtc(date);
}

export async function getActiveExchangeRate(
  reference: Date,
  rateType: OpsExchangeRateType
): Promise<number | null> {
  const month = effectiveMonthUtc(reference);
  const row = await prisma.opsExchangeRate.findFirst({
    where: { effectiveMonth: month, rateType, activeFlag: true },
    orderBy: { createdAt: "desc" },
  });
  return row ? Number(row.gbpToZarRate) : null;
}

export async function getReportingRateOrDefault(reference: Date): Promise<number> {
  const rate = await getActiveExchangeRate(reference, "reporting");
  return rate ?? 24;
}

export async function getLiveRateOrDefault(reference: Date): Promise<number> {
  const rate = await getActiveExchangeRate(reference, "live");
  const reporting = await getReportingRateOrDefault(reference);
  return rate ?? reporting;
}
