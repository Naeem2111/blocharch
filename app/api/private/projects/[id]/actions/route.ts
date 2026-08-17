import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePrivateOpsSession } from "@/lib/private-access";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const gate = await requirePrivateOpsSession(request);
  if (gate instanceof NextResponse) return gate;

  const project = await prisma.privateProject.findUnique({ where: { id: params.id } });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();
  const title = String(body.title || "").trim();
  if (!title) return NextResponse.json({ error: "Title required" }, { status: 400 });

  const item = await prisma.privateActionItem.create({
    data: {
      projectId: params.id,
      title,
      clientFacing: body.clientFacing !== false,
    },
  });

  return NextResponse.json({
    actionItem: {
      id: item.id,
      title: item.title,
      clientFacing: item.clientFacing,
      completedAt: null,
    },
  }, { status: 201 });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const gate = await requirePrivateOpsSession(request);
  if (gate instanceof NextResponse) return gate;

  const body = await request.json();
  const actionId = String(body.actionItemId || "").trim();
  if (!actionId) return NextResponse.json({ error: "actionItemId required" }, { status: 400 });

  const item = await prisma.privateActionItem.findFirst({
    where: { id: actionId, projectId: params.id },
  });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updateData: { completedAt?: Date | null; title?: string; clientFacing?: boolean } = {};

  if (body.complete !== undefined) {
    updateData.completedAt = body.complete === false ? null : new Date();
  }

  if (body.title !== undefined) {
    const title = String(body.title).trim();
    if (!title) return NextResponse.json({ error: "Title required" }, { status: 400 });
    updateData.title = title;
  }

  if (body.clientFacing !== undefined) {
    updateData.clientFacing = Boolean(body.clientFacing);
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "No updates provided" }, { status: 400 });
  }

  const updated = await prisma.privateActionItem.update({
    where: { id: actionId },
    data: updateData,
  });

  return NextResponse.json({
    actionItem: {
      id: updated.id,
      title: updated.title,
      clientFacing: updated.clientFacing,
      completedAt: updated.completedAt?.toISOString() ?? null,
    },
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const gate = await requirePrivateOpsSession(request);
  if (gate instanceof NextResponse) return gate;

  const body = await request.json().catch(() => ({}));
  const actionId = String(
    body.actionItemId || request.nextUrl.searchParams.get("actionItemId") || "",
  ).trim();
  if (!actionId) return NextResponse.json({ error: "actionItemId required" }, { status: 400 });

  const item = await prisma.privateActionItem.findFirst({
    where: { id: actionId, projectId: params.id },
  });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.privateActionItem.delete({ where: { id: actionId } });

  return NextResponse.json({ ok: true });
}
