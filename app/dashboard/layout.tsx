import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { getSession } from "@/lib/auth";
import { THEME_COOKIE, themeCookieMaxAge } from "@/lib/theme";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const cookieStore = await cookies();
  cookieStore.set(THEME_COOKIE, session.user.theme, {
    httpOnly: false,
    sameSite: "lax",
    maxAge: themeCookieMaxAge(),
    path: "/",
  });

  return (
    <div className="flex min-h-screen">
      <DashboardSidebar user={session.user} />
      <main className="app-main flex-1 overflow-auto p-6 sm:p-8 lg:p-10">{children}</main>
    </div>
  );
}
