import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePlannerSession } from "@/lib/planner-access";
import { listReportingAthletes } from "@/lib/reporting-athletes";

/** Active athletes for Project planner → Team roster (admin/manager). */
export async function GET(request: NextRequest) {
  const gate = await requirePlannerSession(request);
  if (gate instanceof NextResponse) return gate;
  const { user } = gate;

  if (user.role !== "admin" && user.role !== "manager") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const athletes = await listReportingAthletes({ status: "active" });

  const counts = await prisma.opsAthlete.findMany({
    where: { id: { in: athletes.map((a) => a.id) } },
    select: { id: true, _count: { select: { projects: true } } },
  });
  const countById = new Map(counts.map((row) => [row.id, row._count.projects]));

  return NextResponse.json({
    athletes: athletes.map((a) => ({
      id: a.id,
      userId: a.userId,
      fullName: a.fullName,
      athleteCode: a.athleteCode,
      username: a.user.username,
      profilePhotoUrl: a.profilePhotoUrl,
      profilePhotoBgColor: a.profilePhotoBgColor,
      profilePhotoTextTone: a.profilePhotoTextTone,
      activeProjects: countById.get(a.id) ?? 0,
    })),
  });
}
