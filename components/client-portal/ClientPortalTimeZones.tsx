"use client";

import { useEffect, useState } from "react";
import { readPortalClocks, type PortalClockReadout } from "@/lib/client-portal-clocks";

function FlagFrame({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-white/[0.1]">
      {children}
    </span>
  );
}

function SouthAfricaFlag() {
  return (
    <FlagFrame>
      <svg viewBox="0 0 30 20" className="h-full w-full" aria-hidden>
        <rect width="30" height="10" fill="#DE3831" />
        <rect y="10" width="30" height="10" fill="#002395" />
        <polygon fill="#FFFFFF" points="0,0 13.2,10 0,20 0,16.2 8.6,10 0,3.8" />
        <rect x="8.6" y="8" width="21.4" height="4" fill="#FFFFFF" />
        <polygon fill="#FFB612" points="0,2.2 10.4,10 0,17.8" />
        <polygon fill="#007A4D" points="0,3.8 8.6,10 0,16.2" />
        <rect x="8.6" y="9" width="21.4" height="2" fill="#007A4D" />
        <polygon fill="#000000" points="0,5.4 6.6,10 0,14.6" />
      </svg>
    </FlagFrame>
  );
}

function UnitedKingdomFlag() {
  return (
    <FlagFrame>
      <svg viewBox="0 0 60 30" className="h-full w-full" aria-hidden>
        <rect width="60" height="30" fill="#012169" />
        <path d="M0 0 L60 30 M60 0 L0 30" stroke="#FFFFFF" strokeWidth="6" />
        <path d="M0 0 L60 30 M60 0 L0 30" stroke="#C8102E" strokeWidth="2.5" />
        <path d="M30 0 V30 M0 15 H60" stroke="#FFFFFF" strokeWidth="10" />
        <path d="M30 0 V30 M0 15 H60" stroke="#C8102E" strokeWidth="6" />
      </svg>
    </FlagFrame>
  );
}

function ZoneRow({
  flag,
  place,
  time,
  detail,
}: {
  flag: React.ReactNode;
  place: string;
  time: string;
  detail: string;
}) {
  return (
    <div className="client-portal-zone-row flex items-center gap-3 rounded-xl border border-white/[0.08] bg-black/20 px-3 py-2.5">
      {flag}
      <div className="min-w-0">
        <p className="text-[11px] leading-none text-slate-400">{place}</p>
        <p className="mt-1 text-[1.85rem] font-bold leading-none tabular-nums tracking-tight text-white">{time}</p>
        <p className="mt-1 text-[10px] leading-none text-slate-500">{detail}</p>
      </div>
    </div>
  );
}

export function ClientPortalTimeZones() {
  const [clocks, setClocks] = useState<PortalClockReadout | null>(null);

  useEffect(() => {
    const tick = () => setClocks(readPortalClocks(new Date()));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  const southAfricaTime = clocks?.southAfricaTime ?? "––:––";
  const londonTime = clocks?.londonTime ?? "––:––";
  const aheadLabel = clocks?.aheadLabel ?? "Checking the time difference…";

  return (
    <section className="client-portal-card rounded-xl border border-white/[0.08] bg-white/[0.03] p-4" aria-label="Time zones">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Time zones</h2>
        <p className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Live
        </p>
      </div>
      <div className="mt-3 space-y-2">
        <ZoneRow
          flag={<SouthAfricaFlag />}
          place="South Africa"
          time={southAfricaTime}
          detail={clocks ? `SAST · ${clocks.southAfricaOffset}` : "SAST"}
        />
        <ZoneRow
          flag={<UnitedKingdomFlag />}
          place="London, UK"
          time={londonTime}
          detail={clocks ? `${clocks.londonAbbr} · ${clocks.londonOffset}` : "London"}
        />
      </div>
      <p className="client-portal-time-pill mt-3 flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-[13px] font-medium">
        <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <circle cx="12" cy="12" r="8" />
          <path strokeLinecap="round" d="M12 8v4.5l3 1.5" />
        </svg>
        {aheadLabel}
      </p>
      <p className="mt-1.5 text-center text-[10px] text-slate-500">Adjusts with UK daylight saving</p>
    </section>
  );
}
