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

/** Visible crop box + oversized image to trim baked-in padding in logo PNGs. */
const WORDMARK_SIZES = {
  sm: { wrap: "h-[2.75rem] w-[10.5rem]", img: "h-[9rem] w-[10.5rem]" },
  md: { wrap: "h-[3.5rem] w-[13rem]", img: "h-[11rem] w-[13rem]" },
  lg: { wrap: "h-[4.25rem] w-[14rem]", img: "h-[12rem] w-[14rem]" },
  xl: { wrap: "h-[5.5rem] w-[15rem]", img: "h-[14.5rem] w-[15rem]" },
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
      className={`block shrink-0 overflow-hidden leading-none ${dims.wrap} ${
        centered ? "mx-auto" : ""
      } ${className}`}
    >
      <Image
        src={logoSrc}
        alt="Blocharch"
        width={600}
        height={600}
        priority
        className={`${dims.img} object-cover object-left-top`}
      />
    </span>
  );
}
