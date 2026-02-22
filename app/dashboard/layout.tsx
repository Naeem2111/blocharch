import Link from "next/link";
import { LogoutButton } from "@/components/LogoutButton";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <aside className="w-56 min-h-screen bg-slate-850 border-r border-slate-700 flex flex-col flex-shrink-0">
        <div className="p-5 border-b border-slate-700">
          <Link href="/dashboard" className="text-lg font-semibold text-white tracking-tight">
            Architect Leads
          </Link>
          <p className="text-xs text-slate-400 mt-0.5">Nurture & generate leads</p>
        </div>
        <nav className="flex-1 p-3 space-y-0.5">
          <NavLink href="/dashboard">Dashboard</NavLink>
          <NavLink href="/dashboard/practices">Practices</NavLink>
          <NavLink href="/dashboard/automation">Lead nurturing</NavLink>
        </nav>
        <div className="p-3 border-t border-slate-700 flex items-center justify-between">
          <span className="text-xs text-slate-500">blocharch</span>
          <LogoutButton />
        </div>
      </aside>
      <main className="flex-1 p-8 overflow-auto">{children}</main>
    </div>
  );
}

function NavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-3 py-2 rounded-lg text-slate-300 hover:bg-slate-700/50 hover:text-white transition-colors"
    >
      {children}
    </Link>
  );
}
