import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireRecruitmentSession } from "@/lib/recruitment/access";
import { recruitmentSyncSummary, syncRecruitmentSheet } from "@/lib/recruitment/sync";

export async function POST(request: NextRequest) {
  const secret = process.env.RECRUITMENT_SYNC_SECRET?.trim();
  const provided = request.headers.get("x-recruitment-sync-secret");
  if (!(secret && provided && provided === secret)) {
    const gate = await requireRecruitmentSession(request);
    if (gate instanceof NextResponse) return gate;
  }
  const result = await syncRecruitmentSheet({ force: true });
  const sync = await recruitmentSyncSummary();
  if (!result.ok) return NextResponse.json({ ...result, sync }, { status: 502 });
  return NextResponse.json({ ...result, sync });
}
