import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { OpsAthlete } from "@prisma/client";
import { getSessionFromRequest } from "@/lib/auth";
import type { SessionUser } from "@/lib/auth";
import { canAccessModule } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { ensureLinkedAthleteProfile } from "@/lib/ops-athlete-profile";
import { isStaffAdmin } from "@/lib/admin-only-accounts";

export async function requirePrivateOpsSession(
  request: NextRequest,
): Promise<{ user: SessionUser } | NextResponse> {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessModule(session.user.role, "private_work", session.user.username)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (isStaffAdmin(session.user)) {
    await ensureLinkedAthleteProfile(session.user);
  }
  return { user: session.user };
}

export async function requirePrivateAthleteSession(
  request: NextRequest,
): Promise<{ user: SessionUser; athlete: OpsAthlete } | NextResponse> {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessModule(session.user.role, "athlete_portal", session.user.username)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let athlete = await prisma.opsAthlete.findUnique({ where: { userId: session.user.id } });
  if (!athlete) {
    athlete = await ensureLinkedAthleteProfile(session.user);
  }
  if (!athlete) {
    return NextResponse.json({ error: "No athlete profile linked to this account" }, { status: 404 });
  }
  if (athlete.status !== "active") {
    return NextResponse.json({ error: "Athlete account is inactive" }, { status: 403 });
  }

  return { user: session.user, athlete };
}

export function slugifyPrivateClient(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return base || "client";
}
