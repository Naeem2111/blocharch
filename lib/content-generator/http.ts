import { NextResponse, type NextRequest } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { canAccessModule } from "@/lib/permissions";
import { GenerationError } from "@/lib/content-generator/openai";

export async function requireContentUser(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessModule(session.user.role, "content", session.user.username)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return session;
}

export function imageUrlFor(sessionId: string, updatedAt: string): string {
  return `/api/content-generator/sessions/${sessionId}/image?v=${encodeURIComponent(updatedAt)}`;
}

export function jobResponse(error: unknown, sessionId: string | null) {
  if (error instanceof GenerationError) {
    return NextResponse.json(
      { error: error.message, sessionId },
      { status: error.status },
    );
  }
  const message = error instanceof Error ? error.message : "";
  const safe = message.startsWith("The Master Artwork")
    ? message
    : "The artwork could not be generated. Your photo and colours are still here — try again.";
  console.error("Content generator failed");
  return NextResponse.json({ error: safe, sessionId }, { status: 500 });
}
