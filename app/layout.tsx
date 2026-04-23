import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { brandAssets } from "@/lib/blocharch-brand";
import "./globals.css";
import "leaflet/dist/leaflet.css";

const sans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Blocharch Console",
  description: "Directory, map, and lead tools — Blocharch internal console.",
  icons: {
    icon: [
      { url: brandAssets.favicon, type: "image/png", sizes: "100x100" },
      { url: brandAssets.favicon, type: "image/png", sizes: "32x32" },
    ],
    apple: brandAssets.favicon,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={sans.variable}>
      <body className="font-sans min-h-screen antialiased">{children}</body>
    </html>
  );
}
