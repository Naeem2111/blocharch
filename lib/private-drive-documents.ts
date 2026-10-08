import { prisma } from "@/lib/prisma";
import {
  assertFileInFolder,
  deleteDriveFile,
  ensureClientDriveFolder,
  isGoogleDriveConfigured,
  listClientDriveFiles,
  setDriveFileVisibility,
  uploadDriveFile,
} from "@/lib/google-drive";
import { newDocumentId } from "@/lib/private-document-storage";

export const PRIVATE_DRIVE_MAX_BYTES = 50 * 1024 * 1024;

export function portalDocumentPath(slug: string, documentId: string) {
  return `/api/private/portal/${slug}/documents/${documentId}`;
}

export function staffDocumentPath(projectId: string, documentId: string) {
  return `/api/private/projects/${projectId}/documents/${documentId}`;
}

type ClientRef = { id: string; name: string; slug: string | null; googleDriveFolderId: string | null };

export async function ensureStoredClientFolder(client: ClientRef): Promise<string> {
  const folderId = await ensureClientDriveFolder({
    clientName: client.name,
    slug: client.slug,
    existingFolderId: client.googleDriveFolderId,
  });
  if (folderId !== client.googleDriveFolderId) {
    await prisma.privateClient.update({
      where: { id: client.id },
      data: { googleDriveFolderId: folderId },
    });
    client.googleDriveFolderId = folderId;
  }
  return folderId;
}

/** Pull the client's Drive folder into document rows. Drive is the file store. */
export async function syncClientDriveDocuments(client: ClientRef, projectId: string): Promise<void> {
  if (!isGoogleDriveConfigured() || !client.slug) return;
  const folderId = await ensureStoredClientFolder(client);
  const files = await listClientDriveFiles(folderId);
  const seen = new Set(files.map((file) => file.id));

  for (const file of files) {
    if (file.kind === "portal-sidebar") continue;
    const existing = await prisma.privateProjectDocument.findUnique({ where: { driveFileId: file.id } });
    if (existing) {
      if (existing.originalName !== file.name || existing.sizeBytes !== file.sizeBytes || existing.mimeType !== file.mimeType) {
        await prisma.privateProjectDocument.update({
          where: { id: existing.id },
          data: {
            originalName: file.name.slice(0, 200),
            mimeType: file.mimeType,
            sizeBytes: file.sizeBytes,
          },
        });
      }
      continue;
    }
    const id = newDocumentId();
    await prisma.privateProjectDocument.create({
      data: {
        id,
        projectId,
        title: file.name.slice(0, 200),
        originalName: file.name.slice(0, 200),
        fileUrl: portalDocumentPath(client.slug, id),
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
        driveFileId: file.id,
        clientVisible: file.clientVisible,
      },
    });
  }

  await prisma.privateProjectDocument.deleteMany({
    where: {
      project: { clientId: client.id },
      driveFileId: { not: null, notIn: seen.size > 0 ? Array.from(seen) : ["__none__"] },
    },
  });
}

export async function saveDocumentToClientDrive(input: {
  client: ClientRef;
  projectId: string;
  title: string;
  originalName: string;
  mimeType: string;
  bytes: Buffer;
  clientVisible: boolean;
}) {
  const folderId = await ensureStoredClientFolder(input.client);
  const uploaded = await uploadDriveFile({
    folderId,
    name: input.originalName,
    mimeType: input.mimeType,
    bytes: input.bytes,
    clientVisible: input.clientVisible,
    clientId: input.client.id,
    projectId: input.projectId,
  });
  const id = newDocumentId();
  return prisma.privateProjectDocument.create({
    data: {
      id,
      projectId: input.projectId,
      title: input.title.slice(0, 200),
      originalName: input.originalName.slice(0, 200),
      fileUrl: input.client.slug
        ? portalDocumentPath(input.client.slug, id)
        : staffDocumentPath(input.projectId, id),
      mimeType: input.mimeType,
      sizeBytes: uploaded.sizeBytes,
      driveFileId: uploaded.id,
      clientVisible: input.clientVisible,
    },
  });
}

export async function recordCompletedDriveUpload(input: {
  client: ClientRef;
  projectId: string;
  driveFileId: string;
  title: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  clientVisible: boolean;
}) {
  const folderId = await ensureStoredClientFolder(input.client);
  const file = await assertFileInFolder(input.driveFileId, folderId);
  const existing = await prisma.privateProjectDocument.findUnique({ where: { driveFileId: file.id } });
  if (existing) return existing;
  const id = newDocumentId();
  return prisma.privateProjectDocument.create({
    data: {
      id,
      projectId: input.projectId,
      title: input.title.slice(0, 200) || file.name.slice(0, 200),
      originalName: (input.originalName || file.name).slice(0, 200),
      fileUrl: input.client.slug
        ? portalDocumentPath(input.client.slug, id)
        : staffDocumentPath(input.projectId, id),
      mimeType: input.mimeType || file.mimeType,
      sizeBytes: input.sizeBytes || file.sizeBytes,
      driveFileId: file.id,
      clientVisible: input.clientVisible,
    },
  });
}

export async function removeStoredDocument(doc: { driveFileId: string | null; fileUrl: string }) {
  if (doc.driveFileId) {
    await deleteDriveFile(doc.driveFileId).catch(() => {});
    return;
  }
  const { removePrivateDocumentFile } = await import("@/lib/private-document-storage");
  await removePrivateDocumentFile(doc.fileUrl);
}

export async function updateStoredDocumentVisibility(doc: { driveFileId: string | null }, clientVisible: boolean) {
  if (!doc.driveFileId || !isGoogleDriveConfigured()) return;
  await setDriveFileVisibility(doc.driveFileId, clientVisible).catch(() => {});
}
