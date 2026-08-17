"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PRIVATE_STAGE_LABELS, PRIVATE_STAGE_ORDER } from "@/lib/private-constants";
import type { PrivateProjectTypeOption } from "@/lib/private-project-types";
import type { PrivateDesignStage } from "@prisma/client";

type Athlete = { id: string; fullName: string; athleteCode: string };
type ExistingClient = { id: string; name: string };

export function PrivateOnboardingClient({ initialClientId = "" }: { initialClientId?: string }) {
  const router = useRouter();
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [clients, setClients] = useState<ExistingClient[]>([]);
  const [typeOptions, setTypeOptions] = useState<PrivateProjectTypeOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    clientId: initialClientId,
    clientName: "",
    contactEmail: "",
    contactPhone: "",
    projectAddress: "",
    projectTypeSelect: "residential_extension",
    feeZar: "",
    assignedAthleteId: "",
    designStage: "site_measure_up" as PrivateDesignStage,
    clientDescription: "",
    dueDate: "",
  });

  useEffect(() => {
    void Promise.all([
      fetch("/api/private/athletes").then((r) => r.json()),
      fetch("/api/private/project-types").then((r) => r.json()),
      fetch("/api/private/clients").then((r) => r.json()),
    ]).then(([athletesJson, typesJson, clientsJson]) => {
      setAthletes(athletesJson.athletes || []);
      if (typesJson.types) setTypeOptions(typesJson.types);
      setClients(
        (clientsJson.clients || []).map((c: ExistingClient) => ({ id: c.id, name: c.name })),
      );
    });
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.projectTypeSelect) {
      setError("Select a project type.");
      return;
    }
    if (!form.clientId && !form.clientName.trim()) {
      setError("Select an existing client or enter a new client name.");
      return;
    }
    setSaving(true);
    setError("");
    const r = await fetch("/api/private/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: form.clientId || undefined,
        clientName: form.clientName,
        contactEmail: form.contactEmail || null,
        contactPhone: form.contactPhone || null,
        projectAddress: form.projectAddress,
        name: form.projectAddress,
        projectType: form.projectTypeSelect,
        feeZar: Number(form.feeZar || 0),
        assignedAthleteId: form.assignedAthleteId || null,
        designStage: form.designStage,
        clientDescription: form.clientDescription.trim() || null,
        dueDate: form.dueDate || null,
      }),
    });
    const j = await r.json();
    setSaving(false);
    if (!r.ok) {
      setError(j.error || "Could not create");
      return;
    }
    router.push(`/dashboard/private/projects/${j.project.id}`);
  }

  const field =
    "mt-1 w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white";
  const existingClient = Boolean(form.clientId);

  return (
    <form onSubmit={(e) => void submit(e)} className="mx-auto max-w-xl space-y-8">
      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      <section className="card-tool rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white">Client</h2>
        <div className="mt-4 space-y-3">
          <label className="block text-xs text-slate-400">
            Existing client
            <select
              className={field}
              value={form.clientId}
              onChange={(e) => setForm({ ...form, clientId: e.target.value })}
            >
              <option value="">Create a new client</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          {!existingClient ? (
            <>
              <label className="block text-xs text-slate-400">
                Client name
                <input
                  required
                  className={field}
                  value={form.clientName}
                  onChange={(e) => setForm({ ...form, clientName: e.target.value })}
                  placeholder="Simon & Meghan Whitfield"
                />
              </label>
              <label className="block text-xs text-slate-400">
                Contact email
                <input
                  type="email"
                  className={field}
                  value={form.contactEmail}
                  onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
                />
              </label>
              <label className="block text-xs text-slate-400">
                Contact phone
                <input
                  className={field}
                  value={form.contactPhone}
                  onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
                />
              </label>
            </>
          ) : (
            <p className="text-xs text-slate-500">
              Using the selected client.{" "}
              <Link href="/dashboard/private/clients" className="text-brand-300 hover:underline">
                Manage clients
              </Link>
            </p>
          )}
        </div>
      </section>

      <section className="card-tool rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white">Project details</h2>
        <div className="mt-4 space-y-3">
          <label className="block text-xs text-slate-400">
            Project address
            <input
              required
              className={field}
              value={form.projectAddress}
              onChange={(e) => setForm({ ...form, projectAddress: e.target.value })}
              placeholder="47A Kloof Road, Fresnaye"
            />
          </label>
          <label className="block text-xs text-slate-400">
            Client-facing description
            <textarea
              rows={3}
              className={field}
              value={form.clientDescription}
              onChange={(e) => setForm({ ...form, clientDescription: e.target.value })}
              placeholder="Shown on the client portal only if you fill this in."
            />
          </label>
          <label className="block text-xs text-slate-400">
            Project type
            <select
              className={field}
              value={form.projectTypeSelect}
              onChange={(e) => setForm({ ...form, projectTypeSelect: e.target.value })}
            >
              {typeOptions.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <p className="text-[11px] text-slate-500">
            <Link href="/dashboard/private/project-types" className="text-brand-300 hover:underline">
              Manage project types
            </Link>
          </p>
          <label className="block text-xs text-slate-400">
            Fee (excl VAT)
            <input
              required
              type="number"
              min={0}
              step={1000}
              className={field}
              value={form.feeZar}
              onChange={(e) => setForm({ ...form, feeZar: e.target.value })}
              placeholder="420000"
            />
          </label>
          <label className="block text-xs text-slate-400">
            Assigned athlete
            <select
              className={field}
              value={form.assignedAthleteId}
              onChange={(e) => setForm({ ...form, assignedAthleteId: e.target.value })}
            >
              <option value="">Select athlete</option>
              {athletes.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.fullName}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs text-slate-400">
            Target completion
            <input
              type="date"
              className={field}
              value={form.dueDate}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
            />
          </label>
        </div>
      </section>

      <section className="card-tool rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white">Starting phase</h2>
        <label className="mt-4 block text-xs text-slate-400">
          Design phase
          <select
            className={field}
            value={form.designStage}
            onChange={(e) =>
              setForm({ ...form, designStage: e.target.value as PrivateDesignStage })
            }
          >
            {PRIVATE_STAGE_ORDER.map((k) => (
              <option key={k} value={k}>
                {PRIVATE_STAGE_LABELS[k]}
              </option>
            ))}
          </select>
        </label>
      </section>

      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-lg bg-brand-500 px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-brand-400 disabled:opacity-60"
      >
        {saving ? "Creating…" : existingClient ? "Create project" : "Create client & project"}
      </button>
    </form>
  );
}
