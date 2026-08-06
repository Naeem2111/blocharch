import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePrivateOpsSession, slugifyPrivateClient } from "@/lib/private-access";
import { isPrivateDesignStage } from "@/lib/private-constants";
import { resolveProjectTypeInput } from "@/lib/private-project-types";
import { serializePrivateProject } from "@/lib/private-serialize";
import { parseDateOnly } from "@/lib/ops-hours";
import { defaultPhaseSplits } from "@/lib/private-phase-splits";

const projectInclude = {
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
  customProjectType: {
    select: { id: true, label: true },
  },
} as const;

export async function GET(request: NextRequest) {
  const gate = await requirePrivateOpsSession(request);
  if (gate instanceof NextResponse) return gate;

  const scope = request.nextUrl.searchParams.get("scope") || "active";
  const where =
    scope === "all"
      ? {}
      : scope === "completed"
        ? { status: "completed" as const }
        : { status: { in: ["active" as const, "on_hold" as const] } };

  const projects = await prisma.privateProject.findMany({
    where,
    include: projectInclude,
    orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
  });

  return NextResponse.json({
    projects: projects.map((p) => serializePrivateProject(p)),
  });
}

export async function POST(request: NextRequest) {
  const gate = await requirePrivateOpsSession(request);
  if (gate instanceof NextResponse) return gate;

  try {
    const body = await request.json();

    const clientName = String(body.clientName || "").trim();
    const contactEmail = body.contactEmail ? String(body.contactEmail).trim() : null;
    const contactPhone = body.contactPhone ? String(body.contactPhone).trim() : null;
    const address = String(body.address || body.projectAddress || "").trim();
    const name = String(body.name || address || "").trim();
    const feeZar = Number(body.feeZar ?? body.fee ?? 0);
    const assignedAthleteId = body.assignedAthleteId
      ? String(body.assignedAthleteId).trim()
      : null;
    const designStage = isPrivateDesignStage(String(body.designStage || ""))
      ? body.designStage
      : "site_measure_up";
    const projectTypeResolved = await resolveProjectTypeInput(body);
    if (!projectTypeResolved.ok) {
      return NextResponse.json({ error: projectTypeResolved.error }, { status: 400 });
    }
    const { projectType, customProjectTypeId } = projectTypeResolved;

    if (!clientName) {
      return NextResponse.json({ error: "Client name is required" }, { status: 400 });
    }
    if (!name) {
      return NextResponse.json({ error: "Project address / name is required" }, { status: 400 });
    }
    if (!Number.isFinite(feeZar) || feeZar < 0) {
      return NextResponse.json({ error: "Fee must be a non-negative number" }, { status: 400 });
    }
    if (assignedAthleteId) {
      const athlete = await prisma.opsAthlete.findUnique({ where: { id: assignedAthleteId } });
      if (!athlete) {
        return NextResponse.json({ error: "Assigned athlete not found" }, { status: 400 });
      }
    }

    let slug = slugifyPrivateClient(clientName);
    const existingSlug = await prisma.privateClient.findUnique({ where: { slug } });
    if (existingSlug) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;

    const briefReceivedAt = body.briefReceivedAt
      ? parseDateOnly(String(body.briefReceivedAt))
      : new Date();

    const defaultSplits = defaultPhaseSplits();

    const created = await prisma.$transaction(async (tx) => {
      const client = await tx.privateClient.create({
        data: {
          name: clientName,
          contactEmail,
          contactPhone,
          slug,
          portalEnabled: true,
        },
      });

      const project = await tx.privateProject.create({
        data: {
          clientId: client.id,
          assignedAthleteId,
          name,
          address: address || name,
          projectType,
          customProjectTypeId,
          designStage,
          feeZar,
          phaseFeePercents: defaultSplits,
          phaseCostPercents: defaultSplits,
          briefReceivedAt,
          stageStartedAt: new Date(),
          stageNotes: body.stageNotes ? String(body.stageNotes) : null,
        },
        include: projectInclude,
      });

      await tx.privateProjectUpdate.create({
        data: {
          projectId: project.id,
          title: "Project opened",
          body: `Brief received. Starting at ${designStage.replace(/_/g, " ")}.`,
          clientVisible: true,
          occurredAt: briefReceivedAt ?? new Date(),
        },
      });

      return project;
    });

    return NextResponse.json({ project: serializePrivateProject(created) }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not create client & project" }, { status: 500 });
  }
}
