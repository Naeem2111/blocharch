import Link from "next/link";

export type AthleteNavItem = {
  href: string;
  label: string;
};

export const ATHLETE_NAV: AthleteNavItem[] = [
  { href: "/dashboard/athlete", label: "Dashboard" },
  { href: "/dashboard/athlete/submissions", label: "Daily log" },
  { href: "/dashboard/athlete/projects", label: "My projects" },
];

export function AthleteSubNav({ pathname }: { pathname: string }) {
  return (
    <nav
      className="mb-8 flex flex-wrap gap-2 border-b border-white/[0.06] pb-4"
      aria-label="Athlete workspace"
    >
      {ATHLETE_NAV.map((item) => {
        const active =
          item.href === "/dashboard/athlete"
            ? pathname === "/dashboard/athlete"
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
