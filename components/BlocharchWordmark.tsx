"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { brandAssets } from "@/lib/blocharch-brand";
import {
  DEFAULT_THEME,
  type ThemePreference,
  isThemePreference,
  normalizeTheme,
} from "@/lib/theme";

function readThemeFromDom(): ThemePreference {
  if (typeof document === "undefined") return DEFAULT_THEME;
  return normalizeTheme(document.documentElement.dataset.theme);
}

/**
 * Square logo PNGs center the wordmark with padding above and below.
 * `visibleRatio` = viewport height; `offsetRatio` = shift up to skip top padding.
 */
const WORDMARK_SIZES = {
  sm: { width: "10.5rem", visibleRatio: 0.36, offsetRatio: 0.32 },
  md: { width: "13rem", visibleRatio: 0.36, offsetRatio: 0.32 },
  lg: { width: "14rem", visibleRatio: 0.36, offsetRatio: 0.32 },
  xl: { width: "15rem", visibleRatio: 0.36, offsetRatio: 0.32 },
} as const;

export type WordmarkSize = keyof typeof WORDMARK_SIZES;

export function BlocharchWordmark({
  size = "md",
  className = "",
  centered = false,
}: {
  size?: WordmarkSize;
  className?: string;
  centered?: boolean;
}) {
  const [theme, setTheme] = useState<ThemePreference>(DEFAULT_THEME);
  const dims = WORDMARK_SIZES[size];

  useEffect(() => {
    setTheme(readThemeFromDom());

    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel("blocarch-theme");
    channel.onmessage = (event: MessageEvent<{ theme?: unknown }>) => {
      if (!isThemePreference(event.data?.theme)) return;
      setTheme(event.data.theme);
    };
    return () => channel.close();
  }, []);

  const logoSrc = theme === "dark" ? brandAssets.clientLogoDark : brandAssets.clientLogo;

  return (
    <span
      className={`mb-0 mt-3 block shrink-0 overflow-hidden leading-none ${centered ? "mx-auto" : ""} ${className}`}
      style={{
        width: dims.width,
        height: `calc(${dims.width} * ${dims.visibleRatio})`,
      }}
    >
      <Image
        src={logoSrc}
        alt="Blocharch"
        width={600}
        height={600}
        priority
        className="block h-auto w-full"
        style={{ transform: `translateY(calc(${dims.width} * -${dims.offsetRatio}))` }}
      />
    </span>
  );
}
