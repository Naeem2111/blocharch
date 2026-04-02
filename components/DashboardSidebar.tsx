"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark } from "@/components/BrandMark";
import { LogoutButton } from "@/components/LogoutButton";
import { BLOCHARCH_SITE } from "@/lib/blocharch-brand";

const NAV: { href: string; label: string; icon: React.ReactNode }[] = [
  {
    href: "/dashboard",
    label: "Overview",
    icon: (
      <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
      </svg>
    ),
  },
  {
    href: "/dashboard/practices",
    label: "Practices",
    icon: (
      <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008H18v-.008zm0 3h.008v.008H18V18zm0 3h.008v.008H18v-.008z" />
      </svg>
    ),
  },
  {
    href: "/dashboard/map",
    label: "Map",
    icon: (
      <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.106-18.256c.746.393 1.196 1.192 1.196 2.042v15.638a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184m7.5 0v-.462c0-.41-.34-.75-.75-.75h-4.5c-.41 0-.75.34-.75.75v.462m4.5 0v.462c0 .41-.34.75-.75.75h-4.5a.75.75 0 01-.75-.75v-.462m4.5 0h-4.5" />
      </svg>
    ),
  },
  {
    href: "/dashboard/automation",
    label: "Lead nurturing",
    icon: (
      <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
      </svg>
    ),
  },
];

function navActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DashboardSidebar() {
  const pathname = usePathname() || "";

  return (
    <aside className="flex w-[260px] min-h-screen flex-shrink-0 flex-col border-r border-white/[0.06] bg-[var(--bg-sidebar)]">
      <div className="border-b border-white/[0.06] px-4 py-5">
        <BrandMark />
        <p className="mt-3 text-xs leading-relaxed text-slate-500">
          Directory data &amp; outreach tools for architectdirectory.co.uk
        </p>
        <a
          href={BLOCHARCH_SITE}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-brand-400/90 hover:text-brand-300"
        >
          blocharch.com
          <span aria-hidden className="text-[10px] opacity-70">
            ↗
          </span>
        </a>
      </div>
      <nav className="flex-1 space-y-0.5 p-3" aria-label="Main">
        {NAV.map(({ href, label, icon }) => {
          const active = navActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-brand-500/15 text-brand-300 ring-1 ring-brand-500/25"
                  : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
              }`}
            >
              <span className={active ? "text-brand-400" : "text-slate-500"}>{icon}</span>
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/[0.06] p-4">
        <div className="flex items-center justify-between gap-2 rounded-lg bg-white/[0.03] px-3 py-2.5 ring-1 ring-white/[0.06]">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Signed in</p>
            <p className="truncate text-xs text-slate-400">Blocharch operator</p>
          </div>
          <LogoutButton />
        </div>
      </div>
    </aside>
  );
}
