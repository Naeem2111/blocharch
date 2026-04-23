import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySessionToken, type SessionPayload } from "@/lib/session-token";
import { findUserById, type UserRecord } from "@/lib/users-store";

export const AUTH_COOKIE = "blocarch_session";

export type SessionUser = Omit<UserRecord, "passwordHash">;

export async function getSession(): Promise<{ payload: SessionPayload; user: SessionUser } | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(AUTH_COOKIE)?.value;
  if (!raw) return null;
  const payload = await verifySessionToken(raw);
  if (!payload) return null;
  const row = findUserById(payload.sub);
  if (!row || row.disabled) return null;
  if (row.role !== payload.role) return null;
  const { passwordHash: _, ...user } = row;
  return { payload, user };
}

export async function getSessionFromRequest(
  request: NextRequest
): Promise<{ payload: SessionPayload; user: SessionUser } | null> {
  const raw = request.cookies.get(AUTH_COOKIE)?.value;
  if (!raw) return null;
  const payload = await verifySessionToken(raw);
  if (!payload) return null;
  const row = findUserById(payload.sub);
  if (!row || row.disabled) return null;
  if (row.role !== payload.role) return null;
  const { passwordHash: _, ...user } = row;
  return { payload, user };
}

export async function isAuthenticated(): Promise<boolean> {
  return (await getSession()) !== null;
}

export async function requireAdminRequest(
  request: NextRequest
): Promise<{ payload: SessionPayload; user: SessionUser } | NextResponse> {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return session;
}
