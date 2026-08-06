import Link from "next/link";

export type PrivateNavItem = {
  href: string;
  label: string;
};

export const PRIVATE_OPS_NAV: PrivateNavItem[] = [
  { href: "/dashboard/private", label: "Overview" },
  { href: "/dashboard/private/commercial", label: "Commercial & analytics" },
  { href: "/dashboard/private/projects", label: "Projects" },
  { href: "/dashboard/private/onboarding", label: "Onboarding" },
  { href: "/dashboard/private/project-types", label: "Project types" },
];

function navActive(pathname: string, href: string): boolean {
  return href === "/dashboard/private"
    ? pathname === "/dashboard/private"
    : pathname === href || pathname.startsWith(`${href}/`);
}

export function PrivateOpsSubNav({ pathname }: { pathname: string }) {
  return (
    <nav
      className="mb-6 flex gap-2 overflow-x-auto border-b border-white/[0.06] pb-4 [-ms-overflow-style:none] [scrollbar-width:none] md:mb-8 md:flex-wrap md:overflow-visible [&::-webkit-scrollbar]:hidden"
      aria-label="Private projects"
    >
      {PRIVATE_OPS_NAV.map((item) => {
        const active = navActive(pathname, item.href);
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
