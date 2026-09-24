import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { canDeletePrivateProject, requirePrivateOpsSession } from "@/lib/private-access";
import { reactivatePrivateProject } from "@/lib/private-reactivate";

/** Bring a completed private project back to active (same idea as ops archives). */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const gate = await requirePrivateOpsSession(request);
  if (gate instanceof NextResponse) return gate;
  if (!canDeletePrivateProject(gate.user.role)) {
    return NextResponse.json(
      { error: "Only managers and admins can reactivate completed projects" },
      { status: 403 },
    );
  }

  const result = await reactivatePrivateProject(params.id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ok: true, progressPercent: result.progressPercent });
}
