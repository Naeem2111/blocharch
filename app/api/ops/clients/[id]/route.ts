import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { OpsPricingTier } from "@prisma/client";
import { isOpsPricingTier, laneCostForTier } from "@/lib/ops-constants";
import { requireOpsSession } from "@/lib/ops-access";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const gate = await requireOpsSession(request);
  if (gate instanceof NextResponse) return gate;

  const { id } = await context.params;
  const existing = await prisma.opsClient.findUnique({
    where: { id },
    include: { commercial: true },
  });
  if (!existing) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  try {
    const body = await request.json();
    const clientData: {
      name?: string;
      companyName?: string | null;
      contactPerson?: string | null;
      email?: string | null;
      phone?: string | null;
      country?: string | null;
      status?: "active" | "inactive";
      notes?: string | null;
    } = {};

    if (body.name != null) {
      const name = String(body.name).trim();
      if (name.length < 1 || name.length > 200) {
        return NextResponse.json({ error: "Invalid client name" }, { status: 400 });
      }
      clientData.name = name;
    }
    if (body.companyName !== undefined) clientData.companyName = body.companyName ? String(body.companyName).trim() : null;
    if (body.contactPerson !== undefined) clientData.contactPerson = body.contactPerson ? String(body.contactPerson).trim() : null;
    if (body.email !== undefined) clientData.email = body.email ? String(body.email).trim() : null;
    if (body.phone !== undefined) clientData.phone = body.phone ? String(body.phone).trim() : null;
    if (body.country !== undefined) clientData.country = body.country ? String(body.country).trim() : null;
    if (body.notes !== undefined) clientData.notes = body.notes ? String(body.notes).trim() : null;
    if (body.status === "active" || body.status === "inactive") clientData.status = body.status;

    const commercialData: {
      pricingTier?: OpsPricingTier;
      laneCostGbp?: number;
      activeLaneCount?: number;
      overtimeBillingGbp?: number;
    } = {};

    if (body.pricingTier != null) {
      const tier = String(body.pricingTier);
      if (!isOpsPricingTier(tier)) {
        return NextResponse.json({ error: "Invalid pricing tier" }, { status: 400 });
      }
      commercialData.pricingTier = tier;
      commercialData.laneCostGbp = laneCostForTier(tier);
    }
    if (body.activeLaneCount != null) {
      commercialData.activeLaneCount = Math.max(1, Math.min(20, Number(body.activeLaneCount) || 1));
    }
    if (body.overtimeBillingGbp != null) {
      commercialData.overtimeBillingGbp = Math.max(0, Number(body.overtimeBillingGbp) || 0);
    }

    const client = await prisma.$transaction(async (tx) => {
      const updated = await tx.opsClient.update({
        where: { id },
        data: clientData,
        include: { commercial: true, _count: { select: { projects: true } } },
      });
      if (existing.commercial && Object.keys(commercialData).length > 0) {
        await tx.opsClientCommercialProfile.update({
          where: { clientId: id },
          data: commercialData,
        });
      }
      return tx.opsClient.findUniqueOrThrow({
        where: { id },
        include: { commercial: true, _count: { select: { projects: true } } },
      });
    });

    return NextResponse.json({
      client: {
        id: client.id,
        name: client.name,
        companyName: client.companyName,
        contactPerson: client.contactPerson,
        email: client.email,
        phone: client.phone,
        country: client.country,
        status: client.status,
        notes: client.notes,
        projectCount: client._count.projects,
        commercial: client.commercial
          ? {
              pricingTier: client.commercial.pricingTier,
              laneCostGbp: Number(client.commercial.laneCostGbp),
              overtimeBillingGbp: Number(client.commercial.overtimeBillingGbp),
              activeLaneCount: client.commercial.activeLaneCount,
            }
          : null,
      },
    });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const gate = await requireOpsSession(request);
  if (gate instanceof NextResponse) return gate;

  const { id } = await context.params;
  const existing = await prisma.opsClient.findUnique({
    where: { id },
    include: { _count: { select: { projects: true } } },
  });
  if (!existing) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  await prisma.opsClient.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
