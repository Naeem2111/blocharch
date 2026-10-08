import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createResumableUpload, isGoogleDriveConfigured } from "@/lib/google-drive";
import {
  ensureStoredClientFolder,
  PRIVATE_DRIVE_MAX_BYTES,
  recordCompletedDriveUpload,
  saveDocumentToClientDrive,
} from "@/lib/private-drive-documents";
import { resolvePrivateDocumentMime } from "@/lib/private-document-storage";

async function projectForSlug(slug: string) {
  const client = await prisma.privateClient.findFirst({
    where: { slug, portalEnabled: true },
  });
  if (!client) return null;
  const project = await prisma.privateProject.findFirst({
    where: { clientId: client.id, status: { in: ["active", "completed", "on_hold"] } },
    orderBy: { updatedAt: "desc" },
  });
  if (!project) return null;
  return { client, project };
}

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } },
) {
  const found = await projectForSlug(params.slug.trim());
  if (!found) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!isGoogleDriveConfigured()) {
    return NextResponse.json(
      { error: "Google Drive is not connected for this portal yet." },
      { status: 503 },
    );
  }

  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const body = await request.json();
    const intent = String(body.intent || "start");
    if (intent === "complete") {
      const driveFileId = String(body.driveFileId || "").trim();
      if (!driveFileId) return NextResponse.json({ error: "driveFileId required" }, { status: 400 });
      try {
        const doc = await recordCompletedDriveUpload({
          client: found.client,
          projectId: found.project.id,
          driveFileId,
          title: String(body.title || body.name || "Document"),
          originalName: String(body.name || "Document"),
          mimeType: String(body.mimeType || "application/octet-stream"),
          sizeBytes: Number(body.sizeBytes || 0),
          clientVisible: true,
        });
        return NextResponse.json({
          document: {
            id: doc.id,
            title: doc.title,
            fileUrl: doc.fileUrl,
            mimeType: doc.mimeType,
            sizeBytes: doc.sizeBytes,
            createdAt: doc.createdAt.toISOString().slice(0, 10),
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Could not save the file";
        return NextResponse.json({ error: message }, { status: 400 });
      }
    }

    const name = String(body.name || "Document").slice(0, 200);
    const mimeType = resolvePrivateDocumentMime(String(body.mimeType || ""), name);
    const sizeBytes = Number(body.sizeBytes || 0);
    if (sizeBytes <= 0 || sizeBytes > PRIVATE_DRIVE_MAX_BYTES) {
      return NextResponse.json({ error: "File must be 50 MB or smaller" }, { status: 400 });
    }
    if (!mimeType) {
      return NextResponse.json(
        { error: "Upload a PDF, image, Word, Excel, CSV, ZIP, or drawing file" },
        { status: 400 },
      );
    }
    try {
      const folderId = await ensureStoredClientFolder(found.client);
      const uploadUrl = await createResumableUpload({
        folderId,
        name,
        mimeType,
        sizeBytes,
        clientVisible: true,
        clientId: found.client.id,
        projectId: found.project.id,
      });
      return NextResponse.json({ uploadUrl });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not start the upload";
      return NextResponse.json({ error: message }, { status: 502 });
    }
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "File required" }, { status: 400 });
  if (file.size > PRIVATE_DRIVE_MAX_BYTES) {
    return NextResponse.json({ error: "File must be 50 MB or smaller" }, { status: 400 });
  }
  const mimeType = resolvePrivateDocumentMime(file.type, file.name);
  if (!mimeType) {
    return NextResponse.json(
      { error: "Upload a PDF, image, Word, Excel, CSV, ZIP, or drawing file" },
      { status: 400 },
    );
  }
  try {
    const doc = await saveDocumentToClientDrive({
      client: found.client,
      projectId: found.project.id,
      title: file.name,
      originalName: file.name,
      mimeType,
      bytes: Buffer.from(await file.arrayBuffer()),
      clientVisible: true,
    });
    return NextResponse.json({
      document: {
        id: doc.id,
        title: doc.title,
        fileUrl: doc.fileUrl,
        mimeType: doc.mimeType,
        sizeBytes: doc.sizeBytes,
        createdAt: doc.createdAt.toISOString().slice(0, 10),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save to Google Drive";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
