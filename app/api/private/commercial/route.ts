import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePrivateOpsSession } from "@/lib/private-access";
import { marginPercent } from "@/lib/private-progress";

function monthBoundsFromParam(monthParam: string | null) {
  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const [y, m] = monthParam.split("-").map(Number);
    const start = new Date(Date.UTC(y, m - 1, 1));
    const end = new Date(Date.UTC(y, m, 1));
    return { start, end, label: monthParam };
  }
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const label = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  return { start, end, label };
}

export async function GET(request: NextRequest) {
  const gate = await requirePrivateOpsSession(request);
  if (gate instanceof NextResponse) return gate;

  const { start, end, label } = monthBoundsFromParam(
    request.nextUrl.searchParams.get("month"),
  );

  const projects = await prisma.privateProject.findMany({
    where: { status: { in: ["active", "completed"] } },
    include: {
      client: { select: { id: true, name: true } },
      assignedAthlete: { select: { id: true, fullName: true } },
      hourLogs: {
        where: { workDate: { gte: start, lt: end } },
        select: { hours: true },
      },
    },
    orderBy: { name: "asc" },
  });

  const utilisation = projects
    .filter((p) => p.assignedAthlete)
    .map((p) => {
      const fee = Number(p.feeZar);
      const cost = Number(p.costZar);
      const hours = p.hourLogs.reduce((s, l) => s + Number(l.hours), 0);
      return {
        athleteId: p.assignedAthlete!.id,
        athleteName: p.assignedAthlete!.fullName,
        projectId: p.id,
        projectName: p.name,
        hours,
        revenueShareZar: fee,
        costZar: cost,
        marginPercent: marginPercent(fee, cost),
      };
    })
    .filter((r) => r.hours > 0 || r.revenueShareZar > 0);

  const feeRevenue = projects
    .filter((p) => p.status === "active" || (p.completedAt && p.completedAt >= start && p.completedAt < end))
    .reduce((s, p) => s + Number(p.feeZar), 0);
  const cost = utilisation.reduce((s, r) => s + r.costZar, 0);
  const outOfScope = projects.reduce((s, p) => s + Number(p.outOfScopeBilledZar), 0);

  return NextResponse.json({
    month: label,
    summary: {
      feeRevenueZar: feeRevenue,
      costZar: cost,
      marginZar: feeRevenue - cost,
      marginPercent: marginPercent(feeRevenue, cost),
      outOfScopeHourlyBilledZar: outOfScope,
    },
    utilisation,
    clients: Array.from(new Map(projects.map((p) => [p.client.id, p.client])).values()),
  });
}
