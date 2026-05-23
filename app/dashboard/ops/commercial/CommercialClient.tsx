"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type LedgerRow = {
  athleteName: string;
  athleteCode: string;
  clientName: string;
  hoursWorked: number;
  revenueGbp: number;
  athleteCostGbp: number;
  marginGbp: number;
  marginPercent: number;
};

type CommercialData = {
  month: string;
  reportingRate: number;
  totalRevenueGbp: number;
  totalCostGbp: number;
  grossMarginGbp: number;
  grossMarginPercent: number;
  rows: LedgerRow[];
};

type ExchangeRate = {
  id: string;
  effectiveMonth: string;
  gbpToZarRate: number;
  rateType: "live" | "reporting";
  activeFlag: boolean;
};

type AdminSubmission = {
  id: string;
  athleteName: string;
  athleteCode: string;
  submissionDate: string;
  totalHours: number;
  lockedAt: string | null;
};

function currentMonth(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function CommercialClient() {
  const [month, setMonth] = useState(currentMonth());
  const [ledger, setLedger] = useState<CommercialData | null>(null);
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [submissions, setSubmissions] = useState<AdminSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [rateForm, setRateForm] = useState({ effectiveMonth: currentMonth(), gbpToZarRate: "24", rateType: "reporting" });
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [cr, rr, sr] = await Promise.all([
      fetch(`/api/ops/commercial?month=${month}`),
      fetch("/api/ops/exchange-rates"),
      fetch("/api/ops/submissions"),
    ]);
    const cj = await cr.json();
    const rj = await rr.json();
    const sj = await sr.json();
    if (cr.ok) setLedger(cj);
    if (rr.ok) setRates(rj.rates || []);
    if (sr.ok) setSubmissions(sj.submissions || []);
    setLoading(false);
  }, [month]);

  useEffect(() => {
    void load();
  }, [load]);

  const liveRate = useMemo(
    () => rates.find((r) => r.rateType === "live" && r.activeFlag && r.effectiveMonth === month),
    [rates, month]
  );
  const reportingRate = useMemo(
    () => rates.find((r) => r.rateType === "reporting" && r.activeFlag && r.effectiveMonth === month),
    [rates, month]
  );

  async function addRate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMsg("");
    const r = await fetch("/api/ops/exchange-rates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        effectiveMonth: rateForm.effectiveMonth,
        gbpToZarRate: Number(rateForm.gbpToZarRate),
        rateType: rateForm.rateType,
      }),
    });
    const j = await r.json();
    if (!r.ok) {
      setError(j.error || "Could not save rate");
      return;
    }
    setMsg("Exchange rate saved.");
    void load();
  }

  async function unlockSubmission(id: string) {
    setError("");
    const r = await fetch(`/api/ops/submissions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ unlock: true }),
    });
    const j = await r.json();
    if (!r.ok) {
      setError(j.error || "Could not unlock");
      return;
    }
    setMsg("Submission unlocked.");
    void load();
  }

  async function lockSubmission(id: string) {
    const r = await fetch(`/api/ops/submissions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lock: true }),
    });
    if (r.ok) void load();
  }

  if (loading && !ledger) return <p className="text-sm text-slate-500">Loading commercial data…</p>;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-slate-400">
          Month
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="mt-1 block rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
          />
        </label>
        {ledger ? (
          <p className="text-xs text-slate-500">
            Reporting rate: £1 = R{ledger.reportingRate.toFixed(2)}
            {liveRate ? ` · Live: R${liveRate.gbpToZarRate}` : ""}
          </p>
        ) : null}
      </div>

      {ledger ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="card-tool rounded-xl p-4">
              <p className="text-[10px] uppercase text-slate-500">Revenue</p>
              <p className="mt-1 text-xl font-semibold text-white">£{ledger.totalRevenueGbp.toLocaleString()}</p>
            </div>
            <div className="card-tool rounded-xl p-4">
              <p className="text-[10px] uppercase text-slate-500">Athlete cost</p>
              <p className="mt-1 text-xl font-semibold text-white">£{ledger.totalCostGbp.toLocaleString()}</p>
            </div>
            <div className="card-tool rounded-xl p-4">
              <p className="text-[10px] uppercase text-slate-500">Gross margin</p>
              <p className="mt-1 text-xl font-semibold text-brand-300">
                £{ledger.grossMarginGbp.toLocaleString()} ({ledger.grossMarginPercent}%)
              </p>
            </div>
          </div>

          <div className="card-tool overflow-x-auto rounded-xl">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-xs uppercase text-slate-500">
                  <th className="px-4 py-3">Athlete</th>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Hours</th>
                  <th className="px-4 py-3">Revenue</th>
                  <th className="px-4 py-3">Cost</th>
                  <th className="px-4 py-3">Margin</th>
                </tr>
              </thead>
              <tbody>
                {ledger.rows.map((row, i) => (
                  <tr key={i} className="border-b border-white/[0.04] text-slate-300">
                    <td className="px-4 py-2">
                      {row.athleteName}
                      <span className="ml-1 text-slate-500">({row.athleteCode})</span>
                    </td>
                    <td className="px-4 py-2">{row.clientName}</td>
                    <td className="px-4 py-2 tabular-nums">{row.hoursWorked}</td>
                    <td className="px-4 py-2 tabular-nums">£{row.revenueGbp.toLocaleString()}</td>
                    <td className="px-4 py-2 tabular-nums">£{row.athleteCostGbp.toLocaleString()}</td>
                    <td className="px-4 py-2 tabular-nums text-brand-300">
                      £{row.marginGbp.toLocaleString()} ({row.marginPercent}%)
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {ledger.rows.length === 0 ? (
              <p className="p-4 text-sm text-slate-500">No submission hours logged for this month yet.</p>
            ) : null}
          </div>
        </>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card-tool rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white">Exchange rates</h2>
          <p className="mt-1 text-xs text-slate-500">
            Reporting rates lock ledger history. Live rates are for reference only.
          </p>
          {reportingRate ? (
            <p className="mt-2 text-sm text-slate-300">
              Active reporting ({month}): £1 = R{reportingRate.gbpToZarRate}
            </p>
          ) : (
            <p className="mt-2 text-sm text-amber-300">No reporting rate set — using default R24.</p>
          )}
          <form onSubmit={addRate} className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-slate-400">
              Month
              <input
                type="month"
                value={rateForm.effectiveMonth}
                onChange={(e) => setRateForm((f) => ({ ...f, effectiveMonth: e.target.value }))}
                className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
              />
            </label>
            <label className="text-xs text-slate-400">
              GBP → ZAR
              <input
                type="number"
                step="0.0001"
                min={1}
                required
                value={rateForm.gbpToZarRate}
                onChange={(e) => setRateForm((f) => ({ ...f, gbpToZarRate: e.target.value }))}
                className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
              />
            </label>
            <label className="text-xs text-slate-400 sm:col-span-2">
              Type
              <select
                value={rateForm.rateType}
                onChange={(e) => setRateForm((f) => ({ ...f, rateType: e.target.value }))}
                className="select-console mt-1 block w-full rounded-md px-3 py-2 text-sm"
              >
                <option value="reporting">Reporting (ledger)</option>
                <option value="live">Live (reference)</option>
              </select>
            </label>
            <button
              type="submit"
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-brand-500 sm:col-span-2"
            >
              Set rate
            </button>
          </form>
          <ul className="mt-4 max-h-40 space-y-1 overflow-y-auto text-xs text-slate-400">
            {rates.slice(0, 12).map((r) => (
              <li key={r.id}>
                {r.effectiveMonth} · {r.rateType} · R{r.gbpToZarRate}
                {r.activeFlag ? " · active" : ""}
              </li>
            ))}
          </ul>
        </div>

        <div className="card-tool rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white">Submission locks</h2>
          <p className="mt-1 text-xs text-slate-500">Unlock to let athletes edit past daily logs.</p>
          <ul className="mt-4 max-h-80 space-y-2 overflow-y-auto">
            {submissions.slice(0, 20).map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/[0.03] px-3 py-2 text-sm"
              >
                <span className="text-slate-300">
                  {s.submissionDate} · {s.athleteName} · {s.totalHours}h
                </span>
                {s.lockedAt ? (
                  <button
                    type="button"
                    onClick={() => void unlockSubmission(s.id)}
                    className="text-xs text-brand-300 hover:text-brand-200"
                  >
                    Unlock
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void lockSubmission(s.id)}
                    className="text-xs text-slate-500 hover:text-slate-300"
                  >
                    Lock
                  </button>
                )}
              </li>
            ))}
          </ul>
          {submissions.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">No submissions yet.</p>
          ) : null}
        </div>
      </div>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {msg ? <p className="text-sm text-brand-300">{msg}</p> : null}
    </div>
  );
}
