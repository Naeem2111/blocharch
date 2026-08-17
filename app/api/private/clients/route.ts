import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePrivateOpsSession, slugifyPrivateClient } from "@/lib/private-access";

export async function GET(request: NextRequest) {
  const gate = await requirePrivateOpsSession(request);
  if (gate instanceof NextResponse) return gate;

  const clients = await prisma.privateClient.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { projects: true } },
      projects: {
        orderBy: { updatedAt: "desc" },
        select: { id: true, name: true, status: true, designStage: true },
      },
    },
  });

  return NextResponse.json({
    clients: clients.map((c) => ({
      id: c.id,
      name: c.name,
      contactEmail: c.contactEmail,
      contactPhone: c.contactPhone,
      slug: c.slug,
      portalEnabled: c.portalEnabled,
      notes: c.notes,
      projectCount: c._count.projects,
      projects: c.projects,
      latestProject: c.projects[0] ?? null,
      createdAt: c.createdAt.toISOString(),
    })),
  });
}

export async function POST(request: NextRequest) {
  const gate = await requirePrivateOpsSession(request);
  if (gate instanceof NextResponse) return gate;

  try {
    const body = await request.json();
    const name = String(body.name || "").trim();
    if (!name) return NextResponse.json({ error: "Client name is required" }, { status: 400 });

    let slug = slugifyPrivateClient(name);
    const existingSlug = await prisma.privateClient.findUnique({ where: { slug } });
    if (existingSlug) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;

    const client = await prisma.privateClient.create({
      data: {
        name,
        contactEmail: body.contactEmail ? String(body.contactEmail).trim() : null,
        contactPhone: body.contactPhone ? String(body.contactPhone).trim() : null,
        notes: body.notes ? String(body.notes).trim() : null,
        slug,
        portalEnabled: body.portalEnabled !== false,
      },
    });

    return NextResponse.json(
      {
        client: {
          id: client.id,
          name: client.name,
          contactEmail: client.contactEmail,
          contactPhone: client.contactPhone,
          slug: client.slug,
          portalEnabled: client.portalEnabled,
          notes: client.notes,
          projectCount: 0,
          latestProject: null,
        },
      },
      { status: 201 },
    );
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not create client" }, { status: 500 });
  }
}
