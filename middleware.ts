import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySessionToken } from "@/lib/session-token";

const AUTH_COOKIE = "blocarch_session";

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isApi = path.startsWith("/api/");
  const cookie = request.cookies.get(AUTH_COOKIE)?.value;
  const payload = cookie ? await verifySessionToken(cookie) : null;
  const isAuthenticated = payload !== null;

  if (path === "/login") {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.next();
  }

  const isN8nPath = path.startsWith("/api/n8n/");
  const apiKey = request.headers.get("x-api-key") || request.nextUrl.searchParams.get("apiKey");
  const n8nAuthorized =
    isN8nPath &&
    process.env.N8N_API_KEY &&
    apiKey &&
    apiKey === process.env.N8N_API_KEY;

  const isAdminPath = path.startsWith("/dashboard/admin") || path.startsWith("/api/admin/");
  if (isAdminPath && !n8nAuthorized) {
    if (!payload || payload.role !== "admin") {
      if (path.startsWith("/api/admin")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  const isProtected = path.startsWith("/dashboard") || path.startsWith("/api/") || path === "/";
  if (isProtected && !isAuthenticated && !n8nAuthorized) {
    if (isApi) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const login = new URL("/login", request.url);
    if (path !== "/") login.searchParams.set("from", path);
    return NextResponse.redirect(login);
  }

  if (path === "/") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/dashboard/:path*",
    "/api/practices/:path*",
    "/api/stats",
    "/api/leads/:path*",
    "/api/workflow/:path*",
    "/api/templates",
    "/api/n8n/:path*",
    "/api/geocode/:path*",
    "/api/me",
    "/api/admin/:path*",
  ],
};
