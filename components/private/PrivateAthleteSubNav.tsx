import Link from "next/link";

export type PrivateAthleteNavItem = {
  href: string;
  label: string;
};

export const PRIVATE_ATHLETE_NAV: PrivateAthleteNavItem[] = [
  { href: "/dashboard/athlete/private", label: "My projects" },
  { href: "/dashboard/athlete/private/log", label: "Daily log" },
  { href: "/dashboard/athlete/private/completed", label: "Completed" },
];

export function PrivateAthleteSubNav({ pathname }: { pathname: string }) {
  return (
    <nav
      className="mb-6 flex gap-2 overflow-x-auto border-b border-white/[0.06] pb-4 [-ms-overflow-style:none] [scrollbar-width:none] md:mb-6 md:flex-wrap md:overflow-visible [&::-webkit-scrollbar]:hidden"
      aria-label="Private work"
    >
      {PRIVATE_ATHLETE_NAV.map((item) => {
        const active =
          item.href === "/dashboard/athlete/private"
            ? pathname === "/dashboard/athlete/private"
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium ring-1 transition-colors ${
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
