import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePrivateDocumentAccess, requirePrivateOpsSession } from "@/lib/private-access";
import { recordPrivateActivity } from "@/lib/private-activity";
import { revalidatePath } from "next/cache";
import {
  newDocumentId,
  PRIVATE_DOCUMENT_MAX_BYTES,
  resolvePrivateDocumentMime,
  savePrivateDocumentFile,
} from "@/lib/private-document-storage";
import { createResumableUpload, isGoogleDriveConfigured } from "@/lib/google-drive";
import {
  ensureStoredClientFolder,
  recordCompletedDriveUpload,
  removeStoredDocument,
  saveDocumentToClientDrive,
  staffDocumentPath,
  syncClientDriveDocuments,
  updateStoredDocumentVisibility,
  PRIVATE_DRIVE_MAX_BYTES,
} from "@/lib/private-drive-documents";
import { allDesignPhases, resolvePhaseStructure } from "@/lib/private-phase-structure";

function cleanCategory(value: unknown): string | null {
  const text = String(value ?? "").trim().slice(0, 80);
  return text || null;
}

async function noteVisibleFile(
  project: { id: string; client: { slug: string | null } },
  doc: { id: string; title: string; clientVisible: boolean },
) {
  if (!doc.clientVisible) return;
  await recordPrivateActivity(prisma, {
    projectId: project.id,
    kind: "file",
    title: `New file: ${doc.title}`,
    sourceKey: `file:${doc.id}`,
  });
  if (project.client.slug) revalidatePath(`/private/${project.client.slug}`);
}

function serializeDoc(d: {
  id: string;
  projectId: string;
  title: string;
  originalName: string;
  fileUrl: string;
  mimeType: string | null;
  sizeBytes: number;
  driveFileId: string | null;
  clientVisible: boolean;
  category: string | null;
  createdAt: Date;
}) {
  return {
    id: d.id,
    title: d.title,
    originalName: d.originalName,
    fileUrl: d.driveFileId ? staffDocumentPath(d.projectId, d.id) : d.fileUrl,
    mimeType: d.mimeType,
    sizeBytes: d.sizeBytes,
    driveFileId: d.driveFileId,
    clientVisible: d.clientVisible,
    category: d.category,
    createdAt: d.createdAt.toISOString(),
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const gate = await requirePrivateDocumentAccess(request, params.id);
  if (gate instanceof NextResponse) return gate;

  const project = await prisma.privateProject.findUnique({
    where: { id: params.id },
    include: { client: true },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (isGoogleDriveConfigured()) {
    await syncClientDriveDocuments(project.client, project.id).catch(() => {});
  }

  const documents = await prisma.privateProjectDocument.findMany({
    where: { projectId: params.id },
    orderBy: { createdAt: "desc" },
  });
  const phases = allDesignPhases(resolvePhaseStructure(project.phaseStructure)).map((phase) => phase.name);

  return NextResponse.json({ documents: documents.map(serializeDoc), phases });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const gate = await requirePrivateDocumentAccess(request, params.id);
  if (gate instanceof NextResponse) return gate;

  const project = await prisma.privateProject.findUnique({
    where: { id: params.id },
    include: { client: true },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const body = await request.json().catch(() => ({}));
    const intent = String(body.intent || "start");
    const clientVisible = gate.staff && Boolean(body.clientVisible);
    if (intent === "complete") {
      const driveFileId = String(body.driveFileId || "").trim();
      if (!driveFileId) return NextResponse.json({ error: "driveFileId required" }, { status: 400 });
      try {
        const doc = await recordCompletedDriveUpload({
          client: project.client,
          projectId: project.id,
          driveFileId,
          title: String(body.title || body.name || "Document"),
          originalName: String(body.name || "Document"),
          mimeType: resolvePrivateDocumentMime(String(body.mimeType || ""), String(body.name || "")) || "application/octet-stream",
          sizeBytes: Number(body.sizeBytes || 0),
          clientVisible,
          category: cleanCategory(body.category),
        });
        await noteVisibleFile(project, doc);
        return NextResponse.json({ document: serializeDoc(doc) }, { status: 201 });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Could not save the file";
        return NextResponse.json({ error: message }, { status: 400 });
      }
    }

    if (!isGoogleDriveConfigured()) return NextResponse.json({ fallback: true });
    const name = String(body.name || "Document").slice(0, 200);
    const mimeType = resolvePrivateDocumentMime(String(body.mimeType || ""), name);
    const sizeBytes = Number(body.sizeBytes || 0);
    if (!mimeType) {
      return NextResponse.json(
        { error: "Upload a PDF, image, Word, Excel, CSV, ZIP, or drawing file" },
        { status: 400 },
      );
    }
    if (sizeBytes <= 0 || sizeBytes > PRIVATE_DRIVE_MAX_BYTES) {
      return NextResponse.json({ error: "File must be 50 MB or smaller" }, { status: 400 });
    }
    try {
      const folderId = await ensureStoredClientFolder(project.client);
      const uploadUrl = await createResumableUpload({
        folderId,
        name,
        mimeType,
        sizeBytes,
        clientVisible,
        clientId: project.client.id,
        projectId: project.id,
        origin: request.headers.get("origin"),
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
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "File required" }, { status: 400 });
  }
  const mimeType = resolvePrivateDocumentMime(file.type, file.name);
  if (!mimeType || (!isGoogleDriveConfigured() && mimeType === "application/octet-stream")) {
    return NextResponse.json(
      { error: "Upload a PDF, image, Word, Excel, CSV, ZIP, or drawing file" },
      { status: 400 },
    );
  }
  if (file.size > (isGoogleDriveConfigured() ? PRIVATE_DRIVE_MAX_BYTES : PRIVATE_DOCUMENT_MAX_BYTES)) {
    return NextResponse.json({ error: "File is too large" }, { status: 400 });
  }

  const title = String(form.get("title") || file.name || "Document").trim().slice(0, 200);
  const clientVisible = gate.staff && String(form.get("clientVisible") || "") === "true";
  const category = cleanCategory(form.get("category"));
  const bytes = Buffer.from(await file.arrayBuffer());

  if (isGoogleDriveConfigured()) {
    try {
      const doc = await saveDocumentToClientDrive({
        client: project.client,
        projectId: project.id,
        title,
        originalName: file.name,
        mimeType,
        bytes,
        clientVisible,
        category,
      });
      await noteVisibleFile(project, doc);
      return NextResponse.json({ document: serializeDoc(doc) }, { status: 201 });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not save to Google Drive";
      return NextResponse.json({ error: message }, { status: 502 });
    }
  }

  const documentId = newDocumentId();
  const fileUrl = await savePrivateDocumentFile(params.id, documentId, mimeType, file.name, bytes);

  const doc = await prisma.privateProjectDocument.create({
    data: {
      id: documentId,
      projectId: params.id,
      title,
      originalName: file.name.slice(0, 200),
      fileUrl,
      mimeType,
      sizeBytes: file.size,
      clientVisible,
      category,
    },
  });

  await noteVisibleFile(project, doc);
  return NextResponse.json({ document: serializeDoc(doc) }, { status: 201 });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const gate = await requirePrivateDocumentAccess(request, params.id);
  if (gate instanceof NextResponse) return gate;

  const body = await request.json();
  const documentId = String(body.documentId || "").trim();
  if (!documentId) return NextResponse.json({ error: "documentId required" }, { status: 400 });
  if (!gate.staff && (body.title !== undefined || body.clientVisible !== undefined)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existing = await prisma.privateProjectDocument.findFirst({
    where: { id: documentId, projectId: params.id },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data: { title?: string; clientVisible?: boolean; category?: string | null } = {};
  if (body.title !== undefined) {
    const title = String(body.title || "").trim();
    if (!title) return NextResponse.json({ error: "Title required" }, { status: 400 });
    data.title = title.slice(0, 200);
  }
  if (body.clientVisible !== undefined) data.clientVisible = Boolean(body.clientVisible);
  if (body.category !== undefined) data.category = cleanCategory(body.category);

  const doc = await prisma.privateProjectDocument.update({
    where: { id: documentId },
    data,
  });
  if (body.clientVisible !== undefined) {
    await updateStoredDocumentVisibility(doc, Boolean(body.clientVisible));
  }
  if (doc.clientVisible && !existing.clientVisible) {
    const owner = await prisma.privateProject.findUnique({
      where: { id: params.id },
      select: { id: true, client: { select: { slug: true } } },
    });
    if (owner) await noteVisibleFile(owner, doc);
  }

  return NextResponse.json({ document: serializeDoc(doc) });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const gate = await requirePrivateOpsSession(request);
  if (gate instanceof NextResponse) return gate;

  const body = await request.json().catch(() => ({}));
  const documentId = String(
    body.documentId || request.nextUrl.searchParams.get("documentId") || "",
  ).trim();
  if (!documentId) return NextResponse.json({ error: "documentId required" }, { status: 400 });

  const existing = await prisma.privateProjectDocument.findFirst({
    where: { id: documentId, projectId: params.id },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.privateProjectDocument.delete({ where: { id: documentId } });
  await removeStoredDocument(existing);

  return NextResponse.json({ ok: true });
}
