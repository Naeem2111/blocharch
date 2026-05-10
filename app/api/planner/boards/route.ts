import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_PLANNER_COLUMNS,
  planBoardIdsForUser,
  requirePlannerSession,
} from "@/lib/planner-access";

export async function GET(request: NextRequest) {
  const gate = await requirePlannerSession(request);
  if (gate instanceof NextResponse) return gate;
  const { user } = gate;

  const ids = await planBoardIdsForUser(user);
  if (ids.length === 0) {
    return NextResponse.json({ boards: [] });
  }

  const boards = await prisma.plannerBoard.findMany({
    where: { id: { in: ids } },
    orderBy: [{ scope: "asc" }, { updatedAt: "desc" }],
    select: {
      id: true,
      title: true,
      scope: true,
      color: true,
      ownerId: true,
      updatedAt: true,
      owner: { select: { username: true } },
      _count: { select: { columns: true } },
    },
  });

  return NextResponse.json({ boards });
}

export async function POST(request: NextRequest) {
  const gate = await requirePlannerSession(request);
  if (gate instanceof NextResponse) return gate;
  const { user } = gate;

  try {
    const body = await request.json();
    const title = String(body.title || "").trim();
    const scope = body.scope === "team" ? "team" : "personal";
    const color = typeof body.color === "string" ? body.color.trim() : "#6366f1";

    if (title.length < 1 || title.length > 120) {
      return NextResponse.json({ error: "Title required (1–120 characters)" }, { status: 400 });
    }

    const board = await prisma.plannerBoard.create({
      data: {
        title,
        scope,
        color: color || "#6366f1",
        ownerId: user.id,
        columns: {
          create: DEFAULT_PLANNER_COLUMNS.map((c) => ({
            title: c.title,
            color: c.color,
            sortOrder: c.sortOrder,
          })),
        },
      },
      select: {
        id: true,
        title: true,
        scope: true,
        color: true,
        ownerId: true,
      },
    });

    return NextResponse.json({ board }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
