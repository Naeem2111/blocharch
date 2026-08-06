import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePrivateOpsSession } from "@/lib/private-access";
import { isPrivateDesignStage, PRIVATE_STAGE_LABELS } from "@/lib/private-constants";
import { parseDateOnly } from "@/lib/ops-hours";
import type { PrivateDesignStage } from "@prisma/client";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const gate = await requirePrivateOpsSession(request);
  if (gate instanceof NextResponse) return gate;

  const project = await prisma.privateProject.findUnique({
    where: { id: params.id },
    select: { id: true, name: true, designStage: true },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const expenses = await prisma.privateProjectExpense.findMany({
    where: { projectId: params.id },
    orderBy: [{ expenseDate: "desc" }, { createdAt: "desc" }],
  });

  const totalZar = expenses.reduce((sum, e) => sum + Number(e.amountZar), 0);

  return NextResponse.json({
    project: { id: project.id, name: project.name, designStage: project.designStage },
    expenses: expenses.map((e) => ({
      id: e.id,
      description: e.description,
      amountZar: Number(e.amountZar),
      expenseDate: e.expenseDate.toISOString().slice(0, 10),
      designStage: e.designStage,
      designStageLabel: e.designStage ? PRIVATE_STAGE_LABELS[e.designStage] : null,
      notes: e.notes,
    })),
    totalZar,
  });
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
  const description = String(body.description || "").trim();
  if (!description) {
    return NextResponse.json({ error: "Description required" }, { status: 400 });
  }

  const amountZar = Number(body.amountZar);
  if (!Number.isFinite(amountZar) || amountZar <= 0) {
    return NextResponse.json({ error: "Valid amount required" }, { status: 400 });
  }

  const expenseDate = body.expenseDate
    ? parseDateOnly(String(body.expenseDate))
    : new Date();
  if (!expenseDate) {
    return NextResponse.json({ error: "Invalid expense date" }, { status: 400 });
  }

  const designStageRaw = body.designStage ? String(body.designStage) : project.designStage;
  const designStage = isPrivateDesignStage(designStageRaw) ? designStageRaw : project.designStage;

  const expense = await prisma.privateProjectExpense.create({
    data: {
      projectId: params.id,
      description,
      amountZar,
      expenseDate,
      designStage,
      notes: body.notes ? String(body.notes).trim() || null : null,
    },
  });

  return NextResponse.json(
    {
      expense: {
        id: expense.id,
        description: expense.description,
        amountZar: Number(expense.amountZar),
        expenseDate: expense.expenseDate.toISOString().slice(0, 10),
        designStage: expense.designStage,
        notes: expense.notes,
      },
    },
    { status: 201 },
  );
}

function serializeExpense(e: {
  id: string;
  description: string;
  amountZar: { toNumber?: () => number } | number | string;
  expenseDate: Date;
  designStage: string | null;
  notes: string | null;
}) {
  return {
    id: e.id,
    description: e.description,
    amountZar: Number(e.amountZar),
    expenseDate: e.expenseDate.toISOString().slice(0, 10),
    designStage: e.designStage,
    notes: e.notes,
  };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const gate = await requirePrivateOpsSession(request);
  if (gate instanceof NextResponse) return gate;

  const body = await request.json();
  const expenseId = String(body.expenseId || "").trim();
  if (!expenseId) return NextResponse.json({ error: "expenseId required" }, { status: 400 });

  const expense = await prisma.privateProjectExpense.findFirst({
    where: { id: expenseId, projectId: params.id },
  });
  if (!expense) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updateData: {
    description?: string;
    amountZar?: number;
    expenseDate?: Date;
    designStage?: PrivateDesignStage | null;
    notes?: string | null;
  } = {};

  if (body.description !== undefined) {
    const description = String(body.description).trim();
    if (!description) return NextResponse.json({ error: "Description required" }, { status: 400 });
    updateData.description = description;
  }

  if (body.amountZar !== undefined) {
    const amountZar = Number(body.amountZar);
    if (!Number.isFinite(amountZar) || amountZar <= 0) {
      return NextResponse.json({ error: "Valid amount required" }, { status: 400 });
    }
    updateData.amountZar = amountZar;
  }

  if (body.expenseDate !== undefined) {
    const expenseDate = parseDateOnly(String(body.expenseDate));
    if (!expenseDate) return NextResponse.json({ error: "Invalid expense date" }, { status: 400 });
    updateData.expenseDate = expenseDate;
  }

  if (body.designStage !== undefined) {
    if (body.designStage === null || body.designStage === "") {
      updateData.designStage = null;
    } else if (isPrivateDesignStage(String(body.designStage))) {
      updateData.designStage = String(body.designStage) as PrivateDesignStage;
    } else {
      return NextResponse.json({ error: "Invalid design phase" }, { status: 400 });
    }
  }

  if (body.notes !== undefined) {
    updateData.notes = body.notes ? String(body.notes).trim() || null : null;
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "No updates provided" }, { status: 400 });
  }

  const updated = await prisma.privateProjectExpense.update({
    where: { id: expenseId },
    data: updateData,
  });

  return NextResponse.json({ expense: serializeExpense(updated) });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const gate = await requirePrivateOpsSession(request);
  if (gate instanceof NextResponse) return gate;

  const body = await request.json().catch(() => ({}));
  const expenseId = String(
    body.expenseId || request.nextUrl.searchParams.get("expenseId") || "",
  ).trim();
  if (!expenseId) return NextResponse.json({ error: "expenseId required" }, { status: 400 });

  const expense = await prisma.privateProjectExpense.findFirst({
    where: { id: expenseId, projectId: params.id },
  });
  if (!expense) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.privateProjectExpense.delete({ where: { id: expenseId } });

  return NextResponse.json({ ok: true });
}
