import { DashboardSidebar } from "@/components/DashboardSidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <DashboardSidebar />
      <main className="app-main flex-1 overflow-auto p-6 sm:p-8 lg:p-10">{children}</main>
    </div>
  );
}
