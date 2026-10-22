import { NextResponse, type NextRequest } from "next/server";
import { imageUrlFor, jobResponse, requireContentUser } from "@/lib/content-generator/http";
import { runArtworkJob } from "@/lib/content-generator/run";
import { isSessionId, readSession } from "@/lib/content-generator/session-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await requireContentUser(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await context.params;
  if (!isSessionId(id)) {
    return NextResponse.json({ error: "This artwork session has ended. Start again." }, { status: 404 });
  }
  const session = await readSession(id, auth.user.id);
  if (!session) {
    return NextResponse.json({ error: "This artwork session has ended. Start again." }, { status: 404 });
  }

  let instruction = "";
  try {
    const body = (await request.json()) as { instruction?: unknown };
    instruction = typeof body.instruction === "string" ? body.instruction : "";
  } catch {
    instruction = "";
  }

  try {
    const done = await runArtworkJob(session, "refine", instruction);
    return NextResponse.json({
      sessionId: done.id,
      imageUrl: imageUrlFor(done.id, done.outputUpdatedAt || done.updatedAt),
    });
  } catch (error) {
    return jobResponse(error, session.id);
  }
}
