import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRecruitmentSession } from "@/lib/recruitment/access";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const gate = await requireRecruitmentSession(request);
  if (gate instanceof NextResponse) return gate;
  const { id } = await context.params;
  const application = await prisma.recruitmentApplication.findFirst({
    where: { id, removedFromSourceAt: null },
    select: { id: true },
  });
  if (!application) return NextResponse.json({ error: "Application not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const text = String(body.body ?? "").trim();
  if (!text || text.length > 4000) {
    return NextResponse.json({ error: "Write a comment." }, { status: 400 });
  }
  const actor = gate.user.username || "Staff";
  const fileLabel = body.fileLabel ? String(body.fileLabel).trim().slice(0, 200) : null;
  const filePage = Number.isFinite(Number(body.filePage)) ? Math.max(1, Math.round(Number(body.filePage))) : null;

  const comment = await prisma.recruitmentComment.create({
    data: {
      applicationId: id,
      authorName: actor,
      body: text,
      fileLabel,
      filePage,
    },
  });
  await prisma.recruitmentActivity.create({
    data: { applicationId: id, actorName: actor, action: "comment", detail: text.slice(0, 160) },
  });
  return NextResponse.json({
    comment: {
      id: comment.id,
      authorName: comment.authorName,
      body: comment.body,
      fileLabel: comment.fileLabel,
      filePage: comment.filePage,
      createdAt: comment.createdAt.toISOString(),
    },
  });
}
