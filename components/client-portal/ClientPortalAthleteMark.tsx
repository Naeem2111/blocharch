import Image from "next/image";
import { brandAssets } from "@/lib/blocharch-brand";

/** Compact cube mark used next to “Athlete assigned” on client portal cards. */
export function ClientPortalAthleteMark({ className = "" }: { className?: string }) {
  return (
    <Image
      src={brandAssets.favicon}
      alt=""
      width={16}
      height={16}
      className={`inline-block h-4 w-4 shrink-0 ${className}`}
    />
  );
}
