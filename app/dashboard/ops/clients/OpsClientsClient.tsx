"use client";

import { useCallback, useEffect, useState } from "react";

type ClientRow = {
  id: string;
  name: string;
  companyName: string | null;
  status: string;
  projectCount: number;
  commercial: { pricingTier: string; laneCostGbp: number; activeLaneCount: number } | null;
};

export function OpsClientsClient() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    companyName: "",
    contactPerson: "",
    email: "",
    pricingTier: "tier_30",
    activeLaneCount: "1",
  });
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const r = await fetch("/api/ops/clients");
    const j = await r.json();
    if (r.ok) setClients(j.clients || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createClient(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const r = await fetch("/api/ops/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        activeLaneCount: Number(form.activeLaneCount),
      }),
    });
    const j = await r.json();
    if (!r.ok) {
      setError(j.error || "Could not create client");
      return;
    }
    setOpen(false);
    setForm({ name: "", companyName: "", contactPerson: "", email: "", pricingTier: "tier_30", activeLaneCount: "1" });
    await load();
  }

  if (loading) return <p className="text-sm text-slate-500">Loading clients…</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-400">{clients.length} client(s)</p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-brand-500"
        >
          New client
        </button>
      </div>

      {open && (
        <form onSubmit={createClient} className="card-tool grid gap-3 rounded-xl p-4 md:grid-cols-2">
          <label className="text-xs text-slate-400">
            Client name
            <input
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
            />
          </label>
          <label className="text-xs text-slate-400">
            Company
            <input
              value={form.companyName}
              onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))}
              className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
            />
          </label>
          <label className="text-xs text-slate-400">
            Contact person
            <input
              value={form.contactPerson}
              onChange={(e) => setForm((f) => ({ ...f, contactPerson: e.target.value }))}
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
            Pricing tier
            <select
              value={form.pricingTier}
              onChange={(e) => setForm((f) => ({ ...f, pricingTier: e.target.value }))}
              className="select-console mt-1 block w-full rounded-md px-3 py-2 text-sm"
            >
              <option value="tier_25">25% — £2,187</option>
              <option value="tier_30">30% — £2,041</option>
              <option value="tier_35">35% — £1,895</option>
              <option value="tier_40">40% — £1,750</option>
            </select>
          </label>
          <label className="text-xs text-slate-400">
            Active lanes
            <input
              type="number"
              min={1}
              max={20}
              value={form.activeLaneCount}
              onChange={(e) => setForm((f) => ({ ...f, activeLaneCount: e.target.value }))}
              className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
            />
          </label>
          {error ? <p className="text-sm text-red-400 md:col-span-2">{error}</p> : null}
          <div className="flex gap-2 md:col-span-2">
            <button type="submit" className="rounded-lg bg-white/[0.08] px-4 py-2 text-sm text-slate-100">
              Create client
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
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Tier</th>
              <th className="px-4 py-3">Lane cost</th>
              <th className="px-4 py-3">Lanes</th>
              <th className="px-4 py-3">Projects</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => (
              <tr key={c.id} className="border-b border-white/[0.04] text-slate-300">
                <td className="px-4 py-3">
                  <p className="font-medium text-white">{c.name}</p>
                  {c.companyName ? <p className="text-xs text-slate-500">{c.companyName}</p> : null}
                </td>
                <td className="px-4 py-3">{c.commercial?.pricingTier.replace("tier_", "")}%</td>
                <td className="px-4 py-3">£{c.commercial?.laneCostGbp.toLocaleString()}</td>
                <td className="px-4 py-3">{c.commercial?.activeLaneCount ?? "—"}</td>
                <td className="px-4 py-3">{c.projectCount}</td>
              </tr>
            ))}
            {clients.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  No clients yet. Create one to assign projects.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
