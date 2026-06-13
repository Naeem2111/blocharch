"use client";

import { usePathname } from "next/navigation";
import { OpsSubNav } from "./OpsSubNav";

export function OpsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "";
  return (
    <div className="mx-auto w-full max-w-[90rem]">
      <OpsSubNav pathname={pathname} />
      {children}
    </div>
  );
}
