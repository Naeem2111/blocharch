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

export async function GET(request: NextRequest) {
  const gate = await requirePrivateAthleteSession(request);
  if (gate instanceof NextResponse) return gate;

  const scope = request.nextUrl.searchParams.get("scope") || "active";
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

  return NextResponse.json({
    projects: projects.map((p) => serializePrivateProject(p)),
  });
}
