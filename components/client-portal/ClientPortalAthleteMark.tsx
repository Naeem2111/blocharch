import Image from "next/image";
import { brandAssets } from "@/lib/blocharch-brand";

/** Compact cube mark used next to “Athlete assigned” on client portal cards. */
export function ClientPortalAthleteMark({ className = "" }: { className?: string }) {
  return (
    <Image
      src={brandAssets.athleteAssigned}
      alt=""
      width={20}
      height={20}
      className={`inline-block h-5 w-5 shrink-0 object-contain ${className}`}
    />
  );
}
