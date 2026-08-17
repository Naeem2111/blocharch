"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PRIVATE_STAGE_LABELS } from "@/lib/private-constants";
import type { PrivateDesignStage } from "@prisma/client";

type ClientProject = {
  id: string;
  name: string;
  status: string;
  designStage: PrivateDesignStage;
};

type ClientRow = {
  id: string;
  name: string;
  contactEmail: string | null;
  contactPhone: string | null;
  slug: string | null;
  portalEnabled: boolean;
  notes: string | null;
  projectCount: number;
  projects: ClientProject[];
};

const emptyForm = {
  name: "",
  contactEmail: "",
  contactPhone: "",
  notes: "",
};

export function PrivateClientsClient() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState(emptyForm);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const r = await fetch("/api/private/clients");
    const j = await r.json();
    if (!r.ok) {
      setError(j.error || "Could not load clients");
      setLoading(false);
      return;
    }
    setClients(j.clients || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createClient(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setCreating(true);
    setError("");
    const r = await fetch("/api/private/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name.trim(),
        contactEmail: form.contactEmail.trim() || null,
        contactPhone: form.contactPhone.trim() || null,
        notes: form.notes.trim() || null,
      }),
    });
    const j = await r.json();
    setCreating(false);
    if (!r.ok) {
      setError(j.error || "Could not create client");
      return;
    }
    setForm(emptyForm);
    void load();
  }

  function startEdit(c: ClientRow) {
    setEditingId(c.id);
    setEdit({
      name: c.name,
      contactEmail: c.contactEmail ?? "",
      contactPhone: c.contactPhone ?? "",
      notes: c.notes ?? "",
    });
  }

  async function saveEdit(id: string) {
    if (!edit.name.trim()) return;
    setBusyId(id);
    setError("");
    const r = await fetch(`/api/private/clients/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: edit.name.trim(),
        contactEmail: edit.contactEmail.trim() || null,
        contactPhone: edit.contactPhone.trim() || null,
        notes: edit.notes.trim() || null,
      }),
    });
    const j = await r.json();
    setBusyId(null);
    if (!r.ok) {
      setError(j.error || "Could not save client");
      return;
    }
    setEditingId(null);
    void load();
  }

  async function setPortalEnabled(id: string, portalEnabled: boolean) {
    setBusyId(id);
    const r = await fetch(`/api/private/clients/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ portalEnabled }),
    });
    setBusyId(null);
    if (!r.ok) {
      const j = await r.json();
      setError(j.error || "Could not update portal");
      return;
    }
    void load();
  }

  async function regenerateSlug(id: string) {
    if (!confirm("Generate a new portal link? The old link will stop working.")) return;
    setBusyId(id);
    const r = await fetch(`/api/private/clients/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ regenerateSlug: true }),
    });
    setBusyId(null);
    if (!r.ok) {
      const j = await r.json();
      setError(j.error || "Could not refresh link");
      return;
    }
    void load();
  }

  async function copyPortalLink(c: ClientRow) {
    if (!c.slug) return;
    const url = `${window.location.origin}/private/${c.slug}`;
    await navigator.clipboard.writeText(url);
    setCopiedId(c.id);
    window.setTimeout(() => setCopiedId(null), 1500);
  }

  const field =
    "mt-1 w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white";

  if (loading) return <p className="text-sm text-slate-500">Loading clients…</p>;

  return (
    <div className="space-y-8">
      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      <section className="card-tool rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white">Add a private client</h2>
        <p className="mt-1 text-xs text-slate-500">
          Creates the client and their portal link. Attach a project from Onboarding, or from the
          project record.
        </p>
        <form onSubmit={(e) => void createClient(e)} className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block text-xs text-slate-400 sm:col-span-2">
            Client name
            <input
              required
              className={field}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Simon & Meghan Whitfield"
            />
          </label>
          <label className="block text-xs text-slate-400">
            Email
            <input
              type="email"
              className={field}
              value={form.contactEmail}
              onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
            />
          </label>
          <label className="block text-xs text-slate-400">
            Phone
            <input
              className={field}
              value={form.contactPhone}
              onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
            />
          </label>
          <label className="block text-xs text-slate-400 sm:col-span-2">
            Internal notes
            <textarea
              rows={2}
              className={field}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={creating}
              className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-brand-400 disabled:opacity-60"
            >
              {creating ? "Saving…" : "Create client"}
            </button>
          </div>
        </form>
      </section>

      <section className="space-y-4">
        {clients.length === 0 ? (
          <p className="text-sm text-slate-500">No private clients yet.</p>
        ) : (
          clients.map((c) => {
            const busy = busyId === c.id;
            const portalUrl = c.slug ? `/private/${c.slug}` : null;
            return (
              <article key={c.id} className="card-tool rounded-xl p-5">
                {editingId === c.id ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block text-xs text-slate-400 sm:col-span-2">
                      Client name
                      <input
                        className={field}
                        value={edit.name}
                        onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                      />
                    </label>
                    <label className="block text-xs text-slate-400">
                      Email
                      <input
                        type="email"
                        className={field}
                        value={edit.contactEmail}
                        onChange={(e) => setEdit({ ...edit, contactEmail: e.target.value })}
                      />
                    </label>
                    <label className="block text-xs text-slate-400">
                      Phone
                      <input
                        className={field}
                        value={edit.contactPhone}
                        onChange={(e) => setEdit({ ...edit, contactPhone: e.target.value })}
                      />
                    </label>
                    <label className="block text-xs text-slate-400 sm:col-span-2">
                      Internal notes
                      <textarea
                        rows={2}
                        className={field}
                        value={edit.notes}
                        onChange={(e) => setEdit({ ...edit, notes: e.target.value })}
                      />
                    </label>
                    <div className="flex gap-2 sm:col-span-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void saveEdit(c.id)}
                        className="rounded-lg bg-brand-500/20 px-3 py-1.5 text-xs font-medium text-brand-200 ring-1 ring-brand-500/30"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="rounded-lg px-3 py-1.5 text-xs text-slate-400 ring-1 ring-white/[0.08]"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h2 className="text-base font-semibold text-white">{c.name}</h2>
                        <p className="mt-1 text-xs text-slate-500">
                          {[c.contactEmail, c.contactPhone].filter(Boolean).join(" · ") ||
                            "No contact details"}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(c)}
                          className="rounded-lg px-2.5 py-1 text-[11px] text-slate-300 ring-1 ring-white/[0.08] hover:bg-white/[0.04]"
                        >
                          Edit
                        </button>
                        <Link
                          href={`/dashboard/private/onboarding?clientId=${c.id}`}
                          className="rounded-lg px-2.5 py-1 text-[11px] text-brand-200 ring-1 ring-brand-500/30 hover:bg-brand-500/10"
                        >
                          Add project
                        </Link>
                      </div>
                    </div>

                    {c.notes ? (
                      <p className="mt-3 text-xs text-slate-500">{c.notes}</p>
                    ) : null}

                    <div className="mt-4 rounded-lg bg-white/[0.03] p-3 ring-1 ring-white/[0.06]">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                          Client portal
                        </p>
                        <label className="flex items-center gap-2 text-xs text-slate-400">
                          <input
                            type="checkbox"
                            checked={c.portalEnabled}
                            disabled={busy}
                            onChange={(e) => void setPortalEnabled(c.id, e.target.checked)}
                            className="h-3.5 w-3.5 accent-brand-400"
                          />
                          Portal live
                        </label>
                      </div>
                      {portalUrl ? (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <code className="rounded bg-black/30 px-2 py-1 text-[11px] text-slate-300">
                            {portalUrl}
                          </code>
                          <button
                            type="button"
                            onClick={() => void copyPortalLink(c)}
                            className="text-[11px] text-brand-300 hover:underline"
                          >
                            {copiedId === c.id ? "Copied" : "Copy link"}
                          </button>
                          {c.portalEnabled ? (
                            <a
                              href={portalUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[11px] text-brand-300 hover:underline"
                            >
                              Open
                            </a>
                          ) : null}
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void regenerateSlug(c.id)}
                            className="text-[11px] text-slate-500 hover:text-slate-300"
                          >
                            New link
                          </button>
                        </div>
                      ) : (
                        <p className="mt-2 text-xs text-slate-500">No portal slug yet.</p>
                      )}
                    </div>

                    <div className="mt-4">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        Projects ({c.projectCount})
                      </p>
                      {c.projects.length === 0 ? (
                        <p className="mt-2 text-sm text-slate-500">No projects yet.</p>
                      ) : (
                        <ul className="mt-2 space-y-1.5">
                          {c.projects.map((p) => (
                            <li key={p.id}>
                              <Link
                                href={`/dashboard/private/projects/${p.id}`}
                                className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-sm text-slate-300 hover:bg-white/[0.04]"
                              >
                                <span>{p.name}</span>
                                <span className="shrink-0 text-[11px] text-slate-500">
                                  {PRIVATE_STAGE_LABELS[p.designStage] ?? p.designStage}
                                </span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </>
                )}
              </article>
            );
          })
        )}
      </section>
    </div>
  );
}
