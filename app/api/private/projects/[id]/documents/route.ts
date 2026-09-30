import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePrivateOpsSession } from "@/lib/private-access";
import {
  isAllowedPrivateDocumentMime,
  newDocumentId,
  PRIVATE_DOCUMENT_MAX_BYTES,
  savePrivateDocumentFile,
} from "@/lib/private-document-storage";
import { isGoogleDriveConfigured } from "@/lib/google-drive";
import {
  removeStoredDocument,
  saveDocumentToClientDrive,
  staffDocumentPath,
  syncClientDriveDocuments,
  updateStoredDocumentVisibility,
  PRIVATE_DRIVE_MAX_BYTES,
} from "@/lib/private-drive-documents";

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
    createdAt: d.createdAt.toISOString(),
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const gate = await requirePrivateOpsSession(request);
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

  return NextResponse.json({ documents: documents.map(serializeDoc) });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const gate = await requirePrivateOpsSession(request);
  if (gate instanceof NextResponse) return gate;

  const project = await prisma.privateProject.findUnique({
    where: { id: params.id },
    include: { client: true },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

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
  if (!isAllowedPrivateDocumentMime(file.type)) {
    return NextResponse.json(
      { error: "Upload a PDF, image, Word, or Excel file" },
      { status: 400 },
    );
  }
  if (file.size > (isGoogleDriveConfigured() ? PRIVATE_DRIVE_MAX_BYTES : PRIVATE_DOCUMENT_MAX_BYTES)) {
    return NextResponse.json({ error: "File is too large" }, { status: 400 });
  }

  const title = String(form.get("title") || file.name || "Document").trim().slice(0, 200);
  const clientVisible = String(form.get("clientVisible") || "") === "true";
  const bytes = Buffer.from(await file.arrayBuffer());

  if (isGoogleDriveConfigured()) {
    try {
      const doc = await saveDocumentToClientDrive({
        client: project.client,
        projectId: project.id,
        title,
        originalName: file.name,
        mimeType: file.type,
        bytes,
        clientVisible,
      });
      return NextResponse.json({ document: serializeDoc(doc) }, { status: 201 });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not save to Google Drive";
      return NextResponse.json({ error: message }, { status: 502 });
    }
  }

  const documentId = newDocumentId();
  const fileUrl = await savePrivateDocumentFile(params.id, documentId, file.type, file.name, bytes);

  const doc = await prisma.privateProjectDocument.create({
    data: {
      id: documentId,
      projectId: params.id,
      title,
      originalName: file.name.slice(0, 200),
      fileUrl,
      mimeType: file.type,
      sizeBytes: file.size,
      clientVisible,
    },
  });

  return NextResponse.json({ document: serializeDoc(doc) }, { status: 201 });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const gate = await requirePrivateOpsSession(request);
  if (gate instanceof NextResponse) return gate;

  const body = await request.json();
  const documentId = String(body.documentId || "").trim();
  if (!documentId) return NextResponse.json({ error: "documentId required" }, { status: 400 });

  const existing = await prisma.privateProjectDocument.findFirst({
    where: { id: documentId, projectId: params.id },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data: { title?: string; clientVisible?: boolean } = {};
  if (body.title !== undefined) {
    const title = String(body.title || "").trim();
    if (!title) return NextResponse.json({ error: "Title required" }, { status: 400 });
    data.title = title.slice(0, 200);
  }
  if (body.clientVisible !== undefined) data.clientVisible = Boolean(body.clientVisible);

  const doc = await prisma.privateProjectDocument.update({
    where: { id: documentId },
    data,
  });
  if (body.clientVisible !== undefined) {
    await updateStoredDocumentVisibility(doc, Boolean(body.clientVisible));
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
