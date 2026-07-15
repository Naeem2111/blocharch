"use client";

import Link from "next/link";
import { BlocharchWordmark, type WordmarkSize } from "@/components/BlocharchWordmark";

type Props = {
  className?: string;
  compact?: boolean;
  /** Vertical, centered — for login */
  variant?: "row" | "stack";
  /** Sidebar header size (xl is the enlarged dashboard logo). */
  logoSize?: "default" | "xl";
};

function resolveWordmarkSize(variant: "row" | "stack", logoSize: "default" | "xl"): WordmarkSize {
  if (variant === "stack") return "lg";
  if (logoSize === "xl") return "xl";
  return "sm";
}

/** Blocharch logo + Console label. */
export function BrandMark({
  className = "",
  compact = false,
  variant = "row",
  logoSize = "default",
}: Props) {
  const stack = variant === "stack";

  return (
    <Link
      href="/dashboard"
      className={`group flex rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-page)] ${
        stack ? "flex-col items-center gap-3 text-center" : "flex-col gap-1.5 items-start"
      } ${className}`}
    >
      <BlocharchWordmark
        size={resolveWordmarkSize(variant, logoSize)}
        centered={stack}
      />
      {!compact && (
        <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          Console
        </span>
      )}
    </Link>
  );
}
