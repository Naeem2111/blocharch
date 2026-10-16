import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { streamDriveDocument } from "@/lib/private-document-response";
import { OPS_DOCUMENT_PUBLIC_DIR } from "@/lib/ops-document-storage";

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string; documentId: string } },
) {
  const slug = params.slug.trim().toLowerCase();
  const client = await prisma.opsClient.findFirst({
    where: { slug, publicPortalEnabled: true, status: "active" },
    select: { id: true },
  });
  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const doc = await prisma.opsProjectDocument.findFirst({
    where: {
      id: params.documentId,
      clientVisible: true,
      project: { clientId: client.id },
    },
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
  if (!doc.fileUrl.startsWith(`${OPS_DOCUMENT_PUBLIC_DIR}/`)) {
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
