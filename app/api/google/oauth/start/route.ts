import { randomBytes } from "node:crypto";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/auth";
import { GOOGLE_OAUTH_STATE_COOKIE, googleOAuthRedirectUri, googleOAuthStartUrl } from "@/lib/google-oauth";

/** Signed-in admin starts Google Calendar + Drive consent. Callback is on this site. */
export async function GET(request: NextRequest) {
  const gate = await requireAdminRequest(request);
  if (gate instanceof NextResponse) return gate;

  const redirectUri = googleOAuthRedirectUri(request);
  const state = randomBytes(24).toString("hex");
  const authUrl = googleOAuthStartUrl(redirectUri, state);
  if (!authUrl) {
    return NextResponse.json(
      { error: "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET on this site first." },
      { status: 503 },
    );
  }

  const response = NextResponse.redirect(authUrl);
  response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: redirectUri.startsWith("https://"),
    sameSite: "lax",
    path: "/api/google/oauth",
    maxAge: 10 * 60,
  });
  return response;
}
