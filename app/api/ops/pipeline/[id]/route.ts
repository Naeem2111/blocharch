import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isOpsProjectPhase } from "@/lib/ops-constants";
import { requireOpsPipelineSession } from "@/lib/ops-access";
import { parseDateOnly } from "@/lib/ops-hours";
import { serializePipelineRow } from "@/lib/ops-pipeline-serialize";

const clientSelect = {
  name: true,
  logoUrl: true,
  logoBgColor: true,
  logoTextTone: true,
} as const;

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const gate = await requireOpsPipelineSession(request);
  if (gate instanceof NextResponse) return gate;

  const { id } = await context.params;
  const existing = await prisma.opsPipelineProject.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.convertedAt) {
    return NextResponse.json({ error: "Converted pipeline items cannot be edited" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const data: Record<string, unknown> = {};

    if (body.name != null) {
      const name = String(body.name).trim();
      if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
      data.name = name;
    }
    if (body.clientId != null) {
      const clientId = String(body.clientId).trim();
      const client = await prisma.opsClient.findUnique({ where: { id: clientId }, select: { id: true } });
      if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });
      data.clientId = clientId;
    }
    if (body.address !== undefined) data.address = body.address ? String(body.address).trim() : null;
    if (body.description !== undefined) data.description = body.description ? String(body.description).trim() : null;
    if (body.notes !== undefined) data.notes = body.notes ? String(body.notes).trim() : null;
    if (body.visibleToClient !== undefined) data.visibleToClient = Boolean(body.visibleToClient);
    if (body.expectedStage !== undefined) {
      const stage = String(body.expectedStage || "").trim();
      data.expectedStage = stage && isOpsProjectPhase(stage) ? stage : null;
    }
    if (body.targetStartDate !== undefined) {
      data.targetStartDate = body.targetStartDate ? parseDateOnly(String(body.targetStartDate)) : null;
    }
    if (body.targetDueDate !== undefined) {
      data.targetDueDate = body.targetDueDate ? parseDateOnly(String(body.targetDueDate)) : null;
    }
    if (body.sortOrder !== undefined) data.sortOrder = Number(body.sortOrder) || 0;

    const row = await prisma.opsPipelineProject.update({
      where: { id },
      data,
      include: { client: { select: clientSelect } },
    });

    return NextResponse.json({ pipeline: serializePipelineRow(row) });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const gate = await requireOpsPipelineSession(request);
  if (gate instanceof NextResponse) return gate;

  const { id } = await context.params;
  const existing = await prisma.opsPipelineProject.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.opsPipelineProject.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
