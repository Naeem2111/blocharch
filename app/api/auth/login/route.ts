import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE } from "@/lib/auth";
import { verifyPassword } from "@/lib/password";
import { requestIsSecure } from "@/lib/request-https";
import { buildSessionPayload, defaultSessionExpirySeconds, signSessionToken } from "@/lib/session-token";
import { findUserByUsername } from "@/lib/users-store";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const username = (body.username || "").trim();
    const password = (body.password || "").trim();

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
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
