import fs from "node:fs/promises";
import path from "node:path";
import { privateDocumentExtension } from "@/lib/private-document-storage";

export const OPS_DOCUMENT_PUBLIC_DIR = "/uploads/ops";

function uploadsDir(projectId: string): string {
  return path.join(process.cwd(), "public", "uploads", "ops", projectId);
}

export async function saveOpsDocumentFile(
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
  return `${OPS_DOCUMENT_PUBLIC_DIR}/${projectId}/${safe}`;
}

export async function removeOpsDocumentFile(fileUrl: string): Promise<void> {
  if (!fileUrl.startsWith(`${OPS_DOCUMENT_PUBLIC_DIR}/`)) return;
  const abs = path.join(process.cwd(), "public", fileUrl.slice(1));
  await fs.unlink(abs).catch(() => {});
}
