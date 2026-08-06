import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePrivateOpsSession } from "@/lib/private-access";
import { parseDateOnly } from "@/lib/ops-hours";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const gate = await requirePrivateOpsSession(request);
  if (gate instanceof NextResponse) return gate;

  const project = await prisma.privateProject.findUnique({
    where: { id: params.id },
    select: { id: true, name: true },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const expenses = await prisma.privateProjectExpense.findMany({
    where: { projectId: params.id },
    orderBy: [{ expenseDate: "desc" }, { createdAt: "desc" }],
  });

  const totalZar = expenses.reduce((sum, e) => sum + Number(e.amountZar), 0);

  return NextResponse.json({
    project: { id: project.id, name: project.name },
    expenses: expenses.map((e) => ({
      id: e.id,
      description: e.description,
      amountZar: Number(e.amountZar),
      expenseDate: e.expenseDate.toISOString().slice(0, 10),
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

  const expense = await prisma.privateProjectExpense.create({
    data: {
      projectId: params.id,
      description,
      amountZar,
      expenseDate,
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
        notes: expense.notes,
      },
    },
    { status: 201 },
  );
}
