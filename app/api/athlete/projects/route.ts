import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { deriveClientPortalLaneNumber } from "@/lib/client-portal-projects";
import {
  athleteProjectSelect,
  requireAthletePortalSession,
  serializeProjectForAthlete,
} from "@/lib/ops-access";
import { hoursLoggedByProjectIds, quotedHoursByProjectIds } from "@/lib/ops-project-hours";
import {
  serializeProjectAssignments,
  whereAthleteActiveProjects,
} from "@/lib/ops-project-assignments";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const gate = await requireAthletePortalSession(request);
  if (gate instanceof NextResponse) return gate;
  const { athlete } = gate;

  const projects = await prisma.opsProject.findMany({
    where: {
      ...whereAthleteActiveProjects(athlete.id),
      currentStatus: { notIn: ["completed", "handed_over"] },
    },
    orderBy: [{ dueDate: "asc" }, { name: "asc" }],
    select: {
      ...athleteProjectSelect,
      client: {
        select: {
          id: true,
          name: true,
          logoUrl: true,
          logoBgColor: true,
          logoTextTone: true,
          commercial: { select: { activeLaneCount: true } },
        },
      },
      assignedAthlete: { select: { id: true, fullName: true, athleteCode: true } },
      athleteAssignments: {
        where: { removedAt: null },
        orderBy: [{ isPrimary: "desc" }, { assignedAt: "asc" }],
        select: {
          athleteId: true,
          isPrimary: true,
          assignedAt: true,
          removedAt: true,
          athlete: { select: { id: true, fullName: true, athleteCode: true } },
        },
      },
    },
  });

  const projectIds = projects.map((project) => project.id);
  const [hoursByProject, quotedByProject] = await Promise.all([
    hoursLoggedByProjectIds(projectIds),
    quotedHoursByProjectIds(projectIds),
  ]);

  const clients = await prisma.opsClient.findMany({
    where: { projects: { some: whereAthleteActiveProjects(athlete.id) } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const clientById = new Map(clients.map((c) => [c.id, c]));
  for (const project of projects) {
    if (!clientById.has(project.client.id)) {
      clientById.set(project.client.id, { id: project.client.id, name: project.client.name });
    }
  }

  return NextResponse.json({
    projects: projects.map((project) => {
      const { assignedAthlete, athleteAssignments, client, ...base } = project;
      const serialized = serializeProjectForAthlete({
        ...base,
        client: {
          id: client.id,
          name: client.name,
          logoUrl: client.logoUrl,
          logoBgColor: client.logoBgColor,
          logoTextTone: client.logoTextTone,
        },
      });
      return {
        ...serialized,
        assignedAthleteId: assignedAthlete?.id ?? null,
        assignedAthleteName: assignedAthlete?.fullName ?? null,
        athleteCode: assignedAthlete?.athleteCode ?? null,
        assignedAthletes: serializeProjectAssignments(athleteAssignments),
        hoursLogged: hoursByProject.get(project.id) ?? 0,
        quotedHours: quotedByProject.get(project.id) ?? null,
        laneNumber: deriveClientPortalLaneNumber(
          project.projectNumber,
          client.commercial?.activeLaneCount ?? 1
        ),
      };
    }),
    clients: Array.from(clientById.values()).sort((a, b) => a.name.localeCompare(b.name)),
  });
}
