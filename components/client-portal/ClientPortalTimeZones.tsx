"use client";

import { useEffect, useState } from "react";
import { readPortalClocks, type PortalClockReadout } from "@/lib/client-portal-clocks";

function FlagFrame({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-11 w-11 shrink-0 overflow-hidden rounded-full border border-white/[0.14] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.25)]">
      {children}
    </span>
  );
}

function SouthAfricaFlag() {
  return (
    <FlagFrame>
      <svg viewBox="0 0 512 512" className="h-full w-full" aria-hidden>
        <defs>
          <clipPath id="portal-za-flag">
            <path d="M70.1 0h499.6v499.6H70.1z" />
          </clipPath>
        </defs>
        <g clipPath="url(#portal-za-flag)" transform="translate(-71.9) scale(1.0248)">
          <g fillRule="evenodd">
            <path fill="#000001" d="M0 397.9v-296l220.4 147.9z" />
            <path fill="#000c8a" d="m150.4 499.7 247.4-166.5h351.6v166.5z" />
            <path fill="#e1392d" d="M134.5 0h615v166.6H397.7S137.8-1.6 134.5 0" />
            <path fill="#ffb915" d="M0 62.5v39.3l220.4 148L0 397.8v39.4l277.6-187.4z" />
            <path fill="#007847" d="M0 62.5V0h92.6l294 199h362.8v101.7H386.6l-294 198.9H0v-62.4l277.6-187.4z" />
            <path fill="#fff" d="M92.6 0h57.8l247.4 166.6h351.6V199H386.6zm0 499.7h57.8l247.4-166.5h351.6v-32.4H386.6z" />
          </g>
        </g>
      </svg>
    </FlagFrame>
  );
}

function UnitedKingdomFlag() {
  return (
    <FlagFrame>
      <svg viewBox="0 0 512 512" className="h-full w-full" aria-hidden>
        <path fill="#012169" d="M0 0h512v512H0z" />
        <path fill="#FFF" d="M512 0v64L322 256l190 187v69h-67L254 324 68 512H0v-68l186-187L0 74V0h62l192 188L440 0z" />
        <path fill="#C8102E" d="m184 324 11 34L42 512H0v-3zm124-12 54 8 150 147v45zM512 0 320 196l-4-44L466 0zM0 1l193 189-59-8L0 49z" />
        <path fill="#FFF" d="M176 0v512h160V0zM0 176v160h512V176z" />
        <path fill="#C8102E" d="M0 208v96h512v-96zM208 0v512h96V0z" />
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
