import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { updateUserPreferences } from "@/lib/users-store";
import { THEME_COOKIE, isThemePreference, themeCookieMaxAge } from "@/lib/theme";
import { parseSidebarNavOrder } from "@/lib/sidebar-nav-order";
import { requestIsSecure } from "@/lib/request-https";

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({
    theme: session.user.theme,
    sidebarNavOrder: session.user.sidebarNavOrder,
  });
}

export async function PATCH(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const patch: { theme?: "dark" | "light"; sidebarNavOrder?: ReturnType<typeof parseSidebarNavOrder> | null } =
    {};

  if ("theme" in body) {
    const theme = (body as { theme?: unknown }).theme;
    if (!isThemePreference(theme)) {
      return NextResponse.json({ error: 'Theme must be "dark" or "light"' }, { status: 400 });
    }
    patch.theme = theme;
  }

  if ("sidebarNavOrder" in body) {
    const raw = (body as { sidebarNavOrder?: unknown }).sidebarNavOrder;
    if (raw === null) {
      patch.sidebarNavOrder = null;
    } else {
      const parsed = parseSidebarNavOrder(raw);
      if (!parsed) {
        return NextResponse.json({ error: "Invalid sidebar layout" }, { status: 400 });
      }
      patch.sidebarNavOrder = parsed;
    }
  }

  if (patch.theme === undefined && patch.sidebarNavOrder === undefined) {
    return NextResponse.json({ error: "No preferences to update" }, { status: 400 });
  }

  const updated = await updateUserPreferences(session.user.id, patch);
  if (!updated.ok) {
    return NextResponse.json({ error: updated.error }, { status: 400 });
  }

  const res = NextResponse.json({
    theme: updated.user.theme,
    sidebarNavOrder: updated.user.sidebarNavOrder,
  });

  if (patch.theme !== undefined) {
    res.cookies.set(THEME_COOKIE, updated.user.theme, {
      httpOnly: false,
      secure: requestIsSecure(request),
      sameSite: "lax",
      maxAge: themeCookieMaxAge(),
      path: "/",
    });
  }

  return res;
}
