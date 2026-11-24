import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireOpsSession } from "@/lib/ops-access";
import { deleteRecruitmentRow } from "@/lib/recruitment-sheet";

export async function POST(request: NextRequest) {
  const gate = await requireOpsSession(request);
  if (gate instanceof NextResponse) return gate;

  const body = await request.json().catch(() => ({}));
  const rowNumber = Number(body.rowNumber);
  try {
    await deleteRecruitmentRow(rowNumber);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not delete that sheet row.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
