import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  canEditBoard,
  requirePlannerSession,
  resolveBoardAccess,
} from "@/lib/planner-access";
import { isProtectedSystemBoard } from "@/lib/planner-system-boards";
import {
  PLANNER_BOARD_DETAIL_INCLUDE,
  serializePlannerBoardDetail,
} from "@/lib/planner-board-payload";

type Ctx = { params: Promise<{ boardId: string }> };

export async function GET(request: NextRequest, context: Ctx) {
  const gate = await requirePlannerSession(request);
  if (gate instanceof NextResponse) return gate;
  const { user } = gate;
  const { boardId } = await context.params;

  const resolved = await resolveBoardAccess(user, boardId);
  if (!resolved?.access.canView) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const board = await prisma.plannerBoard.findUnique({
    where: { id: boardId },
    include: PLANNER_BOARD_DETAIL_INCLUDE,
  });

  if (!board) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(serializePlannerBoardDetail(board as never, resolved.access));
}

export async function PATCH(request: NextRequest, context: Ctx) {
  const gate = await requirePlannerSession(request);
  if (gate instanceof NextResponse) return gate;
  const { user } = gate;
  const { boardId } = await context.params;

  if (!(await canEditBoard(user, boardId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existing = await prisma.plannerBoard.findUnique({ where: { id: boardId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (
    isProtectedSystemBoard(existing.kind, existing.isSystem) &&
    user.role !== "admin"
  ) {
    return NextResponse.json({ error: "Only admin can edit fixed system boards" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const title =
      typeof body.title === "string" ? body.title.trim().slice(0, 120) : undefined;
    const color = typeof body.color === "string" ? body.color.trim().slice(0, 32) : undefined;
    const sortOrder =
      typeof body.sortOrder === "number" && Number.isFinite(body.sortOrder)
        ? Math.round(body.sortOrder)
        : undefined;

    const board = await prisma.plannerBoard.update({
      where: { id: boardId },
      data: {
        ...(title !== undefined && title.length > 0 ? { title } : {}),
        ...(color !== undefined ? { color } : {}),
        ...(sortOrder !== undefined ? { sortOrder } : {}),
      },
      select: { id: true, title: true, color: true, sortOrder: true },
    });

    return NextResponse.json({ board });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, context: Ctx) {
  const gate = await requirePlannerSession(request);
  if (gate instanceof NextResponse) return gate;
  const { user } = gate;
  const { boardId } = await context.params;

  const board = await prisma.plannerBoard.findUnique({ where: { id: boardId } });
  if (!board) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (isProtectedSystemBoard(board.kind, board.isSystem)) {
    return NextResponse.json({ error: "System boards cannot be deleted" }, { status: 403 });
  }
  if (user.role !== "admin" && board.ownerId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.plannerBoard.delete({ where: { id: boardId } });
  return NextResponse.json({ ok: true });
}
