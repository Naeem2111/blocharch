import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isOpsPricingTier, laneCostForTier } from "@/lib/ops-constants";
import { requireOpsSession } from "@/lib/ops-access";
import {
  clientInclude,
  mapClientToJson,
  parseContactsFromBody,
} from "@/lib/ops-client-api";

export async function GET(request: NextRequest) {
  const gate = await requireOpsSession(request);
  if (gate instanceof NextResponse) return gate;

  const clients = await prisma.opsClient.findMany({
    orderBy: { name: "asc" },
    include: clientInclude,
  });

  return NextResponse.json({
    clients: clients.map(mapClientToJson),
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
    const contacts = parseContactsFromBody(body) ?? [];

    const client = await prisma.opsClient.create({
      data: {
        name,
        companyName: body.companyName ? String(body.companyName).trim() : null,
        software: body.software ? String(body.software).trim() : null,
        phone: body.phone ? String(body.phone).trim() : null,
        country: body.country ? String(body.country).trim() : null,
        notes: body.notes ? String(body.notes).trim() : null,
        contacts: {
          create: contacts.map((c, i) => ({
            name: c.name,
            email: c.email,
            sortOrder: i,
          })),
        },
        commercial: {
          create: {
            pricingTier,
            laneCostGbp: laneCostForTier(pricingTier),
            activeLaneCount,
          },
        },
      },
      include: clientInclude,
    });

    return NextResponse.json({ client: mapClientToJson(client) }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
