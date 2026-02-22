import { NextResponse } from "next/server";

const AUTH_COOKIE = "blocarch_session";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(AUTH_COOKIE);
  return res;
}
