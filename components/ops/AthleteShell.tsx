"use client";

import { usePathname } from "next/navigation";
import { AthleteSubNav } from "./AthleteSubNav";

export function AthleteShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "";
  return (
    <div className="mx-auto max-w-[min(100vw-2rem,90rem)]">
      <AthleteSubNav pathname={pathname} />
      {children}
    </div>
  );
}
