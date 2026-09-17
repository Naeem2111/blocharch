import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { OpsProjectPhase, OpsTaskType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionFromRequest } from "@/lib/auth";
import { canAccessModule } from "@/lib/permissions";
import { requireOpsSession } from "@/lib/ops-access";
import {
  isOpsProjectPhase,
  isOpsTaskType,
  PROJECT_PHASE_LABELS,
  TASK_TYPE_LABELS,
} from "@/lib/ops-constants";
import {
  catalogValueFromId,
  listOpsCatalog,
  type OpsCatalogKind,
} from "@/lib/ops-catalog";

async function requireCatalogRead(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const ops = canAccessModule(session.user.role, "ops", session.user.username);
  const athlete = canAccessModule(session.user.role, "athlete_portal", session.user.username);
  if (!ops && !athlete) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return { user: session.user };
}

function parseKind(raw: unknown): OpsCatalogKind | null {
  const kind = String(raw || "").trim();
  return kind === "phase" || kind === "work_type" ? kind : null;
}

export async function GET(request: NextRequest) {
  const gate = await requireCatalogRead(request);
  if (gate instanceof NextResponse) return gate;
  const catalog = await listOpsCatalog();
  return NextResponse.json(catalog);
}

export async function POST(request: NextRequest) {
  const gate = await requireOpsSession(request);
  if (gate instanceof NextResponse) return gate;

  const body = await request.json();
  const kind = parseKind(body.kind);
  const label = String(body.label || "").trim();
  if (!kind) return NextResponse.json({ error: "kind must be phase or work_type" }, { status: 400 });
  if (!label) return NextResponse.json({ error: "Label required" }, { status: 400 });

  if (kind === "phase") {
    const existing = await prisma.opsCatalogPhase.findFirst({
      where: { label: { equals: label, mode: "insensitive" }, builtInKey: null },
    });
    if (existing) {
      return NextResponse.json({ error: "A phase / package with this label already exists" }, { status: 400 });
    }
    const maxSort = await prisma.opsCatalogPhase.aggregate({
      _max: { sortOrder: true },
      where: { builtInKey: null },
    });
    const row = await prisma.opsCatalogPhase.create({
      data: { label, sortOrder: (maxSort._max.sortOrder ?? 0) + 1 },
    });
    return NextResponse.json(
      {
        option: {
          id: row.id,
          value: catalogValueFromId(row.id),
          label: row.label,
          builtInKey: null,
          isBuiltIn: false,
        },
      },
      { status: 201 },
    );
  }

  const existing = await prisma.opsCatalogWorkType.findFirst({
    where: { label: { equals: label, mode: "insensitive" }, builtInKey: null },
  });
  if (existing) {
    return NextResponse.json({ error: "A work type with this label already exists" }, { status: 400 });
  }
  const maxSort = await prisma.opsCatalogWorkType.aggregate({
    _max: { sortOrder: true },
    where: { builtInKey: null },
  });
  const row = await prisma.opsCatalogWorkType.create({
    data: { label, sortOrder: (maxSort._max.sortOrder ?? 0) + 1 },
  });
  return NextResponse.json(
    {
      option: {
        id: row.id,
        value: catalogValueFromId(row.id),
        label: row.label,
        builtInKey: null,
        isBuiltIn: false,
      },
    },
    { status: 201 },
  );
}

export async function PATCH(request: NextRequest) {
  const gate = await requireOpsSession(request);
  if (gate instanceof NextResponse) return gate;

  const body = await request.json();
  const kind = parseKind(body.kind);
  const label = String(body.label || "").trim();
  const id = body.id ? String(body.id).trim() : "";
  if (!kind) return NextResponse.json({ error: "kind must be phase or work_type" }, { status: 400 });
  if (!label) return NextResponse.json({ error: "Label required" }, { status: 400 });

  if (kind === "phase") {
    const builtInKey =
      body.builtInKey && isOpsProjectPhase(String(body.builtInKey)) && String(body.builtInKey) !== "custom"
        ? (String(body.builtInKey) as OpsProjectPhase)
        : null;
    if (builtInKey) {
      const row = await prisma.opsCatalogPhase.upsert({
        where: { builtInKey },
        create: { label, builtInKey, sortOrder: 0 },
        update: { label },
      });
      return NextResponse.json({
        option: {
          id: row.id,
          value: builtInKey,
          label: row.label,
          builtInKey,
          isBuiltIn: true,
        },
      });
    }
    if (!id) return NextResponse.json({ error: "id or builtInKey required" }, { status: 400 });
    const existing = await prisma.opsCatalogPhase.findFirst({ where: { id, builtInKey: null } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const row = await prisma.opsCatalogPhase.update({ where: { id }, data: { label } });
    return NextResponse.json({
      option: {
        id: row.id,
        value: catalogValueFromId(row.id),
        label: row.label,
        builtInKey: null,
        isBuiltIn: false,
      },
    });
  }

  const builtInKey =
    body.builtInKey && isOpsTaskType(String(body.builtInKey))
      ? (String(body.builtInKey) as OpsTaskType)
      : null;
  if (builtInKey) {
    const row = await prisma.opsCatalogWorkType.upsert({
      where: { builtInKey },
      create: { label, builtInKey, sortOrder: 0 },
      update: { label },
    });
    return NextResponse.json({
      option: {
        id: row.id,
        value: builtInKey,
        label: row.label,
        builtInKey,
        isBuiltIn: true,
      },
    });
  }
  if (!id) return NextResponse.json({ error: "id or builtInKey required" }, { status: 400 });
  const existing = await prisma.opsCatalogWorkType.findFirst({ where: { id, builtInKey: null } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const row = await prisma.opsCatalogWorkType.update({ where: { id }, data: { label } });
  return NextResponse.json({
    option: {
      id: row.id,
      value: catalogValueFromId(row.id),
      label: row.label,
      builtInKey: null,
      isBuiltIn: false,
    },
  });
}

export async function DELETE(request: NextRequest) {
  const gate = await requireOpsSession(request);
  if (gate instanceof NextResponse) return gate;

  const body = await request.json().catch(() => ({}));
  const kind = parseKind(body.kind);
  const id = String(body.id || "").trim();
  if (!kind) return NextResponse.json({ error: "kind must be phase or work_type" }, { status: 400 });
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  if (kind === "phase") {
    const row = await prisma.opsCatalogPhase.findUnique({ where: { id } });
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (row.builtInKey) {
      return NextResponse.json(
        {
          error: `Built-in packages cannot be deleted. Reset the label to “${PROJECT_PHASE_LABELS[row.builtInKey]}”.`,
        },
        { status: 400 },
      );
    }
    const [projectCount, lineCount] = await Promise.all([
      prisma.opsProject.count({ where: { customStageId: id } }),
      prisma.opsSubmissionLineItem.count({ where: { customPhaseId: id } }),
    ]);
    if (projectCount + lineCount > 0) {
      return NextResponse.json(
        { error: "This phase / package is in use and cannot be removed." },
        { status: 400 },
      );
    }
    await prisma.opsCatalogPhase.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  }

  const row = await prisma.opsCatalogWorkType.findUnique({ where: { id } });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (row.builtInKey) {
    return NextResponse.json(
      {
        error: `Built-in work types cannot be deleted. Reset the label to “${TASK_TYPE_LABELS[row.builtInKey]}”.`,
      },
      { status: 400 },
    );
  }
  const inUse = await prisma.opsSubmissionLineItem.count({
    where: { taskTypes: { has: catalogValueFromId(id) } },
  });
  if (inUse > 0) {
    return NextResponse.json(
      { error: "This work type is used on daily logs and cannot be removed." },
      { status: 400 },
    );
  }
  await prisma.opsCatalogWorkType.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
