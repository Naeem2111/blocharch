"use client";

import { useEffect, useState } from "react";

type CommercialData = {
  month: string;
  summary: {
    feeRevenueZar: number;
    costZar: number;
    marginZar: number;
    marginPercent: number | null;
    outOfScopeHourlyBilledZar: number;
  };
  utilisation: Array<{
    athleteId: string;
    athleteName: string;
    projectId: string;
    projectName: string;
    hours: number;
    revenueShareZar: number;
    costZar: number;
    marginPercent: number | null;
  }>;
};

function zar(n: number) {
  return `R ${Math.round(n).toLocaleString("en-ZA")}`;
}

function formatMonth(month: string) {
  const [y, m] = month.split("-").map(Number);
  if (!y || !m) return month;
  return new Date(y, m - 1, 1).toLocaleString("en-GB", { month: "long", year: "numeric" });
}

export function PrivateCommercialClient() {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [data, setData] = useState<CommercialData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setData(null);
    void fetch(`/api/private/commercial?month=${encodeURIComponent(month)}`)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "Failed");
        setData(j);
      })
      .catch((e: Error) => setError(e.message));
  }, [month]);

  if (error) return <p className="text-sm text-red-300">{error}</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <label className="block text-xs text-slate-400">
          Month
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="mt-1 block rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
          />
        </label>
        {data ? (
          <p className="pb-2 text-sm text-slate-500">{formatMonth(data.month)}</p>
        ) : null}
      </div>

      {!data ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Fee revenue", value: zar(data.summary.feeRevenueZar), sub: "Recognised this month" },
              { label: "Cost", value: zar(data.summary.costZar), sub: "Athlete cost allocated" },
              {
                label: "Margin",
                value: `${zar(data.summary.marginZar)}${data.summary.marginPercent != null ? ` (${data.summary.marginPercent}%)` : ""}`,
                sub: "Fee minus cost",
              },
              {
                label: "Out-of-scope hourly billed",
                value: zar(data.summary.outOfScopeHourlyBilledZar),
                sub: "Flagged revisits this month",
              },
            ].map((c) => (
              <div key={c.label} className="card-tool rounded-xl p-5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{c.label}</p>
                <p className="mt-2 text-xl font-semibold tabular-nums text-white">{c.value}</p>
                <p className="mt-1 text-xs text-slate-500">{c.sub}</p>
              </div>
            ))}
          </div>

          <section className="card-tool rounded-xl p-5">
            <h2 className="text-sm font-semibold text-white">Athlete utilisation (private projects)</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[40rem] text-left text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-wider text-slate-500">
                    <th className="pb-2 font-semibold">Athlete</th>
                    <th className="pb-2 font-semibold">Project</th>
                    <th className="pb-2 font-semibold">Hours</th>
                    <th className="pb-2 font-semibold">Revenue share</th>
                    <th className="pb-2 font-semibold">Cost</th>
                    <th className="pb-2 font-semibold">Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {data.utilisation.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-4 text-slate-500">
                        No utilisation data for this month.
                      </td>
                    </tr>
                  ) : (
                    data.utilisation.map((row) => (
                      <tr key={`${row.athleteId}-${row.projectId}`} className="border-b border-white/[0.04]">
                        <td className="py-3 text-slate-200">{row.athleteName}</td>
                        <td className="py-3 text-slate-300">{row.projectName}</td>
                        <td className="py-3 tabular-nums text-slate-300">{row.hours}</td>
                        <td className="py-3 tabular-nums text-slate-300">
                          {zar(row.revenueShareZar)} <span className="text-slate-500">(life-to-date)</span>
                        </td>
                        <td className="py-3 tabular-nums text-slate-300">{zar(row.costZar)}</td>
                        <td className="py-3 tabular-nums text-slate-300">
                          {row.marginPercent != null ? `${row.marginPercent}%` : "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
