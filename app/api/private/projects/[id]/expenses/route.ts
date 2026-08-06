import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePrivateOpsSession } from "@/lib/private-access";
import { isPrivateDesignStage, PRIVATE_FIXED_FEE_EXPENSE_LABEL, PRIVATE_STAGE_LABELS } from "@/lib/private-constants";
import {
  athleteExpenseCostDelta,
  expenseKindLabel,
  parseExpenseKind,
  validateExpenseAthleteAssignment,
} from "@/lib/private-project-expenses";
import { parseDateOnly } from "@/lib/ops-hours";
import type { PrivateDesignStage, PrivateProjectExpenseKind } from "@prisma/client";

function serializeExpense(e: {
  id: string;
  description: string;
  amountZar: { toNumber?: () => number } | number | string;
  expenseDate: Date;
  kind: PrivateProjectExpenseKind;
  athleteId: string | null;
  designStage: string | null;
  notes: string | null;
  athlete?: { id: string; fullName: string } | null;
}) {
  return {
    id: e.id,
    description: e.description,
    amountZar: Number(e.amountZar),
    expenseDate: e.expenseDate.toISOString().slice(0, 10),
    kind: e.kind,
    kindLabel: expenseKindLabel(e.kind),
    athleteId: e.athleteId,
    athleteName: e.athlete?.fullName ?? null,
    designStage: e.designStage,
    designStageLabel: e.designStage
      ? PRIVATE_STAGE_LABELS[e.designStage as PrivateDesignStage]
      : PRIVATE_FIXED_FEE_EXPENSE_LABEL,
    notes: e.notes,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const gate = await requirePrivateOpsSession(request);
  if (gate instanceof NextResponse) return gate;

  const project = await prisma.privateProject.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      name: true,
      designStage: true,
      assignedAthleteId: true,
      assignedAthlete: { select: { id: true, fullName: true } },
    },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const expenses = await prisma.privateProjectExpense.findMany({
    where: { projectId: params.id },
    orderBy: [{ expenseDate: "desc" }, { createdAt: "desc" }],
    include: {
      athlete: { select: { id: true, fullName: true } },
    },
  });

  const totalZar = expenses.reduce((sum, e) => sum + Number(e.amountZar), 0);

  return NextResponse.json({
    project: {
      id: project.id,
      name: project.name,
      designStage: project.designStage,
      assignedAthleteId: project.assignedAthleteId,
      assignedAthleteName: project.assignedAthlete?.fullName ?? null,
    },
    expenses: expenses.map((e) => serializeExpense(e)),
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

  const kind = parseExpenseKind(body.kind);
  if (!kind) {
    return NextResponse.json({ error: "Invalid expense type" }, { status: 400 });
  }

  const athleteId = body.athleteId ? String(body.athleteId).trim() : null;
  const athleteCheck = validateExpenseAthleteAssignment(kind, athleteId);
  if (!athleteCheck.ok) {
    return NextResponse.json({ error: athleteCheck.error }, { status: 400 });
  }

  if (athleteId) {
    const athlete = await prisma.opsAthlete.findUnique({ where: { id: athleteId } });
    if (!athlete) {
      return NextResponse.json({ error: "Athlete not found" }, { status: 400 });
    }
  }

  const designStageRaw = body.designStage;
  let designStage: PrivateDesignStage | null = null;
  if (designStageRaw === null || designStageRaw === "") {
    designStage = null;
  } else if (designStageRaw !== undefined && isPrivateDesignStage(String(designStageRaw))) {
    designStage = String(designStageRaw) as PrivateDesignStage;
  } else if (designStageRaw === undefined) {
    designStage = project.designStage;
  } else {
    return NextResponse.json({ error: "Invalid design phase" }, { status: 400 });
  }

  const expense = await prisma.$transaction(async (tx) => {
    const created = await tx.privateProjectExpense.create({
      data: {
        projectId: params.id,
        description,
        amountZar,
        expenseDate,
        kind,
        athleteId,
        designStage,
        notes: body.notes ? String(body.notes).trim() || null : null,
      },
      include: { athlete: { select: { id: true, fullName: true } } },
    });
    if (kind === "athlete") {
      await tx.privateProject.update({
        where: { id: params.id },
        data: { costZar: { increment: amountZar } },
      });
    }
    return created;
  });

  return NextResponse.json({ expense: serializeExpense(expense) }, { status: 201 });
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
    kind?: PrivateProjectExpenseKind;
    athleteId?: string | null;
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

  if (body.kind !== undefined) {
    const kind = parseExpenseKind(body.kind);
    if (!kind) return NextResponse.json({ error: "Invalid expense type" }, { status: 400 });
    updateData.kind = kind;
  }

  if (body.athleteId !== undefined) {
    updateData.athleteId = body.athleteId ? String(body.athleteId).trim() : null;
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

  const nextKind = updateData.kind ?? expense.kind;
  const nextAthleteId =
    updateData.athleteId !== undefined ? updateData.athleteId : expense.athleteId;
  const athleteCheck = validateExpenseAthleteAssignment(nextKind, nextAthleteId);
  if (!athleteCheck.ok) {
    return NextResponse.json({ error: athleteCheck.error }, { status: 400 });
  }

  if (nextAthleteId) {
    const athlete = await prisma.opsAthlete.findUnique({ where: { id: nextAthleteId } });
    if (!athlete) {
      return NextResponse.json({ error: "Athlete not found" }, { status: 400 });
    }
  }

  const nextAmount =
    updateData.amountZar !== undefined ? updateData.amountZar : Number(expense.amountZar);
  const costDelta = athleteExpenseCostDelta(
    { kind: expense.kind, amountZar: Number(expense.amountZar) },
    { kind: nextKind, amountZar: nextAmount },
  );

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.privateProjectExpense.update({
      where: { id: expenseId },
      data: updateData,
      include: { athlete: { select: { id: true, fullName: true } } },
    });
    if (costDelta !== 0) {
      await tx.privateProject.update({
        where: { id: params.id },
        data: { costZar: { increment: costDelta } },
      });
    }
    return row;
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

  await prisma.$transaction(async (tx) => {
    await tx.privateProjectExpense.delete({ where: { id: expenseId } });
    if (expense.kind === "athlete") {
      await tx.privateProject.update({
        where: { id: params.id },
        data: { costZar: { decrement: Number(expense.amountZar) } },
      });
    }
  });

  return NextResponse.json({ ok: true });
}
