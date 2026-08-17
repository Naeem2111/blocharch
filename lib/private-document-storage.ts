import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

export const PRIVATE_DOCUMENT_MAX_BYTES = 15 * 1024 * 1024;
export const PRIVATE_DOCUMENT_PUBLIC_DIR = "/uploads/private";

const MIME_TO_EXT: Record<string, string> = {
  "application/pdf": ".pdf",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "application/vnd.ms-excel": ".xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
};

const ALLOWED_MIME = new Set(Object.keys(MIME_TO_EXT));

function uploadsDir(projectId: string): string {
  return path.join(process.cwd(), "public", "uploads", "private", projectId);
}

export function isAllowedPrivateDocumentMime(mime: string): boolean {
  return ALLOWED_MIME.has(mime);
}

export function privateDocumentExtension(mime: string, originalName: string): string {
  const fromMime = MIME_TO_EXT[mime];
  if (fromMime) return fromMime;
  const ext = path.extname(originalName).toLowerCase();
  return ext && ext.length <= 8 ? ext : "";
}

export async function savePrivateDocumentFile(
  projectId: string,
  documentId: string,
  mime: string,
  originalName: string,
  bytes: Buffer,
): Promise<string> {
  const ext = privateDocumentExtension(mime, originalName);
  const dir = uploadsDir(projectId);
  await fs.mkdir(dir, { recursive: true });
  const safe = `${documentId}${ext || ""}`;
  await fs.writeFile(path.join(dir, safe), bytes);
  return `${PRIVATE_DOCUMENT_PUBLIC_DIR}/${projectId}/${safe}`;
}

export async function removePrivateDocumentFile(fileUrl: string): Promise<void> {
  if (!fileUrl.startsWith(`${PRIVATE_DOCUMENT_PUBLIC_DIR}/`)) return;
  const rel = fileUrl.slice(1);
  const abs = path.join(process.cwd(), "public", rel);
  await fs.unlink(abs).catch(() => {});
}

export function newDocumentId(): string {
  return crypto.randomUUID();
}
