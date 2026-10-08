import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePrivateOpsSession } from "@/lib/private-access";
import {
  clearProjectSidebarImage,
  hasSidebarImage,
  replaceProjectSidebarImage,
  sidebarImageResponse,
  staffSidebarImagePath,
} from "@/lib/private-sidebar-image";

const imageSelect = {
  id: true,
  portalImageUrl: true,
  portalImageDriveFileId: true,
  portalImageMimeType: true,
  updatedAt: true,
  client: {
    select: { id: true, name: true, slug: true, googleDriveFolderId: true },
  },
} as const;

function payload(project: { id: string; updatedAt: Date; portalImageUrl: string | null; portalImageDriveFileId: string | null }) {
  return {
    sidebarImageUrl: hasSidebarImage(project) ? staffSidebarImagePath(project.id, project.updatedAt) : null,
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
    select: imageSelect,
  });
  if (!project || !hasSidebarImage(project)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return sidebarImageResponse(project);
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const gate = await requirePrivateOpsSession(request);
  if (gate instanceof NextResponse) return gate;
  const project = await prisma.privateProject.findUnique({
    where: { id: params.id },
    select: imageSelect,
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Image required" }, { status: 400 });

  try {
    const saved = await replaceProjectSidebarImage(project, file);
    if (project.client.slug) revalidatePath(`/private/${project.client.slug}`);
    return NextResponse.json(payload(saved));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save the image";
    const status = /Drive|Google/i.test(message) ? 502 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const gate = await requirePrivateOpsSession(request);
  if (gate instanceof NextResponse) return gate;
  const project = await prisma.privateProject.findUnique({
    where: { id: params.id },
    select: imageSelect,
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const saved = await clearProjectSidebarImage(project);
  if (project.client.slug) revalidatePath(`/private/${project.client.slug}`);
  return NextResponse.json(payload(saved));
}
