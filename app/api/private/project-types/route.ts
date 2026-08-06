import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePrivateOpsSession } from "@/lib/private-access";
import { listPrivateProjectTypeOptions } from "@/lib/private-project-types";
import { PRIVATE_PROJECT_TYPE_LABELS } from "@/lib/private-constants";
import type { PrivateProjectType } from "@prisma/client";

export async function GET(request: NextRequest) {
  const gate = await requirePrivateOpsSession(request);
  if (gate instanceof NextResponse) return gate;

  const options = await listPrivateProjectTypeOptions();
  return NextResponse.json(options);
}

export async function POST(request: NextRequest) {
  const gate = await requirePrivateOpsSession(request);
  if (gate instanceof NextResponse) return gate;

  const body = await request.json();
  const label = String(body.label || "").trim();
  if (!label) return NextResponse.json({ error: "Label required" }, { status: 400 });

  const existing = await prisma.privateProjectCustomType.findFirst({
    where: { label: { equals: label, mode: "insensitive" } },
  });
  if (existing) {
    return NextResponse.json({ error: "A project type with this label already exists" }, { status: 400 });
  }

  const maxSort = await prisma.privateProjectCustomType.aggregate({
    _max: { sortOrder: true },
    where: { builtInKey: null },
  });

  const row = await prisma.privateProjectCustomType.create({
    data: {
      label,
      sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
    },
  });

  return NextResponse.json(
    {
      type: {
        id: row.id,
        value: `custom:${row.id}`,
        label: row.label,
        builtInKey: null,
        isBuiltIn: false,
      },
    },
    { status: 201 },
  );
}

export async function PATCH(request: NextRequest) {
  const gate = await requirePrivateOpsSession(request);
  if (gate instanceof NextResponse) return gate;

  const body = await request.json();
  const label = String(body.label || "").trim();
  if (!label) return NextResponse.json({ error: "Label required" }, { status: 400 });

  const builtInKey = body.builtInKey
    ? (String(body.builtInKey) as PrivateProjectType)
    : null;
  const id = body.id ? String(body.id).trim() : null;

  if (builtInKey && builtInKey !== "residential_extension" && builtInKey !== "commercial") {
    return NextResponse.json({ error: "Invalid built-in type" }, { status: 400 });
  }

  const duplicate = await prisma.privateProjectCustomType.findFirst({
    where: {
      label: { equals: label, mode: "insensitive" },
      NOT: builtInKey ? { builtInKey } : id ? { id } : undefined,
    },
  });
  if (duplicate) {
    return NextResponse.json({ error: "A project type with this label already exists" }, { status: 400 });
  }

  let row;
  if (builtInKey) {
    row = await prisma.privateProjectCustomType.upsert({
      where: { builtInKey },
      create: { label, builtInKey, sortOrder: builtInKey === "residential_extension" ? 0 : 1 },
      update: { label },
    });
  } else if (id) {
    const existing = await prisma.privateProjectCustomType.findFirst({
      where: { id, builtInKey: null },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    row = await prisma.privateProjectCustomType.update({
      where: { id },
      data: { label },
    });
  } else {
    return NextResponse.json({ error: "id or builtInKey required" }, { status: 400 });
  }

  return NextResponse.json({
    type: {
      id: row.id,
      value: row.builtInKey ?? `custom:${row.id}`,
      label: row.label,
      builtInKey: row.builtInKey,
      isBuiltIn: row.builtInKey != null,
    },
  });
}

export async function DELETE(request: NextRequest) {
  const gate = await requirePrivateOpsSession(request);
  if (gate instanceof NextResponse) return gate;

  const body = await request.json().catch(() => ({}));
  const id = String(body.id || request.nextUrl.searchParams.get("id") || "").trim();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const row = await prisma.privateProjectCustomType.findUnique({ where: { id } });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (row.builtInKey) {
    return NextResponse.json(
      {
        error: `Built-in types cannot be deleted. Reset the label to "${PRIVATE_PROJECT_TYPE_LABELS[row.builtInKey]}".`,
      },
      { status: 400 },
    );
  }

  const inUse = await prisma.privateProject.count({
    where: { customProjectTypeId: id },
  });
  if (inUse > 0) {
    return NextResponse.json(
      { error: "This type is used on existing projects and cannot be removed." },
      { status: 400 },
    );
  }

  await prisma.privateProjectCustomType.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
