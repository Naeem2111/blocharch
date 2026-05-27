import Link from "next/link";

export type OpsNavItem = {
  href: string;
  label: string;
};

export const OPS_NAV: OpsNavItem[] = [
  { href: "/dashboard/ops", label: "Overview" },
  { href: "/dashboard/ops/clients", label: "Clients" },
  { href: "/dashboard/ops/athletes", label: "Athletes" },
  { href: "/dashboard/ops/projects", label: "Projects" },
  { href: "/dashboard/ops/commercial", label: "Commercial" },
  { href: "/dashboard/ops/analytics", label: "Analytics" },
  { href: "/dashboard/ops/notifications", label: "Notifications" },
];

export function OpsSubNav({ pathname }: { pathname: string }) {
  return (
    <nav
      className="mb-8 flex flex-wrap gap-2 border-b border-white/[0.06] pb-4"
      aria-label="Athlete operations"
    >
      {OPS_NAV.map((item) => {
        const active =
          item.href === "/dashboard/ops"
            ? pathname === "/dashboard/ops"
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium ring-1 transition-colors ${
              active
                ? "bg-brand-500/20 text-brand-200 ring-brand-500/30"
                : "bg-white/[0.04] text-slate-400 ring-white/[0.08] hover:bg-white/[0.07]"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
