import { cookies } from "next/headers";

const AUTH_COOKIE = "blocarch_session";
const DEFAULT_USERNAME = "blocharch";
const DEFAULT_PASSWORD = "blocharch";

export function getAuthCredentials() {
  return { username: DEFAULT_USERNAME, password: DEFAULT_PASSWORD };
}

export async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const sess = cookieStore.get(AUTH_COOKIE);
  return sess?.value === "blocharch-authenticated";
}

export async function setAuthenticated(value: boolean): Promise<void> {
  const cookieStore = await cookies();
  if (value) {
    cookieStore.set(AUTH_COOKIE, "blocharch-authenticated", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });
  } else {
    cookieStore.delete(AUTH_COOKIE);
  }
}

export function validateCredentials(username: string, password: string): boolean {
  return username === DEFAULT_USERNAME && password === DEFAULT_PASSWORD;
}
