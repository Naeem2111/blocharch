import Image from "next/image";
import Link from "next/link";
import { brandAssets } from "@/lib/blocharch-brand";

type Props = {
  className?: string;
  compact?: boolean;
  /** Vertical, centered — for login */
  variant?: "row" | "stack";
};

/** Blocharch wordmark (https://www.blocharch.com/) + Console label. */
export function BrandMark({ className = "", compact = false, variant = "row" }: Props) {
  const stack = variant === "stack";

  return (
    <Link
      href="/dashboard"
      className={`group flex rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-page)] ${
        stack ? "flex-col items-center gap-3 text-center" : "flex-col gap-1.5 items-start"
      } ${className}`}
    >
      <Image
        src={brandAssets.wordmark}
        alt="Blocharch"
        width={220}
        height={64}
        priority
        className={
          stack
            ? "h-14 w-auto max-w-[min(100%,300px)] object-contain"
            : "h-9 w-auto max-w-[210px] object-contain object-left"
        }
      />
      {!compact && (
        <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          Console
        </span>
      )}
    </Link>
  );
}
