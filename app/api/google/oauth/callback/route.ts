import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/auth";
import { GOOGLE_OAUTH_STATE_COOKIE, exchangeGoogleAuthCode, googleOAuthRedirectUri } from "@/lib/google-oauth";

function page(title: string, body: string, status = 200) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>
    body { font-family: Segoe UI, sans-serif; background: #0b1220; color: #e2e8f0; margin: 0; padding: 32px; }
    main { max-width: 40rem; }
    h1 { font-size: 1.4rem; }
    textarea { width: 100%; min-height: 6rem; font-family: Consolas, monospace; font-size: 13px; }
    p { line-height: 1.5; color: #cbd5e1; }
    code { color: #7dd3fc; }
  </style>
</head>
<body><main><h1>${title}</h1>${body}</main></body>
</html>`;
  return new NextResponse(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

/** Google redirects here after consent. Admin session cookie must still be present. */
export async function GET(request: NextRequest) {
  const gate = await requireAdminRequest(request);
  if (gate instanceof NextResponse) {
    return page(
      "Sign in required",
      "<p>Log in to the Blocharch console as an admin, then open <code>/api/google/oauth/start</code> again.</p>",
      401,
    );
  }

  const expected = request.cookies.get(GOOGLE_OAUTH_STATE_COOKIE)?.value;
  const state = request.nextUrl.searchParams.get("state");
  if (!expected || !state || expected !== state) {
    return page("Could not verify this sign-in", "<p>Start again from <code>/api/google/oauth/start</code>.</p>", 400);
  }

  const error = request.nextUrl.searchParams.get("error");
  if (error) {
    return page("Google declined access", `<p>${error}</p>`, 400);
  }

  const code = request.nextUrl.searchParams.get("code");
  if (!code) return page("Missing code", "<p>Google did not return an authorization code.</p>", 400);

  try {
    const data = await exchangeGoogleAuthCode(code, googleOAuthRedirectUri(request));
    const response = data.refresh_token
      ? page(
          "Google connected",
          `<p>Copy this into the site environment as <code>GOOGLE_REFRESH_TOKEN</code>, then redeploy. This token includes Calendar and Drive.</p>
           <textarea readonly>${data.refresh_token.replace(/</g, "")}</textarea>
           <p>Do not send this token in chat. Close this page after it is saved.</p>`,
        )
      : page(
          "No refresh token",
          "<p>Google did not return a refresh token. Remove Blocharch’s access at <a href=\"https://myaccount.google.com/permissions\">Google Account permissions</a>, then open <code>/api/google/oauth/start</code> again.</p>",
          400,
        );
    response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, "", { path: "/api/google/oauth", maxAge: 0 });
    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Token exchange failed";
    return page("Google sign-in failed", `<p>${message.replace(/</g, "")}</p>`, 502);
  }
}
