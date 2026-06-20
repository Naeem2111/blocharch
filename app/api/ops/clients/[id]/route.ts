import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { OpsPricingTier } from "@prisma/client";
import {
  clampTierPercent,
  isOpsPricingTier,
  laneCostForTier,
  pricingTierForPercent,
} from "@/lib/ops-constants";
import { requireOpsSession } from "@/lib/ops-access";
import { removeClientLogoFiles } from "@/lib/client-logo-storage";
import {
  clientInclude,
  mapClientToJson,
  parseContactsFromBody,
} from "@/lib/ops-client-api";

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
      software?: string | null;
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
    if (body.companyName !== undefined) {
      clientData.companyName = body.companyName ? String(body.companyName).trim() : null;
    }
    if (body.software !== undefined) {
      clientData.software = body.software ? String(body.software).trim() : null;
    }
    if (body.phone !== undefined) clientData.phone = body.phone ? String(body.phone).trim() : null;
    if (body.country !== undefined) clientData.country = body.country ? String(body.country).trim() : null;
    if (body.notes !== undefined) clientData.notes = body.notes ? String(body.notes).trim() : null;
    if (body.status === "active" || body.status === "inactive") clientData.status = body.status;

    const contacts = parseContactsFromBody(body);

    const commercialData: {
      pricingTier?: OpsPricingTier;
      tierPercent?: number;
      laneCostGbp?: number;
      activeLaneCount?: number;
      overtimeBillingGbp?: number;
    } = {};

    if (body.tierPercent != null) {
      const tierPercent = clampTierPercent(body.tierPercent);
      commercialData.tierPercent = tierPercent;
      commercialData.pricingTier = pricingTierForPercent(tierPercent);
    } else if (body.pricingTier != null) {
      const tier = String(body.pricingTier);
      if (!isOpsPricingTier(tier)) {
        return NextResponse.json({ error: "Invalid pricing tier" }, { status: 400 });
      }
      commercialData.pricingTier = tier;
    }
    if (body.laneCostGbp != null) {
      commercialData.laneCostGbp = Math.max(0, Number(body.laneCostGbp) || 0);
    } else if (commercialData.pricingTier && body.laneCostGbp === undefined) {
      commercialData.laneCostGbp = laneCostForTier(commercialData.pricingTier);
    }
    if (body.activeLaneCount != null) {
      commercialData.activeLaneCount = Math.max(1, Math.min(20, Number(body.activeLaneCount) || 1));
    }
    if (body.overtimeBillingGbp != null) {
      commercialData.overtimeBillingGbp = Math.max(0, Number(body.overtimeBillingGbp) || 0);
    }

    const client = await prisma.$transaction(async (tx) => {
      await tx.opsClient.update({
        where: { id },
        data: clientData,
      });

      if (contacts !== undefined) {
        await tx.opsClientContact.deleteMany({ where: { clientId: id } });
        if (contacts.length > 0) {
          await tx.opsClientContact.createMany({
            data: contacts.map((c, i) => ({
              clientId: id,
              name: c.name,
              email: c.email,
              sortOrder: i,
            })),
          });
        }
      }

      if (existing.commercial && Object.keys(commercialData).length > 0) {
        await tx.opsClientCommercialProfile.update({
          where: { clientId: id },
          data: commercialData,
        });
      }

      return tx.opsClient.findUniqueOrThrow({
        where: { id },
        include: clientInclude,
      });
    });

    return NextResponse.json({ client: mapClientToJson(client) });
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

  await removeClientLogoFiles(id);
  await prisma.opsClient.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
