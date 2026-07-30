"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  PRIVATE_PROJECT_TYPE_LABELS,
  PRIVATE_STAGE_LABELS,
  PRIVATE_STAGE_ORDER,
} from "@/lib/private-constants";
import type { PrivateProjectType, PrivateDesignStage } from "@prisma/client";

type Athlete = { id: string; fullName: string; athleteCode: string };

export function PrivateOnboardingClient() {
  const router = useRouter();
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    clientName: "",
    contactEmail: "",
    contactPhone: "",
    projectAddress: "",
    projectType: "residential_extension" as PrivateProjectType,
    feeZar: "",
    assignedAthleteId: "",
    designStage: "site_measure_up" as PrivateDesignStage,
  });

  useEffect(() => {
    void fetch("/api/private/athletes")
      .then((r) => r.json())
      .then((j) => setAthletes(j.athletes || []));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const r = await fetch("/api/private/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientName: form.clientName,
        contactEmail: form.contactEmail || null,
        contactPhone: form.contactPhone || null,
        projectAddress: form.projectAddress,
        name: form.projectAddress,
        projectType: form.projectType,
        feeZar: Number(form.feeZar || 0),
        assignedAthleteId: form.assignedAthleteId || null,
        designStage: form.designStage,
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

  return (
    <form onSubmit={(e) => void submit(e)} className="mx-auto max-w-xl space-y-8">
      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      <section className="card-tool rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white">Client details</h2>
        <div className="mt-4 space-y-3">
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
            Project type
            <select
              className={field}
              value={form.projectType}
              onChange={(e) =>
                setForm({ ...form, projectType: e.target.value as PrivateProjectType })
              }
            >
              {(Object.keys(PRIVATE_PROJECT_TYPE_LABELS) as PrivateProjectType[]).map((k) => (
                <option key={k} value={k}>
                  {PRIVATE_PROJECT_TYPE_LABELS[k]}
                </option>
              ))}
            </select>
          </label>
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
        </div>
      </section>

      <section className="card-tool rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white">Starting stage</h2>
        <label className="mt-4 block text-xs text-slate-400">
          Design stage
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
        {saving ? "Creating…" : "Create client & project record"}
      </button>
    </form>
  );
}
