import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePrivateAthleteSession } from "@/lib/private-access";
import { serializePrivateProject } from "@/lib/private-serialize";

export async function GET(request: NextRequest) {
  const gate = await requirePrivateAthleteSession(request);
  if (gate instanceof NextResponse) return gate;

  const scope = request.nextUrl.searchParams.get("scope") || "active";
  const where =
    scope === "completed"
      ? { assignedAthleteId: gate.athlete.id, status: "completed" as const }
      : {
          assignedAthleteId: gate.athlete.id,
          status: { in: ["active" as const, "on_hold" as const] },
        };

  const projects = await prisma.privateProject.findMany({
    where,
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
        select: {
          id: true,
          fullName: true,
          athleteCode: true,
          privateWeeklyCapHours: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({
    projects: projects.map((p) => serializePrivateProject(p)),
  });
}
