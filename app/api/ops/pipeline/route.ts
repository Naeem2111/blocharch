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

export async function GET(request: NextRequest) {
  const gate = await requireOpsPipelineSession(request);
  if (gate instanceof NextResponse) return gate;

  const clientId = request.nextUrl.searchParams.get("clientId")?.trim() || null;
  const includeConverted = request.nextUrl.searchParams.get("includeConverted") === "1";

  const rows = await prisma.opsPipelineProject.findMany({
    where: {
      ...(clientId ? { clientId } : {}),
      ...(includeConverted ? {} : { convertedAt: null }),
    },
    orderBy: [{ sortOrder: "asc" }, { targetDueDate: "asc" }, { updatedAt: "desc" }],
    include: { client: { select: clientSelect } },
  });

  return NextResponse.json({
    pipeline: rows.map((row) => serializePipelineRow(row)),
  });
}

export async function POST(request: NextRequest) {
  const gate = await requireOpsPipelineSession(request);
  if (gate instanceof NextResponse) return gate;

  try {
    const body = await request.json();
    const clientId = String(body.clientId || "").trim();
    const name = String(body.name || "").trim();
    if (!clientId || !name) {
      return NextResponse.json({ error: "Client and project name are required" }, { status: 400 });
    }

    const client = await prisma.opsClient.findUnique({ where: { id: clientId }, select: { id: true } });
    if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

    const expectedStageRaw = String(body.expectedStage || "").trim();
    const expectedStage = isOpsProjectPhase(expectedStageRaw) ? expectedStageRaw : null;

    const maxOrder = await prisma.opsPipelineProject.aggregate({
      where: { clientId, convertedAt: null },
      _max: { sortOrder: true },
    });

    const row = await prisma.opsPipelineProject.create({
      data: {
        clientId,
        name,
        address: body.address ? String(body.address).trim() : null,
        description: body.description ? String(body.description).trim() : null,
        expectedStage,
        targetStartDate: body.targetStartDate ? parseDateOnly(String(body.targetStartDate)) : null,
        targetDueDate: body.targetDueDate ? parseDateOnly(String(body.targetDueDate)) : null,
        notes: body.notes ? String(body.notes).trim() : null,
        visibleToClient: body.visibleToClient !== false,
        sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
      },
      include: { client: { select: clientSelect } },
    });

    return NextResponse.json({ pipeline: serializePipelineRow(row) }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
