/** True when this deployment is the isolated demo environment (demo.blocharch.com). */
export function isDemoMode(): boolean {
  const flag =
    process.env.NEXT_PUBLIC_BLOCHARCH_DEMO_MODE ||
    process.env.BLOCHARCH_DEMO_MODE ||
    "";
  const normalized = flag.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}
