/** Blocharch brand assets in /public/brand */
export const BLOCHARCH_SITE = "https://www.blocharch.com/" as const;

export const brandAssets = {
  /** Isometric cube logo (PNG) */
  logo: "/brand/blocharch-logo.png",
  /** @deprecated use `logo` — kept for imports expecting `wordmark` */
  wordmark: "/brand/blocharch-logo.png",
  favicon: "/brand/blocharch-logo.png",
} as const;
