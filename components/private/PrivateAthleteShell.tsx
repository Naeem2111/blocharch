"use client";

import { PrivateAthleteSubNav } from "@/components/private/PrivateAthleteSubNav";
import { usePathname } from "next/navigation";

export function PrivateAthleteShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "";
  return (
    <div>
      <div className="mb-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          Private work
        </p>
        <p className="mt-0.5 text-xs text-slate-500">
          Cape Town private projects — separate from Production Lane (UK firms).
        </p>
      </div>
      <PrivateAthleteSubNav pathname={pathname} />
      {children}
    </div>
  );
}
