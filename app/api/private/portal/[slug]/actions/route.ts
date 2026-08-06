import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** Client portal: mark a client-facing action item as done (no login). */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { slug: string } },
) {
  const slug = params.slug.trim();
  if (!slug) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const client = await prisma.privateClient.findFirst({
    where: { slug, portalEnabled: true },
    select: { id: true },
  });
  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const project = await prisma.privateProject.findFirst({
    where: {
      clientId: client.id,
      status: { in: ["active", "completed", "on_hold"] },
    },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();
  const actionId = String(body.actionItemId || "").trim();
  if (!actionId) return NextResponse.json({ error: "actionItemId required" }, { status: 400 });

  const item = await prisma.privateActionItem.findFirst({
    where: {
      id: actionId,
      projectId: project.id,
      clientFacing: true,
      completedAt: null,
    },
  });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.privateActionItem.update({
    where: { id: actionId },
    data: { completedAt: new Date() },
  });

  return NextResponse.json({
    actionItem: {
      id: updated.id,
      title: updated.title,
      completedAt: updated.completedAt?.toISOString() ?? null,
    },
  });
}
