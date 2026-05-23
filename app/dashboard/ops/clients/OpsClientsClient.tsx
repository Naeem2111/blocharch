"use client";

import { useCallback, useEffect, useState } from "react";

type ClientRow = {
  id: string;
  name: string;
  companyName: string | null;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  country: string | null;
  status: string;
  notes: string | null;
  projectCount: number;
  commercial: { pricingTier: string; laneCostGbp: number; activeLaneCount: number } | null;
};

const emptyCreate = {
  name: "",
  companyName: "",
  contactPerson: "",
  email: "",
  pricingTier: "tier_30",
  activeLaneCount: "1",
};

export function OpsClientsClient() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyCreate);
  const [editForm, setEditForm] = useState({
    name: "",
    companyName: "",
    contactPerson: "",
    email: "",
    phone: "",
    country: "",
    status: "active",
    notes: "",
    pricingTier: "tier_30",
    activeLaneCount: "1",
  });
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

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
      body: JSON.stringify({ ...form, activeLaneCount: Number(form.activeLaneCount) }),
    });
    const j = await r.json();
    if (!r.ok) {
      setError(j.error || "Could not create client");
      return;
    }
    setOpen(false);
    setForm(emptyCreate);
    await load();
  }

  function startEdit(c: ClientRow) {
    setEditingId(c.id);
    setEditForm({
      name: c.name,
      companyName: c.companyName ?? "",
      contactPerson: c.contactPerson ?? "",
      email: c.email ?? "",
      phone: c.phone ?? "",
      country: c.country ?? "",
      status: c.status,
      notes: c.notes ?? "",
      pricingTier: c.commercial?.pricingTier ?? "tier_30",
      activeLaneCount: String(c.commercial?.activeLaneCount ?? 1),
    });
    setError("");
    setMsg("");
  }

  async function saveEdit(id: string) {
    setError("");
    const r = await fetch(`/api/ops/clients/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...editForm, activeLaneCount: Number(editForm.activeLaneCount) }),
    });
    const j = await r.json();
    if (!r.ok) {
      setError(j.error || "Could not save");
      return;
    }
    setEditingId(null);
    setMsg("Client updated.");
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

      {msg ? <p className="text-sm text-brand-300">{msg}</p> : null}

      {open && (
        <form onSubmit={createClient} className="card-tool grid gap-3 rounded-xl p-4 md:grid-cols-2">
          <label className="text-xs text-slate-400">
            Client name
            <input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white" />
          </label>
          <label className="text-xs text-slate-400">
            Company
            <input value={form.companyName} onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))} className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white" />
          </label>
          <label className="text-xs text-slate-400">
            Contact person
            <input value={form.contactPerson} onChange={(e) => setForm((f) => ({ ...f, contactPerson: e.target.value }))} className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white" />
          </label>
          <label className="text-xs text-slate-400">
            Email
            <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white" />
          </label>
          <label className="text-xs text-slate-400">
            Pricing tier
            <select value={form.pricingTier} onChange={(e) => setForm((f) => ({ ...f, pricingTier: e.target.value }))} className="select-console mt-1 block w-full rounded-md px-3 py-2 text-sm">
              <option value="tier_25">25%</option>
              <option value="tier_30">30%</option>
              <option value="tier_35">35%</option>
              <option value="tier_40">40%</option>
            </select>
          </label>
          <label className="text-xs text-slate-400">
            Active lanes
            <input type="number" min={1} max={20} value={form.activeLaneCount} onChange={(e) => setForm((f) => ({ ...f, activeLaneCount: e.target.value }))} className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white" />
          </label>
          {error ? <p className="text-sm text-red-400 md:col-span-2">{error}</p> : null}
          <div className="flex gap-2 md:col-span-2">
            <button type="submit" className="rounded-lg bg-white/[0.08] px-4 py-2 text-sm text-slate-100">Create client</button>
            <button type="button" onClick={() => setOpen(false)} className="text-sm text-slate-500">Cancel</button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        {clients.map((c) => (
          <div key={c.id} className="card-tool rounded-xl p-4">
            {editingId === c.id ? (
              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-xs text-slate-400">
                  Name
                  <input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white" />
                </label>
                <label className="text-xs text-slate-400">
                  Status
                  <select value={editForm.status} onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))} className="select-console mt-1 block w-full rounded-md px-3 py-2 text-sm">
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </label>
                <label className="text-xs text-slate-400">
                  Company
                  <input value={editForm.companyName} onChange={(e) => setEditForm((f) => ({ ...f, companyName: e.target.value }))} className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white" />
                </label>
                <label className="text-xs text-slate-400">
                  Contact
                  <input value={editForm.contactPerson} onChange={(e) => setEditForm((f) => ({ ...f, contactPerson: e.target.value }))} className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white" />
                </label>
                <label className="text-xs text-slate-400">
                  Email
                  <input value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white" />
                </label>
                <label className="text-xs text-slate-400">
                  Phone
                  <input value={editForm.phone} onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))} className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white" />
                </label>
                <label className="text-xs text-slate-400">
                  Tier
                  <select value={editForm.pricingTier} onChange={(e) => setEditForm((f) => ({ ...f, pricingTier: e.target.value }))} className="select-console mt-1 block w-full rounded-md px-3 py-2 text-sm">
                    <option value="tier_25">25%</option>
                    <option value="tier_30">30%</option>
                    <option value="tier_35">35%</option>
                    <option value="tier_40">40%</option>
                  </select>
                </label>
                <label className="text-xs text-slate-400">
                  Lanes
                  <input type="number" min={1} value={editForm.activeLaneCount} onChange={(e) => setEditForm((f) => ({ ...f, activeLaneCount: e.target.value }))} className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white" />
                </label>
                <label className="text-xs text-slate-400 md:col-span-2">
                  Notes
                  <textarea value={editForm.notes} onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))} rows={2} className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white" />
                </label>
                <div className="flex gap-2 md:col-span-2">
                  <button type="button" onClick={() => void saveEdit(c.id)} className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-slate-950">Save</button>
                  <button type="button" onClick={() => setEditingId(null)} className="text-xs text-slate-500">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-white">{c.name}</p>
                  <p className="text-xs text-slate-500">
                    {c.commercial?.pricingTier.replace("tier_", "")}% · £{c.commercial?.laneCostGbp.toLocaleString()} · {c.commercial?.activeLaneCount} lane(s) · {c.projectCount} project(s)
                  </p>
                  {c.email ? <p className="text-xs text-slate-500">{c.email}</p> : null}
                </div>
                <button type="button" onClick={() => startEdit(c)} className="text-xs text-brand-300 hover:text-brand-200">Edit</button>
              </div>
            )}
          </div>
        ))}
        {clients.length === 0 ? <p className="text-sm text-slate-500">No clients yet.</p> : null}
      </div>
      {error && !open ? <p className="text-sm text-red-400">{error}</p> : null}
    </div>
  );
}
