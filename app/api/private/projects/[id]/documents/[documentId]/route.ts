import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { requirePrivateOpsSession } from "@/lib/private-access";
import { streamDriveDocument } from "@/lib/private-document-response";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; documentId: string } },
) {
  const gate = await requirePrivateOpsSession(request);
  if (gate instanceof NextResponse) return gate;

  const doc = await prisma.privateProjectDocument.findFirst({
    where: { id: params.documentId, projectId: params.id },
  });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const inline = request.nextUrl.searchParams.get("download") !== "1";
  if (doc.driveFileId) {
    try {
      return await streamDriveDocument(doc.driveFileId, doc.originalName || doc.title, doc.mimeType, inline);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not download the file";
      return NextResponse.json({ error: message }, { status: 502 });
    }
  }

  if (!doc.fileUrl.startsWith("/uploads/private/")) {
    return NextResponse.redirect(doc.fileUrl);
  }
  const abs = path.join(process.cwd(), "public", doc.fileUrl);
  if (!fs.existsSync(abs)) return NextResponse.json({ error: "File missing" }, { status: 404 });
  const data = fs.readFileSync(abs);
  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": doc.mimeType || "application/octet-stream",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${doc.originalName.replace(/["\r\n]/g, "")}"`,
    },
  });
}
