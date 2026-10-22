import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePrivateAthleteSession } from "@/lib/private-access";
import { serializePrivateProject } from "@/lib/private-serialize";
import {
  activePrivateAthleteAssignmentsInclude,
  privateAssignedAthleteSelect,
  whereAthletePrivateProjects,
} from "@/lib/private-project-assignments";
import { syncPrivateProjectsIntoArchives } from "@/lib/private-archive";

export async function GET(request: NextRequest) {
  const gate = await requirePrivateAthleteSession(request);
  if (gate instanceof NextResponse) return gate;

  const scope = request.nextUrl.searchParams.get("scope") || "active";
  if (scope === "active") {
    await syncPrivateProjectsIntoArchives();
  }
  const statusWhere =
    scope === "completed"
      ? { status: "completed" as const }
      : { status: { in: ["active" as const, "on_hold" as const] } };

  const projects = await prisma.privateProject.findMany({
    where: {
      AND: [whereAthletePrivateProjects(gate.athlete.id), statusWhere],
    },
    include: {
      client: {
        select: {
          id: true,
          name: true,
          contactEmail: true,
          contactPhone: true,
          slug: true,
        },
      },
      assignedAthlete: {
        select: privateAssignedAthleteSelect,
      },
      athleteAssignments: activePrivateAthleteAssignmentsInclude,
      customProjectType: { select: { id: true, label: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const ids = projects.map((project) => project.id);
  const hourRows =
    ids.length === 0
      ? []
      : await prisma.privateHourLog.groupBy({
          by: ["projectId"],
          where: { athleteId: gate.athlete.id, projectId: { in: ids } },
          _sum: { hours: true },
        });
  const hoursByProject = new Map(hourRows.map((row) => [row.projectId, Number(row._sum.hours ?? 0)]));

  return NextResponse.json({
    projects: projects.map((project) =>
      serializePrivateProject(project, { hoursLifeToDate: hoursByProject.get(project.id) ?? 0 }),
    ),
  });
}
