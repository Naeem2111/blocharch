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

  const updated = await prisma.privateActionItem.update({
    where: { id: actionId },
    data: {
      completedAt: body.complete === false ? null : new Date(),
    },
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
