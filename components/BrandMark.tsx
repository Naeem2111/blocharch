import Image from "next/image";
import Link from "next/link";
import { brandAssets } from "@/lib/blocharch-brand";

type Props = {
  className?: string;
  compact?: boolean;
  /** Vertical, centered — for login */
  variant?: "row" | "stack";
  /** Sidebar header size (default row logo is 40px; xl is 5×). */
  logoSize?: "default" | "xl";
};

const LOGO_DISPLAY = {
  default: { className: "h-10 w-10", width: 100, height: 100 },
  xl: { className: "h-[12.5rem] w-[12.5rem]", width: 500, height: 500 },
  stack: { className: "h-20 w-20 max-h-[5.5rem] max-w-[5.5rem]", width: 100, height: 100 },
} as const;

/** Blocharch logo + Console label. */
export function BrandMark({
  className = "",
  compact = false,
  variant = "row",
  logoSize = "default",
}: Props) {
  const stack = variant === "stack";
  const logo = stack ? LOGO_DISPLAY.stack : LOGO_DISPLAY[logoSize];

  return (
    <Link
      href="/dashboard"
      className={`group flex rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-page)] ${
        stack ? "flex-col items-center gap-3 text-center" : "flex-col gap-1.5 items-start"
      } ${className}`}
    >
      <Image
        src={brandAssets.logo}
        alt="Blocharch"
        width={logo.width}
        height={logo.height}
        priority
        className={`${logo.className} object-contain object-left dark:mix-blend-normal`}
      />
      {!compact && (
        <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          Console
        </span>
      )}
    </Link>
  );
}
