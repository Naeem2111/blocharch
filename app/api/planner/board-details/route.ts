import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  deriveBoardAccess,
  planBoardIdsForUser,
  requirePlannerSession,
} from "@/lib/planner-access";
import {
  PLANNER_BOARD_DETAIL_INCLUDE,
  serializePlannerBoardDetail,
} from "@/lib/planner-board-payload";

export async function GET(request: NextRequest) {
  const gate = await requirePlannerSession(request);
  if (gate instanceof NextResponse) return gate;
  const { user } = gate;

  const ids = (request.nextUrl.searchParams.get("ids") || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .slice(0, 40);

  if (ids.length === 0) {
    return NextResponse.json({ boards: [] });
  }

  const allowed =
    user.role === "admin" ? new Set(ids) : new Set(await planBoardIdsForUser(user));
  const requested = ids.filter((id) => allowed.has(id));
  if (requested.length === 0) {
    return NextResponse.json({ boards: [] });
  }

  const boards = await prisma.plannerBoard.findMany({
    where: { id: { in: requested } },
    include: PLANNER_BOARD_DETAIL_INCLUDE,
  });

  const payload = boards
    .map((board) => {
      const access = deriveBoardAccess(user, board);
      if (!access.canView) return null;
      return serializePlannerBoardDetail(board as never, access);
    })
    .filter(Boolean);

  return NextResponse.json({ boards: payload });
}
