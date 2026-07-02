import type { Metadata } from "next";
import { brandAssets } from "@/lib/blocharch-brand";

export const metadata: Metadata = {
  title: "Project tracker — Blocharch",
  description: "Live view of your active projects and open tasks.",
  icons: {
    icon: [{ url: brandAssets.favicon, type: "image/png" }],
  },
};

export default function ClientPortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0b0f14] text-slate-100">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">{children}</div>
    </div>
  );
}
