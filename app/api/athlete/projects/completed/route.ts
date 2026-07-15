import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAthletePortalSession } from "@/lib/ops-access";
import { buildOpsArchives } from "@/lib/ops-archives";

export async function GET(request: NextRequest) {
  const gate = await requireAthletePortalSession(request);
  if (gate instanceof NextResponse) return gate;
  const { athlete } = gate;

  const clientId = request.nextUrl.searchParams.get("clientId") || undefined;
  const archives = await buildOpsArchives({ athleteId: athlete.id, clientId });

  return NextResponse.json({
    projects: archives.projects,
  });
}
