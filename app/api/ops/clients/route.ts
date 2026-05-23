import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isOpsPricingTier, laneCostForTier } from "@/lib/ops-constants";
import { requireOpsSession } from "@/lib/ops-access";

export async function GET(request: NextRequest) {
  const gate = await requireOpsSession(request);
  if (gate instanceof NextResponse) return gate;

  const clients = await prisma.opsClient.findMany({
    orderBy: { name: "asc" },
    include: { commercial: true, _count: { select: { projects: true } } },
  });

  return NextResponse.json({
    clients: clients.map((c) => ({
      id: c.id,
      name: c.name,
      companyName: c.companyName,
      contactPerson: c.contactPerson,
      email: c.email,
      phone: c.phone,
      country: c.country,
      status: c.status,
      notes: c.notes,
      projectCount: c._count.projects,
      commercial: c.commercial
        ? {
            pricingTier: c.commercial.pricingTier,
            laneCostGbp: Number(c.commercial.laneCostGbp),
            overtimeBillingGbp: Number(c.commercial.overtimeBillingGbp),
            activeLaneCount: c.commercial.activeLaneCount,
          }
        : null,
    })),
  });
}

export async function POST(request: NextRequest) {
  const gate = await requireOpsSession(request);
  if (gate instanceof NextResponse) return gate;

  try {
    const body = await request.json();
    const name = String(body.name || "").trim();
    if (name.length < 1 || name.length > 200) {
      return NextResponse.json({ error: "Client name required (1–200 characters)" }, { status: 400 });
    }

    const tierRaw = String(body.pricingTier || "tier_30");
    const pricingTier = isOpsPricingTier(tierRaw) ? tierRaw : "tier_30";
    const activeLaneCount = Math.max(1, Math.min(20, Number(body.activeLaneCount) || 1));

    const client = await prisma.opsClient.create({
      data: {
        name,
        companyName: body.companyName ? String(body.companyName).trim() : null,
        contactPerson: body.contactPerson ? String(body.contactPerson).trim() : null,
        email: body.email ? String(body.email).trim() : null,
        phone: body.phone ? String(body.phone).trim() : null,
        country: body.country ? String(body.country).trim() : null,
        notes: body.notes ? String(body.notes).trim() : null,
        commercial: {
          create: {
            pricingTier,
            laneCostGbp: laneCostForTier(pricingTier),
            activeLaneCount,
          },
        },
      },
      include: { commercial: true },
    });

    return NextResponse.json({ client: { id: client.id, name: client.name } }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
