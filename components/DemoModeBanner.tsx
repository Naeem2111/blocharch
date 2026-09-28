import { isDemoMode } from "@/lib/demo-mode";

/** Thin top banner so demo.blocharch.com is never confused with production. */
export function DemoModeBanner() {
  if (!isDemoMode()) return null;
  return (
    <div
      role="status"
      className="sticky top-0 z-[100] border-b border-amber-500/30 bg-amber-500/15 px-3 py-1.5 text-center text-[11px] font-medium tracking-wide text-amber-100"
    >
      Demo environment — sample data only. Not connected to the production database.
    </div>
  );
}
