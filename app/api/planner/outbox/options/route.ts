import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePlannerSession } from "@/lib/planner-access";
import { listReportingAthletes } from "@/lib/reporting-athletes";
import { activeAthleteAssignmentsInclude } from "@/lib/ops-project-assignments";

/** Athletes + assignable projects for Outbox form (admin/manager). */
export async function GET(request: NextRequest) {
  const gate = await requirePlannerSession(request);
  if (gate instanceof NextResponse) return gate;
  const { user } = gate;

  if (user.role !== "admin" && user.role !== "manager") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [athletes, projects] = await Promise.all([
    listReportingAthletes({ status: "active" }),
    prisma.opsProject.findMany({
      where: {
        OR: [
          { assignedAthleteId: { not: null } },
          { athleteAssignments: { some: { removedAt: null } } },
        ],
        currentStatus: { notIn: ["completed", "handed_over"] },
      },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        assignedAthleteId: true,
        athleteAssignments: activeAthleteAssignmentsInclude,
        client: { select: { name: true } },
      },
    }),
  ]);

  return NextResponse.json({
    athletes: athletes.map((a) => ({
      id: a.id,
      fullName: a.fullName,
      athleteCode: a.athleteCode,
      profilePhotoUrl: a.profilePhotoUrl,
    })),
    projects: projects.map((p) => {
      const assignedAthleteIds = Array.from(
        new Set([
          ...(p.assignedAthleteId ? [p.assignedAthleteId] : []),
          ...p.athleteAssignments.map((row) => row.athleteId),
        ])
      );
      return {
        id: p.id,
        name: p.name,
        clientName: p.client.name,
        assignedAthleteId: p.assignedAthleteId,
        assignedAthleteIds,
      };
    }),
  });
}
