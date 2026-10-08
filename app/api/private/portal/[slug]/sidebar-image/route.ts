import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasSidebarImage, sidebarImageResponse } from "@/lib/private-sidebar-image";

export async function GET(
  _request: NextRequest,
  { params }: { params: { slug: string } },
) {
  const client = await prisma.privateClient.findFirst({
    where: { slug: params.slug.trim(), portalEnabled: true },
    select: { id: true },
  });
  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const project = await prisma.privateProject.findFirst({
    where: { clientId: client.id, status: { in: ["active", "completed", "on_hold"] } },
    orderBy: { updatedAt: "desc" },
    select: {
      portalImageUrl: true,
      portalImageDriveFileId: true,
      portalImageMimeType: true,
    },
  });
  if (!project || !hasSidebarImage(project)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return sidebarImageResponse(project);
}
