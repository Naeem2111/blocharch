import type { RecruitmentStatus } from "@prisma/client";
import { recruitmentStatusLabel } from "@/lib/recruitment/constants";

const STATUS_DOT: Record<string, string> = {
  to_review: "#38bdf8",
  potential: "#3b82f6",
  shortlisted: "#22d3ee",
  onboarding: "#a78bfa",
  on_bench: "#fbbf24",
  live_active: "#4ade80",
  archived: "#94a3b8",
};

const AVAILABILITY_DOT: Record<string, string> = {
  full_time: "#4ade80",
  part_time: "#38bdf8",
  after_hours: "#fbbf24",
  unavailable: "#f87171",
  needs_confirmation: "#eab308",
};

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = (parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : parts[0]?.[1] ?? "");
  return letters.toUpperCase() || "•";
}

export function statusDot(status: string): string {
  return STATUS_DOT[status] ?? "#94a3b8";
}

export function availabilityDot(value: string): string {
  return AVAILABILITY_DOT[value] ?? "#94a3b8";
}

export function StatusPill({ status }: { status: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-[#0c1424] px-2.5 py-1 text-xs font-medium text-white">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: statusDot(status) }} />
      {recruitmentStatusLabel(status)}
    </span>
  );
}

export function SoftwarePills({ items }: { items: string[] }) {
  if (items.length === 0) return <span className="text-slate-500">—</span>;
  return (
    <span className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span key={item} className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 text-[11px] text-slate-200">
          {item}
        </span>
      ))}
    </span>
  );
}

export function WhatsAppLink({ href, number }: { href: string | null; number: string | null }) {
  if (!href || !number) return <span className="text-slate-500">{number || "No number"}</span>;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" title="Open WhatsApp" className="inline-flex items-center gap-1.5 font-medium text-emerald-300 hover:text-emerald-200">
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
        <path
          fill="currentColor"
          d="M12.04 2C6.58 2 2.15 6.4 2.15 11.83c0 1.74.46 3.44 1.34 4.94L2 22l5.39-1.41a10.1 10.1 0 0 0 4.65 1.12h.01c5.46 0 9.89-4.4 9.89-9.83C21.94 6.4 17.5 2 12.04 2zm5.76 13.86c-.24.68-1.4 1.3-1.94 1.38-.5.07-1.12.1-1.81-.11-.41-.13-.95-.31-1.63-.61-2.87-1.24-4.74-4.13-4.88-4.32-.14-.19-1.16-1.54-1.16-2.94s.73-2.08 1-2.37c.24-.27.64-.39 1.02-.39.12 0 .23 0 .33.01.29.01.43.03.62.48.24.58.82 2 .89 2.15.07.14.12.32.02.51-.09.19-.14.31-.28.48-.14.17-.29.37-.42.5-.14.14-.28.29-.12.56.16.27.71 1.17 1.53 1.9 1.05.94 1.94 1.23 2.21 1.37.27.14.43.12.59-.07.16-.19.68-.79.86-1.06.18-.27.36-.22.6-.13.24.09 1.54.73 1.8.86.27.13.44.2.51.31.06.11.06.66-.18 1.34z"
        />
      </svg>
      {number}
    </a>
  );
}

export function Avatar({ name }: { name: string }) {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-500 text-xs font-semibold text-white">
      {initials(name)}
    </span>
  );
}

export function experienceText(years: number | null, bandLabel: string): string {
  if (years == null) return bandLabel;
  const rounded = Number.isInteger(years) ? String(years) : years.toFixed(1);
  return `${rounded} year${years === 1 ? "" : "s"}`;
}

export function relativeSync(iso: string | null): string {
  if (!iso) return "Not synced yet";
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.max(0, Math.round(diff / 60000));
  if (minutes < 1) return "Last synced just now";
  if (minutes === 1) return "Last synced 1 minute ago";
  if (minutes < 60) return `Last synced ${minutes} minutes ago`;
  const hours = Math.round(minutes / 60);
  return `Last synced ${hours} hour${hours === 1 ? "" : "s"} ago`;
}

export function isStatus(value: string): value is RecruitmentStatus {
  return value in STATUS_DOT;
}
