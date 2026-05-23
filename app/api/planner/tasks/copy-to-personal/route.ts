import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canEditBoard, canViewBoard, requirePlannerSession } from "@/lib/planner-access";

/** Duplicate a planner task onto a column on the user’s personal board; stores `linkedFromTaskId`. */
export async function POST(request: NextRequest) {
  const gate = await requirePlannerSession(request);
  if (gate instanceof NextResponse) return gate;
  const { user } = gate;

  let body: { sourceTaskId?: string; targetColumnId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const sourceTaskId =
    typeof body.sourceTaskId === "string" ? body.sourceTaskId.trim() : "";
  const targetColumnId =
    typeof body.targetColumnId === "string" ? body.targetColumnId.trim() : "";
  if (!sourceTaskId || !targetColumnId) {
    return NextResponse.json({ error: "sourceTaskId and targetColumnId required" }, { status: 400 });
  }

  const source = await prisma.plannerTask.findUnique({
    where: { id: sourceTaskId },
    include: {
      column: { select: { boardId: true } },
    },
  });
  if (!source) return NextResponse.json({ error: "Source task not found" }, { status: 404 });
  const sourceBoardId = source.column.boardId;
  if (!(await canViewBoard(user, sourceBoardId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const targetCol = await prisma.plannerColumn.findUnique({
    where: { id: targetColumnId },
    include: { board: true },
  });
  if (!targetCol) return NextResponse.json({ error: "Target column not found" }, { status: 404 });
  const targetBoard = targetCol.board;

  if (targetBoard.scope !== "personal") {
    return NextResponse.json({ error: "Target must be on a personal board" }, { status: 400 });
  }
  if (targetBoard.ownerId !== user.id && user.role !== "admin") {
    return NextResponse.json({ error: "Personal board must be yours" }, { status: 403 });
  }
  if (!(await canEditBoard(user, targetBoard.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const maxOrder = await prisma.plannerTask.aggregate({
    where: { columnId: targetColumnId },
    _max: { sortOrder: true },
  });
  const sortOrder = (maxOrder._max.sortOrder ?? -1) + 1;

  const created = await prisma.plannerTask.create({
    data: {
      columnId: targetColumnId,
      title: source.title,
      summary: source.summary,
      description: source.description,
      sortOrder,
      assigneeId: source.assigneeId,
      dueAt: source.dueAt,
      architectUrl: source.architectUrl,
      ...(source.customFields !== null && source.customFields !== undefined
        ? { customFields: source.customFields as Prisma.InputJsonValue }
        : {}),
      linkedFromTaskId: source.id,
    },
    include: {
      assignee: { select: { id: true, username: true } },
      labels: { include: { label: true } },
      column: { select: { id: true, boardId: true } },
    },
  });

  return NextResponse.json({
    task: created,
    targetBoardId: targetBoard.id,
  });
}
