import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE } from "@/lib/auth";
import { verifyPassword } from "@/lib/password";
import { requestIsSecure } from "@/lib/request-https";
import { buildSessionPayload, defaultSessionExpirySeconds, signSessionToken } from "@/lib/session-token";
import { findUserByUsername } from "@/lib/users-store";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Send a JSON body: { \"username\": \"…\", \"password\": \"…\" }" },
      { status: 400 }
    );
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const o = body as Record<string, unknown>;
  const username = String(o.username ?? "").trim();
  const password = String(o.password ?? "").trim();

  try {
    const user = findUserByUsername(username);
    if (!user || user.disabled || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
    }

    const token = await signSessionToken(buildSessionPayload(user.id, user.role));
    const secure = requestIsSecure(request);

    const res = NextResponse.json({ ok: true });
    res.cookies.set(AUTH_COOKIE, token, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      maxAge: defaultSessionExpirySeconds(),
      path: "/",
    });
    return res;
  } catch (err) {
    console.error("[auth/login]", err);
    return NextResponse.json(
      { error: "Login failed on the server. If this is a new deploy, check Vercel logs and user storage configuration." },
      { status: 503 }
    );
  }
}
