import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { canDeletePrivateProject, requirePrivateOpsSession, slugifyPrivateClient } from "@/lib/private-access";
import { removePrivateProjectUploads } from "@/lib/private-document-storage";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const gate = await requirePrivateOpsSession(request);
  if (gate instanceof NextResponse) return gate;

  const existing = await prisma.privateClient.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const body = await request.json();
    const data: Record<string, unknown> = {};

    if (body.name !== undefined) {
      const name = String(body.name || "").trim();
      if (!name) return NextResponse.json({ error: "Client name is required" }, { status: 400 });
      data.name = name;
    }
    if (body.contactEmail !== undefined) {
      data.contactEmail = String(body.contactEmail || "").trim() || null;
    }
    if (body.contactPhone !== undefined) {
      data.contactPhone = String(body.contactPhone || "").trim() || null;
    }
    if (body.notes !== undefined) {
      data.notes = String(body.notes || "").trim() || null;
    }
    if (body.portalEnabled !== undefined) {
      data.portalEnabled = Boolean(body.portalEnabled);
    }
    if (body.regenerateSlug === true) {
      const base = slugifyPrivateClient(String(data.name ?? existing.name));
      let slug = base;
      const clash = await prisma.privateClient.findFirst({
        where: { slug, NOT: { id: existing.id } },
      });
      if (clash) slug = `${base}-${Date.now().toString(36).slice(-4)}`;
      data.slug = slug;
    }

    const client = await prisma.privateClient.update({
      where: { id: params.id },
      data,
    });

    return NextResponse.json({
      client: {
        id: client.id,
        name: client.name,
        contactEmail: client.contactEmail,
        contactPhone: client.contactPhone,
        slug: client.slug,
        portalEnabled: client.portalEnabled,
        notes: client.notes,
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not update client" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const gate = await requirePrivateOpsSession(request);
  if (gate instanceof NextResponse) return gate;
  if (!canDeletePrivateProject(gate.user.role)) {
    return NextResponse.json(
      { error: "Only managers and admins can delete private clients" },
      { status: 403 },
    );
  }

  const client = await prisma.privateClient.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      slug: true,
      projects: { select: { id: true } },
    },
  });
  if (!client) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    await prisma.privateClient.delete({ where: { id: client.id } });
    await Promise.all(client.projects.map((p) => removePrivateProjectUploads(p.id)));
    revalidatePath("/dashboard/private");
    revalidatePath("/dashboard/private/clients");
    revalidatePath("/dashboard/private/projects");
    if (client.slug) {
      revalidatePath(`/private/${client.slug}`);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not delete client" }, { status: 500 });
  }
}
