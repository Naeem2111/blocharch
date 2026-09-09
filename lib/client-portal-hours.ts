import { prisma } from "@/lib/prisma";
import { laneIncludedHours } from "@/lib/ops-constants";
import { monthEndUtc, monthStartUtc } from "@/lib/ops-hours";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export type ClientPortalHours = {
  monthLabel: string;
  hoursUsed: number;
  includedHours: number;
  hoursRemaining: number;
  overtimeHours: number;
  overtimeRateGbp: number;
  overtimeCostGbp: number;
};

export async function getClientPortalHours(input: {
  clientId: string;
  activeLaneCount: number;
  overtimeRateGbp: number;
  asOf?: Date;
}): Promise<ClientPortalHours> {
  const asOf = input.asOf ?? new Date();
  const from = monthStartUtc(asOf);
  const to = monthEndUtc(asOf);
  const agg = await prisma.opsSubmissionLineItem.aggregate({
    where: {
      clientId: input.clientId,
      submission: { submissionDate: { gte: from, lte: to } },
    },
    _sum: { hoursWorked: true },
  });

  const hoursUsed = round2(Number(agg._sum.hoursWorked ?? 0));
  const includedHours = laneIncludedHours(input.activeLaneCount);
  const overtimeHours = round2(Math.max(0, hoursUsed - includedHours));
  const overtimeRateGbp = Math.max(0, Number(input.overtimeRateGbp) || 0);
  const hoursRemaining = round2(Math.max(0, includedHours - hoursUsed));

  return {
    monthLabel: asOf.toLocaleString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }),
    hoursUsed,
    includedHours,
    hoursRemaining,
    overtimeHours,
    overtimeRateGbp,
    overtimeCostGbp: round2(overtimeHours * overtimeRateGbp),
  };
}
