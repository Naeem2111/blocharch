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
  reorderOpsCatalog,
  type OpsCatalogKind,
} from "@/lib/ops-catalog";
import {
  isPrivateCatalogPhaseKey,
  isPrivateCatalogWorkTypeKey,
  listPrivateCatalog,
  PRIVATE_CATALOG_PHASES,
  PRIVATE_CATALOG_WORK_TYPES,
  reorderPrivateCatalog,
} from "@/lib/private-catalog";

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

function isPrivateSet(raw: unknown): boolean {
  return String(raw || "").trim() === "private";
}

export async function GET(request: NextRequest) {
  const gate = await requireCatalogRead(request);
  if (gate instanceof NextResponse) return gate;
  const catalog = isPrivateSet(request.nextUrl.searchParams.get("set"))
    ? await listPrivateCatalog()
    : await listOpsCatalog();
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
  if (isPrivateSet(body.set)) return addPrivateCatalogItem(kind, label);

  if (kind === "phase") {
    const existing = await prisma.opsCatalogPhase.findFirst({
      where: { label: { equals: label, mode: "insensitive" }, builtInKey: null },
    });
    if (existing) {
      return NextResponse.json({ error: "A phase / package with this label already exists" }, { status: 400 });
    }
    const maxSort = await prisma.opsCatalogPhase.aggregate({
      _max: { sortOrder: true },
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
  if (!kind) return NextResponse.json({ error: "kind must be phase or work_type" }, { status: 400 });
  if (isPrivateSet(body.set)) return patchPrivateCatalog(kind, body);

  if (Array.isArray(body.order)) {
    const values = body.order.map((value: unknown) => String(value || "").trim()).filter(Boolean);
    const error = await reorderOpsCatalog(kind, values);
    if (error) return NextResponse.json({ error }, { status: 400 });
    return NextResponse.json(await listOpsCatalog());
  }

  const label = String(body.label || "").trim();
  const id = body.id ? String(body.id).trim() : "";
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
  const builtInKeyRaw = body.builtInKey ? String(body.builtInKey).trim() : "";
  if (!kind) return NextResponse.json({ error: "kind must be phase or work_type" }, { status: 400 });
  if (isPrivateSet(body.set)) return deletePrivateCatalogItem(kind, id, builtInKeyRaw);

  if (kind === "phase") {
    const builtInKey =
      builtInKeyRaw && isOpsProjectPhase(builtInKeyRaw) && builtInKeyRaw !== "custom"
        ? (builtInKeyRaw as OpsProjectPhase)
        : null;

    if (builtInKey) {
      const row = await prisma.opsCatalogPhase.upsert({
        where: { builtInKey },
        create: {
          label: PROJECT_PHASE_LABELS[builtInKey],
          builtInKey,
          hidden: true,
          sortOrder: 0,
        },
        update: { hidden: true },
      });
      return NextResponse.json({ ok: true, hidden: true, id: row.id });
    }

    if (!id) return NextResponse.json({ error: "id or builtInKey required" }, { status: 400 });
    const row = await prisma.opsCatalogPhase.findUnique({ where: { id } });
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (row.builtInKey) {
      await prisma.opsCatalogPhase.update({ where: { id }, data: { hidden: true } });
      return NextResponse.json({ ok: true, hidden: true });
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

  const builtInKey =
    builtInKeyRaw && isOpsTaskType(builtInKeyRaw) ? (builtInKeyRaw as OpsTaskType) : null;

  if (builtInKey) {
    const row = await prisma.opsCatalogWorkType.upsert({
      where: { builtInKey },
      create: {
        label: TASK_TYPE_LABELS[builtInKey],
        builtInKey,
        hidden: true,
        sortOrder: 0,
      },
      update: { hidden: true },
    });
    return NextResponse.json({ ok: true, hidden: true, id: row.id });
  }

  if (!id) return NextResponse.json({ error: "id or builtInKey required" }, { status: 400 });
  const row = await prisma.opsCatalogWorkType.findUnique({ where: { id } });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (row.builtInKey) {
    await prisma.opsCatalogWorkType.update({ where: { id }, data: { hidden: true } });
    return NextResponse.json({ ok: true, hidden: true });
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

async function addPrivateCatalogItem(kind: OpsCatalogKind, label: string) {
  if (kind === "phase") {
    const existing = await prisma.privateCatalogPhase.findFirst({
      where: { label: { equals: label, mode: "insensitive" }, builtInKey: null, hidden: false },
    });
    if (existing) {
      return NextResponse.json({ error: "A private phase with this label already exists" }, { status: 400 });
    }
    const maxSort = await prisma.privateCatalogPhase.aggregate({ _max: { sortOrder: true } });
    const row = await prisma.privateCatalogPhase.create({
      data: { label, sortOrder: (maxSort._max.sortOrder ?? 0) + 1 },
    });
    return NextResponse.json(
      { option: { id: row.id, value: catalogValueFromId(row.id), label: row.label, builtInKey: null, isBuiltIn: false } },
      { status: 201 },
    );
  }
  const existing = await prisma.privateCatalogWorkType.findFirst({
    where: { label: { equals: label, mode: "insensitive" }, builtInKey: null, hidden: false },
  });
  if (existing) {
    return NextResponse.json({ error: "A private work type with this label already exists" }, { status: 400 });
  }
  const maxSort = await prisma.privateCatalogWorkType.aggregate({ _max: { sortOrder: true } });
  const row = await prisma.privateCatalogWorkType.create({
    data: { label, sortOrder: (maxSort._max.sortOrder ?? 0) + 1 },
  });
  return NextResponse.json(
    { option: { id: row.id, value: catalogValueFromId(row.id), label: row.label, builtInKey: null, isBuiltIn: false } },
    { status: 201 },
  );
}

async function patchPrivateCatalog(kind: OpsCatalogKind, body: { order?: unknown; label?: unknown; id?: unknown; builtInKey?: unknown }) {
  if (Array.isArray(body.order)) {
    const values = body.order.map((value: unknown) => String(value || "").trim()).filter(Boolean);
    const error = await reorderPrivateCatalog(kind, values);
    if (error) return NextResponse.json({ error }, { status: 400 });
    return NextResponse.json(await listPrivateCatalog());
  }
  const label = String(body.label || "").trim();
  const id = body.id ? String(body.id).trim() : "";
  if (!label) return NextResponse.json({ error: "Label required" }, { status: 400 });
  const builtInKey = body.builtInKey ? String(body.builtInKey).trim() : "";

  if (kind === "phase") {
    if (builtInKey && isPrivateCatalogPhaseKey(builtInKey)) {
      const fallback = PRIVATE_CATALOG_PHASES.find((item) => item.key === builtInKey)?.label ?? label;
      const row = await prisma.privateCatalogPhase.upsert({
        where: { builtInKey },
        create: { label, builtInKey, sortOrder: 0 },
        update: { label },
      });
      return NextResponse.json({
        option: { id: row.id, value: builtInKey, label: row.label || fallback, builtInKey, isBuiltIn: true },
      });
    }
    if (!id) return NextResponse.json({ error: "id or builtInKey required" }, { status: 400 });
    const existing = await prisma.privateCatalogPhase.findFirst({ where: { id, builtInKey: null } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const row = await prisma.privateCatalogPhase.update({ where: { id }, data: { label } });
    return NextResponse.json({
      option: { id: row.id, value: catalogValueFromId(row.id), label: row.label, builtInKey: null, isBuiltIn: false },
    });
  }

  if (builtInKey && isPrivateCatalogWorkTypeKey(builtInKey)) {
    const row = await prisma.privateCatalogWorkType.upsert({
      where: { builtInKey },
      create: { label, builtInKey, sortOrder: 0 },
      update: { label },
    });
    return NextResponse.json({
      option: { id: row.id, value: builtInKey, label: row.label, builtInKey, isBuiltIn: true },
    });
  }
  if (!id) return NextResponse.json({ error: "id or builtInKey required" }, { status: 400 });
  const existing = await prisma.privateCatalogWorkType.findFirst({ where: { id, builtInKey: null } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const row = await prisma.privateCatalogWorkType.update({ where: { id }, data: { label } });
  return NextResponse.json({
    option: { id: row.id, value: catalogValueFromId(row.id), label: row.label, builtInKey: null, isBuiltIn: false },
  });
}

async function deletePrivateCatalogItem(kind: OpsCatalogKind, id: string, builtInKeyRaw: string) {
  if (kind === "phase") {
    if (builtInKeyRaw && isPrivateCatalogPhaseKey(builtInKeyRaw)) {
      const label = PRIVATE_CATALOG_PHASES.find((item) => item.key === builtInKeyRaw)?.label ?? builtInKeyRaw;
      const row = await prisma.privateCatalogPhase.upsert({
        where: { builtInKey: builtInKeyRaw },
        create: { label, builtInKey: builtInKeyRaw, hidden: true, sortOrder: 0 },
        update: { hidden: true },
      });
      return NextResponse.json({ ok: true, hidden: true, id: row.id });
    }
    if (!id) return NextResponse.json({ error: "id or builtInKey required" }, { status: 400 });
    const row = await prisma.privateCatalogPhase.findUnique({ where: { id } });
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (row.builtInKey) {
      await prisma.privateCatalogPhase.update({ where: { id }, data: { hidden: true } });
      return NextResponse.json({ ok: true, hidden: true });
    }
    await prisma.privateCatalogPhase.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  }

  if (builtInKeyRaw && isPrivateCatalogWorkTypeKey(builtInKeyRaw)) {
    const label = PRIVATE_CATALOG_WORK_TYPES.find((item) => item.key === builtInKeyRaw)?.label ?? builtInKeyRaw;
    const row = await prisma.privateCatalogWorkType.upsert({
      where: { builtInKey: builtInKeyRaw },
      create: { label, builtInKey: builtInKeyRaw, hidden: true, sortOrder: 0 },
      update: { hidden: true },
    });
    return NextResponse.json({ ok: true, hidden: true, id: row.id });
  }
  if (!id) return NextResponse.json({ error: "id or builtInKey required" }, { status: 400 });
  const row = await prisma.privateCatalogWorkType.findUnique({ where: { id } });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (row.builtInKey) {
    await prisma.privateCatalogWorkType.update({ where: { id }, data: { hidden: true } });
    return NextResponse.json({ ok: true, hidden: true });
  }
  await prisma.privateCatalogWorkType.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
