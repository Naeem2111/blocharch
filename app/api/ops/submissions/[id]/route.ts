import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOpsSession } from "@/lib/ops-access";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const gate = await requireOpsSession(request);
  if (gate instanceof NextResponse) return gate;

  const { id } = await context.params;
  const existing = await prisma.opsDailySubmission.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Submission not found" }, { status: 404 });

  try {
    const body = await request.json();
    const unlock = body.unlock === true;
    const lock = body.lock === true;

    if (unlock && lock) {
      return NextResponse.json({ error: "Specify unlock or lock, not both" }, { status: 400 });
    }

    const lockedAt = unlock ? null : lock ? new Date() : undefined;
    if (lockedAt === undefined) {
      return NextResponse.json({ error: 'Send { "unlock": true } or { "lock": true }' }, { status: 400 });
    }

    const updated = await prisma.opsDailySubmission.update({
      where: { id },
      data: { lockedAt },
    });

    return NextResponse.json({
      submission: {
        id: updated.id,
        submissionDate: updated.submissionDate.toISOString().slice(0, 10),
        lockedAt: updated.lockedAt?.toISOString() ?? null,
      },
    });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
