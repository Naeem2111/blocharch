import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionFromRequest, type SessionUser } from "@/lib/auth";
import { canAccessModule } from "@/lib/permissions";

export async function requireRecruitmentSession(
  request: NextRequest,
): Promise<{ user: SessionUser } | NextResponse> {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessModule(session.user.role, "marketing", session.user.username)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return { user: session.user };
}
