"use client";

import Link from "next/link";
import { BlocharchWordmark } from "@/components/BlocharchWordmark";

/** Blocharch logo for the public client portal (no Console label). */
export function ClientPortalBrandMark({ className = "" }: { className?: string }) {
  return (
    <Link
      href="https://www.blocharch.com/"
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60 ${className}`}
    >
      <BlocharchWordmark size="md" />
    </Link>
  );
}
