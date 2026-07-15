/** Blocharch brand assets in /public/brand */
export const BLOCHARCH_SITE = "https://www.blocharch.com/" as const;

export const brandAssets = {
  /** Wordmark + cube mark (PNG) */
  logo: "/brand/blocharch-logo.png",
  /** Client portal wordmark (light theme) */
  clientLogo: "/brand/blocharch-logo-client.png",
  /** Client portal wordmark (dark theme) */
  clientLogoDark: "/brand/blocharch-logo-dark.png",
  /** Isometric cube favicon */
  favicon: "/brand/favicon-192.png",
  /** @deprecated use `logo` — kept for imports expecting `wordmark` */
  wordmark: "/brand/blocharch-logo.png",
} as const;
