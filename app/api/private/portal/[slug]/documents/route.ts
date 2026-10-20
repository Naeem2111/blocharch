import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createResumableUpload, isGoogleDriveConfigured } from "@/lib/google-drive";
import { recordPrivateActivity } from "@/lib/private-activity";
import {
  ensureStoredClientFolder,
  PRIVATE_DRIVE_MAX_BYTES,
  recordCompletedDriveUpload,
  saveDocumentToClientDrive,
} from "@/lib/private-drive-documents";
import {
  newDocumentId,
  PRIVATE_DOCUMENT_MAX_BYTES,
  resolvePrivateDocumentMime,
  savePrivateDocumentFile,
} from "@/lib/private-document-storage";

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

function serializePortalDoc(doc: {
  id: string;
  title: string;
  fileUrl: string;
  mimeType: string | null;
  sizeBytes: number;
  createdAt: Date;
  category?: string | null;
  actionItemId?: string | null;
}) {
  return {
    id: doc.id,
    title: doc.title,
    fileUrl: doc.fileUrl,
    mimeType: doc.mimeType,
    sizeBytes: doc.sizeBytes,
    category: doc.category ?? null,
    actionItemId: doc.actionItemId ?? null,
    createdAt: doc.createdAt.toISOString().slice(0, 10),
  };
}

async function notePortalFile(
  projectId: string,
  slug: string,
  doc: { id: string; title: string },
) {
  await recordPrivateActivity(prisma, {
    projectId,
    kind: "file",
    title: `New file: ${doc.title}`,
    sourceKey: `file:${doc.id}`,
  });
  revalidatePath(`/private/${slug}`);
}

async function resolveActionItemId(projectId: string, raw: unknown) {
  const actionItemId = String(raw || "").trim();
  if (!actionItemId) return null;
  const action = await prisma.privateActionItem.findFirst({
    where: {
      id: actionItemId,
      projectId,
      clientFacing: true,
      completedAt: null,
    },
    select: { id: true },
  });
  return action?.id ?? null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } },
) {
  const slug = params.slug.trim();
  const found = await projectForSlug(slug);
  if (!found) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const body = await request.json();
    const intent = String(body.intent || "start");
    const actionItemId = await resolveActionItemId(found.project.id, body.actionItemId);
    if (intent === "complete") {
      if (!isGoogleDriveConfigured()) {
        return NextResponse.json({ error: "Google Drive is not connected for this portal yet." }, { status: 503 });
      }
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
          actionItemId,
        });
        await notePortalFile(found.project.id, slug, doc);
        return NextResponse.json({ document: serializePortalDoc(doc) });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Could not save the file";
        return NextResponse.json({ error: message }, { status: 400 });
      }
    }

    if (!isGoogleDriveConfigured()) {
      return NextResponse.json({ fallback: true });
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
        origin: request.headers.get("origin"),
      });
      return NextResponse.json({ uploadUrl, actionItemId });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not start the upload";
      return NextResponse.json({ error: message, fallback: true }, { status: 502 });
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

  const mimeType = resolvePrivateDocumentMime(file.type, file.name);
  if (!mimeType || (!isGoogleDriveConfigured() && mimeType === "application/octet-stream")) {
    return NextResponse.json(
      { error: "Upload a PDF, image, Word, Excel, CSV, ZIP, or drawing file" },
      { status: 400 },
    );
  }

  const maxBytes = isGoogleDriveConfigured() ? PRIVATE_DRIVE_MAX_BYTES : PRIVATE_DOCUMENT_MAX_BYTES;
  if (file.size > maxBytes) {
    return NextResponse.json(
      { error: isGoogleDriveConfigured() ? "File must be 50 MB or smaller" : "File must be 15 MB or smaller" },
      { status: 400 },
    );
  }

  const title = String(form.get("title") || file.name || "Document").trim().slice(0, 200) || file.name;
  const actionItemId = await resolveActionItemId(found.project.id, form.get("actionItemId"));
  const bytes = Buffer.from(await file.arrayBuffer());

  if (isGoogleDriveConfigured()) {
    try {
      const doc = await saveDocumentToClientDrive({
        client: found.client,
        projectId: found.project.id,
        title,
        originalName: file.name,
        mimeType,
        bytes,
        clientVisible: true,
        actionItemId,
      });
      await notePortalFile(found.project.id, slug, doc);
      return NextResponse.json({ document: serializePortalDoc(doc) });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not save to Google Drive";
      return NextResponse.json({ error: message }, { status: 502 });
    }
  }

  const documentId = newDocumentId();
  const fileUrl = await savePrivateDocumentFile(found.project.id, documentId, mimeType, file.name, bytes);
  const doc = await prisma.privateProjectDocument.create({
    data: {
      id: documentId,
      projectId: found.project.id,
      title,
      originalName: file.name.slice(0, 200),
      fileUrl,
      mimeType,
      sizeBytes: file.size,
      clientVisible: true,
      actionItemId,
    },
  });
  await notePortalFile(found.project.id, slug, doc);
  return NextResponse.json({ document: serializePortalDoc(doc) });
}
