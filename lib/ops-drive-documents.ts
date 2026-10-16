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
import { removeOpsDocumentFile } from "@/lib/ops-document-storage";

export const OPS_DRIVE_PARENT = "UK clients";
export const OPS_DRIVE_MAX_BYTES = 50 * 1024 * 1024;

export function portalOpsDocumentPath(slug: string, documentId: string) {
  return `/api/clients/${slug}/documents/${documentId}`;
}

export function staffOpsDocumentPath(projectId: string, documentId: string) {
  return `/api/ops/projects/${projectId}/documents/${documentId}`;
}

type ClientRef = { id: string; name: string; slug: string | null; googleDriveFolderId: string | null };

export async function ensureStoredOpsClientFolder(client: ClientRef): Promise<string> {
  const folderId = await ensureClientDriveFolder({
    clientName: client.name,
    slug: client.slug,
    existingFolderId: client.googleDriveFolderId,
    parentFolderName: OPS_DRIVE_PARENT,
  });
  if (folderId !== client.googleDriveFolderId) {
    await prisma.opsClient.update({
      where: { id: client.id },
      data: { googleDriveFolderId: folderId },
    });
    client.googleDriveFolderId = folderId;
  }
  return folderId;
}

export async function syncOpsClientDriveDocuments(client: ClientRef, projectId: string): Promise<void> {
  if (!isGoogleDriveConfigured() || !client.slug) return;
  const folderId = await ensureStoredOpsClientFolder(client);
  const files = await listClientDriveFiles(folderId);
  const seen = new Set(files.map((file) => file.id));

  for (const file of files) {
    if (file.kind === "portal-sidebar") continue;
    const existing = await prisma.opsProjectDocument.findUnique({ where: { driveFileId: file.id } });
    if (existing) {
      if (existing.originalName !== file.name || existing.sizeBytes !== file.sizeBytes || existing.mimeType !== file.mimeType) {
        await prisma.opsProjectDocument.update({
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
    await prisma.opsProjectDocument.create({
      data: {
        id,
        projectId,
        title: file.name.slice(0, 200),
        originalName: file.name.slice(0, 200),
        fileUrl: portalOpsDocumentPath(client.slug, id),
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
        driveFileId: file.id,
        clientVisible: file.clientVisible,
      },
    });
  }

  await prisma.opsProjectDocument.deleteMany({
    where: {
      project: { clientId: client.id },
      driveFileId: { not: null, notIn: seen.size > 0 ? Array.from(seen) : ["__none__"] },
    },
  });
}

export async function saveOpsDocumentToDrive(input: {
  client: ClientRef;
  projectId: string;
  title: string;
  originalName: string;
  mimeType: string;
  bytes: Buffer;
  clientVisible: boolean;
}) {
  const folderId = await ensureStoredOpsClientFolder(input.client);
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
  return prisma.opsProjectDocument.create({
    data: {
      id,
      projectId: input.projectId,
      title: input.title.slice(0, 200),
      originalName: input.originalName.slice(0, 200),
      fileUrl: input.client.slug
        ? portalOpsDocumentPath(input.client.slug, id)
        : staffOpsDocumentPath(input.projectId, id),
      mimeType: input.mimeType,
      sizeBytes: uploaded.sizeBytes,
      driveFileId: uploaded.id,
      clientVisible: input.clientVisible,
    },
  });
}

export async function recordCompletedOpsDriveUpload(input: {
  client: ClientRef;
  projectId: string;
  driveFileId: string;
  title: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  clientVisible: boolean;
}) {
  const folderId = await ensureStoredOpsClientFolder(input.client);
  const file = await assertFileInFolder(input.driveFileId, folderId);
  const existing = await prisma.opsProjectDocument.findUnique({ where: { driveFileId: file.id } });
  if (existing) return existing;
  const id = newDocumentId();
  return prisma.opsProjectDocument.create({
    data: {
      id,
      projectId: input.projectId,
      title: input.title.slice(0, 200) || file.name.slice(0, 200),
      originalName: (input.originalName || file.name).slice(0, 200),
      fileUrl: input.client.slug
        ? portalOpsDocumentPath(input.client.slug, id)
        : staffOpsDocumentPath(input.projectId, id),
      mimeType: input.mimeType || file.mimeType,
      sizeBytes: input.sizeBytes || file.sizeBytes,
      driveFileId: file.id,
      clientVisible: input.clientVisible,
    },
  });
}

export async function removeStoredOpsDocument(doc: { driveFileId: string | null; fileUrl: string }) {
  if (doc.driveFileId) {
    await deleteDriveFile(doc.driveFileId).catch(() => {});
    return;
  }
  await removeOpsDocumentFile(doc.fileUrl);
}

export async function updateStoredOpsDocumentVisibility(doc: { driveFileId: string | null }, clientVisible: boolean) {
  if (!doc.driveFileId || !isGoogleDriveConfigured()) return;
  await setDriveFileVisibility(doc.driveFileId, clientVisible).catch(() => {});
}
