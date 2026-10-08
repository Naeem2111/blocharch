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
  "image/heic": ".heic",
  "image/heif": ".heif",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "application/vnd.ms-excel": ".xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  "text/csv": ".csv",
  "application/zip": ".zip",
  "application/acad": ".dwg",
  "image/vnd.dwg": ".dwg",
};

const MIME_ALIASES: Record<string, string> = {
  "image/jpg": "image/jpeg",
  "image/pjpeg": "image/jpeg",
  "image/x-png": "image/png",
  "application/x-pdf": "application/pdf",
  "application/x-zip-compressed": "application/zip",
  "application/vnd.ms-excel.sheet.macroenabled.12": "application/vnd.ms-excel",
};

const EXT_TO_MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".heic": "image/heic",
  ".heif": "image/heif",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".csv": "text/csv",
  ".zip": "application/zip",
  ".dwg": "application/acad",
};

const ALLOWED_MIME = new Set(Object.keys(MIME_TO_EXT));

function uploadsDir(projectId: string): string {
  return path.join(process.cwd(), "public", "uploads", "private", projectId);
}

export function isAllowedPrivateDocumentMime(mime: string): boolean {
  return ALLOWED_MIME.has(mime);
}

/** Browsers often send an empty type or application/octet-stream. Use the file extension then. */
export function resolvePrivateDocumentMime(mime: string, filename: string): string | null {
  const raw = mime.trim().toLowerCase();
  const normalized = MIME_ALIASES[raw] || raw;
  if (ALLOWED_MIME.has(normalized)) return normalized;
  const fromExt = EXT_TO_MIME[path.extname(filename).toLowerCase()];
  if (fromExt) return fromExt;
  if (!raw || raw === "application/octet-stream") return "application/octet-stream";
  return null;
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

export async function savePrivateSidebarImage(projectId: string, ext: string, bytes: Buffer): Promise<string> {
  const dir = uploadsDir(projectId);
  await fs.mkdir(dir, { recursive: true });
  const entries = await fs.readdir(dir).catch(() => [] as string[]);
  await Promise.all(
    entries
      .filter((name) => name.startsWith("sidebar."))
      .map((name) => fs.unlink(path.join(dir, name)).catch(() => {})),
  );
  const safe = `sidebar${ext}`;
  await fs.writeFile(path.join(dir, safe), bytes);
  return `${PRIVATE_DOCUMENT_PUBLIC_DIR}/${projectId}/${safe}`;
}

export async function removePrivateDocumentFile(fileUrl: string): Promise<void> {
  if (!fileUrl.startsWith(`${PRIVATE_DOCUMENT_PUBLIC_DIR}/`)) return;
  const rel = fileUrl.slice(1);
  const abs = path.join(process.cwd(), "public", rel);
  await fs.unlink(abs).catch(() => {});
}

export async function removePrivateProjectUploads(projectId: string): Promise<void> {
  await fs.rm(uploadsDir(projectId), { recursive: true, force: true }).catch(() => {});
}

export function newDocumentId(): string {
  return crypto.randomUUID();
}
