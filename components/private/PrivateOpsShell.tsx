"use client";

import { usePathname } from "next/navigation";
import { PrivateOpsSubNav } from "./PrivateOpsSubNav";

export function PrivateOpsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "";
  return (
    <div className="mx-auto w-full max-w-[90rem]">
      <PrivateOpsSubNav pathname={pathname} />
      {children}
    </div>
  );
}
