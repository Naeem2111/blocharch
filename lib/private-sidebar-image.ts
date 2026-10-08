import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deleteDriveFile, downloadDriveFile, isGoogleDriveConfigured, uploadDriveFile } from "@/lib/google-drive";
import { ensureStoredClientFolder } from "@/lib/private-drive-documents";
import { removePrivateDocumentFile, savePrivateSidebarImage } from "@/lib/private-document-storage";
import { documentStreamResponse } from "@/lib/private-document-response";

export const PORTAL_SIDEBAR_KIND = "portal-sidebar";
export const SIDEBAR_IMAGE_MAX_BYTES = 8 * 1024 * 1024;

const SIDEBAR_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

type ImageProject = {
  id: string;
  portalImageUrl: string | null;
  portalImageDriveFileId: string | null;
  portalImageMimeType: string | null;
  updatedAt: Date;
  client: { id: string; name: string; slug: string | null; googleDriveFolderId: string | null };
};

export function staffSidebarImagePath(projectId: string, updatedAt: Date) {
  return `/api/private/projects/${projectId}/sidebar-image?v=${updatedAt.getTime()}`;
}

export function portalSidebarImagePath(slug: string, updatedAt: Date) {
  return `/api/private/portal/${slug}/sidebar-image?v=${updatedAt.getTime()}`;
}

export function hasSidebarImage(project: { portalImageUrl: string | null; portalImageDriveFileId: string | null }) {
  return Boolean(project.portalImageUrl || project.portalImageDriveFileId);
}

const EXT_TO_MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

function resolveSidebarMime(mime: string, filename: string): { mime: string; ext: string } | null {
  const normalized = mime.trim().toLowerCase() === "image/jpg" ? "image/jpeg" : mime.trim().toLowerCase();
  if (SIDEBAR_MIME[normalized]) return { mime: normalized, ext: SIDEBAR_MIME[normalized] };
  const fromExt = EXT_TO_MIME[path.extname(filename).toLowerCase()];
  if (!fromExt || !SIDEBAR_MIME[fromExt]) return null;
  return { mime: fromExt, ext: SIDEBAR_MIME[fromExt] };
}

async function clearStoredImage(project: Pick<ImageProject, "portalImageUrl" | "portalImageDriveFileId">) {
  if (project.portalImageDriveFileId) {
    await deleteDriveFile(project.portalImageDriveFileId).catch(() => {});
  }
  if (project.portalImageUrl) {
    await removePrivateDocumentFile(project.portalImageUrl);
  }
}

export async function replaceProjectSidebarImage(project: ImageProject, file: File) {
  if (file.size <= 0) throw new Error("Choose an image");
  if (file.size > SIDEBAR_IMAGE_MAX_BYTES) throw new Error("Image must be 8 MB or smaller");
  const resolved = resolveSidebarMime(file.type, file.name);
  if (!resolved) throw new Error("Upload a JPG, PNG, WebP, or GIF");
  const bytes = Buffer.from(await file.arrayBuffer());
  const previousDriveId = project.portalImageDriveFileId;
  const previousUrl = project.portalImageUrl;

  const saved = isGoogleDriveConfigured()
    ? await (async () => {
        const folderId = await ensureStoredClientFolder(project.client);
        const uploaded = await uploadDriveFile({
          folderId,
          name: `portal-sidebar${resolved.ext}`,
          mimeType: resolved.mime,
          bytes,
          clientVisible: false,
          clientId: project.client.id,
          projectId: project.id,
          kind: PORTAL_SIDEBAR_KIND,
        });
        return prisma.privateProject.update({
          where: { id: project.id },
          data: {
            portalImageDriveFileId: uploaded.id,
            portalImageUrl: null,
            portalImageMimeType: resolved.mime,
          },
        });
      })()
    : await (async () => {
        const fileUrl = await savePrivateSidebarImage(project.id, resolved.ext, bytes);
        return prisma.privateProject.update({
          where: { id: project.id },
          data: {
            portalImageDriveFileId: null,
            portalImageUrl: fileUrl,
            portalImageMimeType: resolved.mime,
          },
        });
      })();

  if (previousDriveId && previousDriveId !== saved.portalImageDriveFileId) {
    await deleteDriveFile(previousDriveId).catch(() => {});
  }
  if (previousUrl && previousUrl !== saved.portalImageUrl) {
    await removePrivateDocumentFile(previousUrl);
  }
  return saved;
}

export async function clearProjectSidebarImage(project: ImageProject) {
  await clearStoredImage(project);
  return prisma.privateProject.update({
    where: { id: project.id },
    data: {
      portalImageDriveFileId: null,
      portalImageUrl: null,
      portalImageMimeType: null,
    },
  });
}

export async function sidebarImageResponse(project: {
  portalImageUrl: string | null;
  portalImageDriveFileId: string | null;
  portalImageMimeType: string | null;
}) {
  if (project.portalImageDriveFileId) {
    const file = await downloadDriveFile(project.portalImageDriveFileId);
    return documentStreamResponse("sidebar", project.portalImageMimeType || file.mimeType, file.body, true);
  }
  const fileUrl = project.portalImageUrl;
  if (!fileUrl?.startsWith("/uploads/private/")) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const abs = path.join(process.cwd(), "public", fileUrl);
  if (!fs.existsSync(abs)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const data = fs.readFileSync(abs);
  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": project.portalImageMimeType || "image/jpeg",
      "Cache-Control": "private, max-age=60",
    },
  });
}
