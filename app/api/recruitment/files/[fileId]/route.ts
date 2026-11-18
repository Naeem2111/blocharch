import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireRecruitmentSession } from "@/lib/recruitment/access";
import { recruitmentSheetConfig } from "@/lib/recruitment/sync";

type RouteContext = { params: Promise<{ fileId: string }> };

async function token() {
  const config = recruitmentSheetConfig();
  if (!config) return null;
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: config.refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const data = (await response.json()) as { access_token?: string };
  return data.access_token ?? null;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const gate = await requireRecruitmentSession(request);
  if (gate instanceof NextResponse) return gate;
  const { fileId } = await context.params;
  if (!/^[a-zA-Z0-9_-]+$/.test(fileId)) {
    return NextResponse.json({ error: "Unknown file" }, { status: 400 });
  }
  const access = await token();
  if (!access) {
    return NextResponse.json({ error: "Google Drive is not connected." }, { status: 503 });
  }

  const metaRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType`,
    { headers: { Authorization: `Bearer ${access}` } },
  );
  if (!metaRes.ok) {
    return NextResponse.json(
      { error: metaRes.status === 404 ? "This file is missing or this account cannot open it." : "Could not open the file." },
      { status: metaRes.status === 404 ? 404 : 502 },
    );
  }
  const meta = (await metaRes.json()) as { name?: string; mimeType?: string };
  const download = request.nextUrl.searchParams.get("download") === "1";
  const googleDoc = meta.mimeType?.startsWith("application/vnd.google-apps.");
  const fileRes = await fetch(
    googleDoc
      ? `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=application/pdf`
      : `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    { headers: { Authorization: `Bearer ${access}` } },
  );
  if (!fileRes.ok) {
    return NextResponse.json({ error: "Could not download this file from Drive." }, { status: 502 });
  }
  const bytes = await fileRes.arrayBuffer();
  const type = googleDoc ? "application/pdf" : meta.mimeType || "application/octet-stream";
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": type,
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${(meta.name || "file").replace(/"/g, "")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
