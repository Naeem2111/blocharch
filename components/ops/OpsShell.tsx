"use client";

import { usePathname } from "next/navigation";
import { OpsSubNav } from "./OpsSubNav";

export function OpsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "";
  return (
    <div className="mx-auto max-w-[min(100vw-2rem,90rem)]">
      <OpsSubNav pathname={pathname} />
      {children}
    </div>
  );
}
