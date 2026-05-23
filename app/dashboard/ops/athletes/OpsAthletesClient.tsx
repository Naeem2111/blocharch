"use client";

import { useCallback, useEffect, useState } from "react";

type AthleteRow = {
  id: string;
  username: string;
  fullName: string;
  athleteCode: string;
  status: string;
  baseMonthlyPayZar: number;
  monthlyHourCap: number;
  projectCount: number;
};

export function OpsAthletesClient() {
  const [athletes, setAthletes] = useState<AthleteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    athleteCode: "",
    username: "",
    password: "",
    email: "",
    blocharchStartDate: new Date().toISOString().slice(0, 10),
  });
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const r = await fetch("/api/ops/athletes");
    const j = await r.json();
    if (r.ok) setAthletes(j.athletes || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createAthlete(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const r = await fetch("/api/ops/athletes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const j = await r.json();
    if (!r.ok) {
      setError(j.error || "Could not create athlete");
      return;
    }
    setOpen(false);
    setForm({
      fullName: "",
      athleteCode: "",
      username: "",
      password: "",
      email: "",
      blocharchStartDate: new Date().toISOString().slice(0, 10),
    });
    await load();
  }

  if (loading) return <p className="text-sm text-slate-500">Loading athletes…</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-400">{athletes.length} athlete(s)</p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-brand-500"
        >
          New athlete
        </button>
      </div>

      {open && (
        <form onSubmit={createAthlete} className="card-tool grid gap-3 rounded-xl p-4 md:grid-cols-2">
          <label className="text-xs text-slate-400">
            Full name
            <input
              required
              value={form.fullName}
              onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
              className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
            />
          </label>
          <label className="text-xs text-slate-400">
            Athlete code
            <input
              required
              value={form.athleteCode}
              onChange={(e) => setForm((f) => ({ ...f, athleteCode: e.target.value.toUpperCase() }))}
              className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
            />
          </label>
          <label className="text-xs text-slate-400">
            Login username
            <input
              required
              value={form.username}
              onChange={(e) => setForm((f) => ({ ...f, username: e.target.value.toLowerCase() }))}
              className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
            />
          </label>
          <label className="text-xs text-slate-400">
            Password
            <input
              required
              type="password"
              minLength={6}
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
            />
          </label>
          <label className="text-xs text-slate-400">
            Email
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
            />
          </label>
          <label className="text-xs text-slate-400">
            Blocharch start date
            <input
              type="date"
              required
              value={form.blocharchStartDate}
              onChange={(e) => setForm((f) => ({ ...f, blocharchStartDate: e.target.value }))}
              className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
            />
          </label>
          {error ? <p className="text-sm text-red-400 md:col-span-2">{error}</p> : null}
          <div className="flex gap-2 md:col-span-2">
            <button type="submit" className="rounded-lg bg-white/[0.08] px-4 py-2 text-sm text-slate-100">
              Create athlete
            </button>
            <button type="button" onClick={() => setOpen(false)} className="text-sm text-slate-500">
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-white/[0.06] bg-white/[0.02] text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-3">Athlete</th>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Username</th>
              <th className="px-4 py-3">Cap</th>
              <th className="px-4 py-3">Projects</th>
            </tr>
          </thead>
          <tbody>
            {athletes.map((a) => (
              <tr key={a.id} className="border-b border-white/[0.04] text-slate-300">
                <td className="px-4 py-3 font-medium text-white">{a.fullName}</td>
                <td className="px-4 py-3">{a.athleteCode}</td>
                <td className="px-4 py-3">{a.username}</td>
                <td className="px-4 py-3">{a.monthlyHourCap}h</td>
                <td className="px-4 py-3">{a.projectCount}</td>
              </tr>
            ))}
            {athletes.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  No athletes yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
