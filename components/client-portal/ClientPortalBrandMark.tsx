import Image from "next/image";
import Link from "next/link";
import { brandAssets } from "@/lib/blocharch-brand";

/** Blocharch logo for the public client portal (no Console label). */
export function ClientPortalBrandMark({ className = "" }: { className?: string }) {
  return (
    <Link
      href="https://www.blocharch.com/"
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60 ${className}`}
    >
      <Image
        src={brandAssets.clientLogo}
        alt="Blocharch"
        width={120}
        height={40}
        priority
        className="h-9 w-auto object-contain object-left"
      />
    </Link>
  );
}
