import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePrivateOpsSession } from "@/lib/private-access";
import { parseDateOnly } from "@/lib/ops-hours";

function serializeUpdate(u: {
  id: string;
  title: string;
  body: string | null;
  clientVisible: boolean;
  occurredAt: Date;
}) {
  return {
    id: u.id,
    title: u.title,
    body: u.body,
    clientVisible: u.clientVisible,
    occurredAt: u.occurredAt.toISOString().slice(0, 10),
  };
}

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

  const occurredAt = body.occurredAt ? parseDateOnly(String(body.occurredAt)) : new Date();

  const update = await prisma.privateProjectUpdate.create({
    data: {
      projectId: params.id,
      title,
      body: body.body ? String(body.body).trim() : null,
      clientVisible: Boolean(body.clientVisible),
      occurredAt: occurredAt ?? new Date(),
    },
  });

  return NextResponse.json({ update: serializeUpdate(update) }, { status: 201 });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const gate = await requirePrivateOpsSession(request);
  if (gate instanceof NextResponse) return gate;

  const body = await request.json();
  const updateId = String(body.updateId || "").trim();
  if (!updateId) return NextResponse.json({ error: "updateId required" }, { status: 400 });

  const existing = await prisma.privateProjectUpdate.findFirst({
    where: { id: updateId, projectId: params.id },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data: { title?: string; body?: string | null; clientVisible?: boolean } = {};
  if (body.title !== undefined) {
    const title = String(body.title || "").trim();
    if (!title) return NextResponse.json({ error: "Title required" }, { status: 400 });
    data.title = title;
  }
  if (body.body !== undefined) data.body = String(body.body || "").trim() || null;
  if (body.clientVisible !== undefined) data.clientVisible = Boolean(body.clientVisible);

  const update = await prisma.privateProjectUpdate.update({
    where: { id: updateId },
    data,
  });

  return NextResponse.json({ update: serializeUpdate(update) });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const gate = await requirePrivateOpsSession(request);
  if (gate instanceof NextResponse) return gate;

  const body = await request.json().catch(() => ({}));
  const updateId = String(
    body.updateId || request.nextUrl.searchParams.get("updateId") || "",
  ).trim();
  if (!updateId) return NextResponse.json({ error: "updateId required" }, { status: 400 });

  const existing = await prisma.privateProjectUpdate.findFirst({
    where: { id: updateId, projectId: params.id },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.privateProjectUpdate.delete({ where: { id: updateId } });
  return NextResponse.json({ ok: true });
}
