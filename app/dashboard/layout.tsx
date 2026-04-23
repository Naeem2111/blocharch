import { redirect } from "next/navigation";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { getSession } from "@/lib/auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen">
      <DashboardSidebar user={session.user} />
      <main className="app-main flex-1 overflow-auto p-6 sm:p-8 lg:p-10">{children}</main>
    </div>
  );
}
