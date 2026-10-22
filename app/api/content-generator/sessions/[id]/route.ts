import { NextResponse, type NextRequest } from "next/server";
import { requireContentUser } from "@/lib/content-generator/http";
import { deleteSession, isSessionId } from "@/lib/content-generator/session-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = await requireContentUser(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await context.params;
  if (!isSessionId(id)) {
    return NextResponse.json({ error: "This artwork session has ended." }, { status: 404 });
  }
  const removed = await deleteSession(id, auth.user.id);
  if (!removed) {
    return NextResponse.json({ error: "This artwork session has ended." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
