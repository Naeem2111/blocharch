import { NextResponse, type NextRequest } from "next/server";
import { requireContentUser } from "@/lib/content-generator/http";
import { artworkFilename } from "@/lib/content-generator/run";
import { isSessionId, readSession, readSessionFile } from "@/lib/content-generator/session-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await requireContentUser(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await context.params;
  if (!isSessionId(id)) {
    return NextResponse.json({ error: "This artwork session has ended." }, { status: 404 });
  }
  const session = await readSession(id, auth.user.id);
  if (!session?.outputFile) {
    return NextResponse.json({ error: "No artwork yet." }, { status: 404 });
  }
  const bytes = await readSessionFile(session, session.outputFile);
  const download = request.nextUrl.searchParams.get("download") === "1";
  const filename = artworkFilename(session.outputUpdatedAt || session.updatedAt);
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
