"use client";

import { useCallback, useEffect, useState } from "react";
import { ClientAvatar } from "@/components/ops/ClientAvatar";
import { ImageUrlField } from "@/components/ops/ImageUrlField";

type ClientContact = { id?: string; name: string; email: string };

type ClientRow = {
  id: string;
  name: string;
  companyName: string | null;
  software: string | null;
  contacts: ClientContact[];
  phone: string | null;
  country: string | null;
  status: string;
  notes: string | null;
  logoUrl: string | null;
  projectCount: number;
  commercial: {
    pricingTier: string;
    tierPercent: number;
    laneCostGbp: number;
    activeLaneCount: number;
  } | null;
};

const emptyContact = (): ClientContact => ({ name: "", email: "" });

const emptyCreate = {
  name: "",
  companyName: "",
  software: "",
  contacts: [emptyContact()],
  tierPercent: "30",
  laneCostGbp: "2041",
  activeLaneCount: "1",
  logoUrl: "",
};

function ContactFields({
  contacts,
  onChange,
}: {
  contacts: ClientContact[];
  onChange: (next: ClientContact[]) => void;
}) {
  return (
    <div className="space-y-2 md:col-span-2">
      <p className="text-xs font-medium text-slate-400">Contacts</p>
      {contacts.map((row, i) => (
        <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <input
            placeholder="Contact name"
            value={row.name}
            onChange={(e) => {
              const next = [...contacts];
              next[i] = { ...next[i], name: e.target.value };
              onChange(next);
            }}
            className="rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
          />
          <input
            type="email"
            placeholder="Email"
            value={row.email}
            onChange={(e) => {
              const next = [...contacts];
              next[i] = { ...next[i], email: e.target.value };
              onChange(next);
            }}
            className="rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
          />
          {contacts.length > 1 ? (
            <button
              type="button"
              onClick={() => onChange(contacts.filter((_, j) => j !== i))}
              className="text-xs text-slate-500 hover:text-red-300 sm:self-center"
            >
              Remove
            </button>
          ) : (
            <span className="hidden sm:block" />
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...contacts, emptyContact()])}
        className="text-xs text-brand-300 hover:text-brand-200"
      >
        + Add contact
      </button>
    </div>
  );
}

export function OpsClientsClient() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyCreate);
  const [editForm, setEditForm] = useState({
    name: "",
    companyName: "",
    software: "",
    contacts: [emptyContact()],
    phone: "",
    country: "",
    status: "active",
    notes: "",
    tierPercent: "30",
    laneCostGbp: "2041",
    activeLaneCount: "1",
    logoUrl: "",
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

  function contactsPayload(rows: ClientContact[]) {
    return rows
      .filter((c) => c.name.trim() || c.email.trim())
      .map((c) => ({
        name: c.name.trim(),
        email: c.email.trim() || null,
      }));
  }

  async function createClient(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const r = await fetch("/api/ops/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        companyName: form.companyName,
        software: form.software,
        contacts: contactsPayload(form.contacts),
        tierPercent: Number(form.tierPercent),
        laneCostGbp: Number(form.laneCostGbp),
        activeLaneCount: Number(form.activeLaneCount),
        logoUrl: form.logoUrl.trim() || null,
      }),
    });
    const j = await r.json();
    if (!r.ok) {
      setError(j.error || "Could not create client");
      return;
    }
    setOpen(false);
    setForm(emptyCreate);
    setMsg("Client created.");
    await load();
  }

  function startEdit(c: ClientRow) {
    setEditingId(c.id);
    setEditForm({
      name: c.name,
      companyName: c.companyName ?? "",
      software: c.software ?? "",
      contacts:
        c.contacts.length > 0
          ? c.contacts.map((ct) => ({ id: ct.id, name: ct.name, email: ct.email ?? "" }))
          : [emptyContact()],
      phone: c.phone ?? "",
      country: c.country ?? "",
      status: c.status,
      notes: c.notes ?? "",
      tierPercent: String(c.commercial?.tierPercent ?? 30),
      laneCostGbp: String(c.commercial?.laneCostGbp ?? 2041),
      activeLaneCount: String(c.commercial?.activeLaneCount ?? 1),
      logoUrl: c.logoUrl ?? "",
    });
    setError("");
    setMsg("");
  }

  async function saveEdit(id: string) {
    setError("");
    const r = await fetch(`/api/ops/clients/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editForm.name,
        companyName: editForm.companyName,
        software: editForm.software,
        contacts: contactsPayload(editForm.contacts),
        phone: editForm.phone,
        country: editForm.country,
        status: editForm.status,
        notes: editForm.notes,
        tierPercent: Number(editForm.tierPercent),
        laneCostGbp: Number(editForm.laneCostGbp),
        activeLaneCount: Number(editForm.activeLaneCount),
        logoUrl: editForm.logoUrl.trim() || null,
      }),
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

  async function deleteClient(id: string, name: string) {
    if (!window.confirm(`Delete client "${name}" and all linked projects? This cannot be undone.`)) return;
    setError("");
    const r = await fetch(`/api/ops/clients/${id}`, { method: "DELETE" });
    const j = await r.json();
    if (!r.ok) {
      setError(j.error || "Could not delete");
      return;
    }
    setEditingId(null);
    setMsg("Client deleted.");
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
            <input
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
            />
          </label>
          <ImageUrlField
            label="Client logo"
            hint="Paste a direct image link. Shown as a circle in Commercial and client lists."
            displayName={form.name || "New client"}
            value={form.logoUrl}
            onChange={(logoUrl) => setForm((f) => ({ ...f, logoUrl }))}
          />
          <label className="text-xs text-slate-400">
            Company
            <input
              value={form.companyName}
              onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))}
              className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
            />
          </label>
          <label className="text-xs text-slate-400 md:col-span-2">
            Software used
            <input
              value={form.software}
              onChange={(e) => setForm((f) => ({ ...f, software: e.target.value }))}
              placeholder="e.g. Revit, AutoCAD, Rhino"
              className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
            />
          </label>
          <ContactFields
            contacts={form.contacts}
            onChange={(contacts) => setForm((f) => ({ ...f, contacts }))}
          />
          <label className="text-xs text-slate-400">
            Tier % ({form.tierPercent}%)
            <input
              type="range"
              min={25}
              max={40}
              step={1}
              value={form.tierPercent}
              onChange={(e) => setForm((f) => ({ ...f, tierPercent: e.target.value }))}
              className="mt-2 block w-full"
            />
          </label>
          <label className="text-xs text-slate-400">
            Monthly fee per lane (£)
            <input
              type="number"
              min={0}
              value={form.laneCostGbp}
              onChange={(e) => setForm((f) => ({ ...f, laneCostGbp: e.target.value }))}
              className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
            />
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

      <div className="space-y-3">
        {clients.map((c) => (
          <div key={c.id} className="card-tool rounded-xl p-4">
            {editingId === c.id ? (
              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-xs text-slate-400">
                  Name
                  <input
                    value={editForm.name}
                    onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                    className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
                  />
                </label>
                <ImageUrlField
                  label="Client logo"
                  displayName={editForm.name || c.name}
                  value={editForm.logoUrl}
                  onChange={(logoUrl) => setEditForm((f) => ({ ...f, logoUrl }))}
                />
                <label className="text-xs text-slate-400">
                  Status
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}
                    className="select-console mt-1 block w-full rounded-md px-3 py-2 text-sm"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </label>
                <label className="text-xs text-slate-400">
                  Company
                  <input
                    value={editForm.companyName}
                    onChange={(e) => setEditForm((f) => ({ ...f, companyName: e.target.value }))}
                    className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
                  />
                </label>
                <label className="text-xs text-slate-400">
                  Phone
                  <input
                    value={editForm.phone}
                    onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                    className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
                  />
                </label>
                <label className="text-xs text-slate-400 md:col-span-2">
                  Software used
                  <input
                    value={editForm.software}
                    onChange={(e) => setEditForm((f) => ({ ...f, software: e.target.value }))}
                    placeholder="e.g. Revit, AutoCAD, Rhino"
                    className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
                  />
                </label>
                <ContactFields
                  contacts={editForm.contacts}
                  onChange={(contacts) => setEditForm((f) => ({ ...f, contacts }))}
                />
                <label className="text-xs text-slate-400">
                  Tier % ({editForm.tierPercent}%)
                  <input
                    type="range"
                    min={25}
                    max={40}
                    step={1}
                    value={editForm.tierPercent}
                    onChange={(e) => setEditForm((f) => ({ ...f, tierPercent: e.target.value }))}
                    className="mt-2 block w-full"
                  />
                </label>
                <label className="text-xs text-slate-400">
                  Monthly fee / lane (£)
                  <input
                    type="number"
                    min={0}
                    value={editForm.laneCostGbp}
                    onChange={(e) => setEditForm((f) => ({ ...f, laneCostGbp: e.target.value }))}
                    className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
                  />
                </label>
                <label className="text-xs text-slate-400">
                  Lanes
                  <input
                    type="number"
                    min={1}
                    value={editForm.activeLaneCount}
                    onChange={(e) => setEditForm((f) => ({ ...f, activeLaneCount: e.target.value }))}
                    className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
                  />
                </label>
                <label className="text-xs text-slate-400 md:col-span-2">
                  Notes
                  <textarea
                    value={editForm.notes}
                    onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                    rows={2}
                    className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
                  />
                </label>
                <div className="flex gap-2 md:col-span-2">
                  <button
                    type="button"
                    onClick={() => void saveEdit(c.id)}
                    className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-slate-950"
                  >
                    Save
                  </button>
                  <button type="button" onClick={() => setEditingId(null)} className="text-xs text-slate-500">
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteClient(c.id, c.name)}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    Delete client
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex min-w-0 items-start gap-3">
                  <ClientAvatar name={c.name} logoUrl={c.logoUrl} size={40} />
                  <div>
                  <p className="font-medium text-white">{c.name}</p>
                  <p className="text-xs text-slate-500">
                    {c.commercial?.tierPercent ?? 30}% · £
                    {c.commercial?.laneCostGbp.toLocaleString()}/lane · {c.commercial?.activeLaneCount} lane(s) ·{" "}
                    {c.projectCount} project(s)
                  </p>
                  {c.software ? <p className="text-xs text-slate-500">Software: {c.software}</p> : null}
                  {c.contacts.map((ct) => (
                    <p key={ct.id ?? ct.name} className="text-xs text-slate-500">
                      {ct.name}
                      {ct.email ? ` · ${ct.email}` : ""}
                    </p>
                  ))}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => startEdit(c)}
                  className="text-xs text-brand-300 hover:text-brand-200"
                >
                  Edit
                </button>
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
