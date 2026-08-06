"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ProgressSlider } from "@/components/ProgressSlider";
import { PRIVATE_STAGE_LABELS, PRIVATE_STAGE_ORDER } from "@/lib/private-constants";
import type { PrivateDesignStage } from "@prisma/client";

type Athlete = { id: string; fullName: string; athleteCode: string };
type CustomProjectType = { id: string; label: string };
type ProjectTypeOptions = {
  builtIn: Array<{ key: string; label: string }>;
  customTypes: CustomProjectType[];
};

type ProjectPayload = {
  id: string;
  name: string;
  address: string | null;
  projectType: string;
  customProjectTypeId: string | null;
  designStage: string;
  designStageLabel: string;
  progressPercent: number;
  calculatedProgressPercent: number;
  manualProgressPercent: number | null;
  progressIsManual: boolean;
  feeZar: number;
  costZar: number;
  stageNotes: string | null;
  briefReceivedAt: string | null;
  councilSubmittedAt: string | null;
  client: {
    id: string;
    name: string;
    contactEmail: string | null;
    contactPhone: string | null;
  };
  athlete: { id: string; fullName: string } | null;
};

function projectTypeSelectValue(project: ProjectPayload): string {
  if (project.projectType === "other" && project.customProjectTypeId) {
    return `custom:${project.customProjectTypeId}`;
  }
  if (project.projectType === "other") return "other";
  return project.projectType;
}

export function PrivateProjectEditClient({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [typeOptions, setTypeOptions] = useState<ProjectTypeOptions>({
    builtIn: [],
    customTypes: [],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [useManualProgress, setUseManualProgress] = useState(false);
  const [form, setForm] = useState({
    clientName: "",
    contactEmail: "",
    contactPhone: "",
    projectName: "",
    projectTypeSelect: "residential_extension",
    customTypeLabel: "",
    feeZar: "",
    assignedAthleteId: "",
    designStage: "site_measure_up" as PrivateDesignStage,
    manualProgressPercent: "",
    stageNotes: "",
    briefReceivedAt: "",
    councilSubmittedAt: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const [projectRes, athletesRes, typesRes] = await Promise.all([
      fetch(`/api/private/projects/${projectId}`),
      fetch("/api/private/athletes"),
      fetch("/api/private/project-types"),
    ]);
    const projectJson = await projectRes.json();
    const athletesJson = await athletesRes.json();
    const typesJson = await typesRes.json();

    if (!projectRes.ok) {
      setError(projectJson.error || "Project not found");
      setLoading(false);
      return;
    }

    const p = projectJson.project as ProjectPayload;
    setAthletes(athletesJson.athletes || []);
    if (typesJson.builtIn) {
      setTypeOptions({
        builtIn: typesJson.builtIn,
        customTypes: typesJson.customTypes || [],
      });
    }
    setUseManualProgress(p.progressIsManual);
    setForm({
      clientName: p.client.name,
      contactEmail: p.client.contactEmail ?? "",
      contactPhone: p.client.contactPhone ?? "",
      projectName: p.name,
      projectTypeSelect: projectTypeSelectValue(p),
      customTypeLabel: "",
      feeZar: String(p.feeZar),
      assignedAthleteId: p.athlete?.id ?? "",
      designStage: p.designStage as PrivateDesignStage,
      manualProgressPercent:
        p.manualProgressPercent != null ? String(p.manualProgressPercent) : String(p.calculatedProgressPercent),
      stageNotes: p.stageNotes ?? "",
      briefReceivedAt: p.briefReceivedAt ?? "",
      councilSubmittedAt: p.councilSubmittedAt ?? "",
    });
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (form.projectTypeSelect === "other" && !form.customTypeLabel.trim()) {
      setError("Enter a label for this project type.");
      return;
    }
    if (useManualProgress) {
      const n = Number(form.manualProgressPercent);
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        setError("Progress must be between 0 and 100.");
        return;
      }
    }

    setSaving(true);
    setError("");
    const r = await fetch(`/api/private/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientName: form.clientName.trim(),
        clientContactEmail: form.contactEmail.trim() || null,
        clientContactPhone: form.contactPhone.trim() || null,
        name: form.projectName.trim(),
        projectType: form.projectTypeSelect,
        customProjectTypeLabel:
          form.projectTypeSelect === "other" ? form.customTypeLabel.trim() : null,
        feeZar: Number(form.feeZar || 0),
        assignedAthleteId: form.assignedAthleteId || null,
        designStage: form.designStage,
        manualProgressPercent: useManualProgress ? Number(form.manualProgressPercent) : null,
        stageNotes: form.stageNotes.trim() || null,
        briefReceivedAt: form.briefReceivedAt || null,
        councilSubmittedAt: form.councilSubmittedAt || null,
      }),
    });
    const j = await r.json();
    setSaving(false);
    if (!r.ok) {
      setError(j.error || "Could not save");
      return;
    }
    router.push(`/dashboard/private/projects/${projectId}`);
  }

  const field =
    "mt-1 w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white";

  if (loading) return <p className="text-sm text-slate-500">Loading project…</p>;
  if (error && !form.clientName) return <p className="text-sm text-red-300">{error}</p>;

  return (
    <form onSubmit={(e) => void submit(e)} className="mx-auto max-w-2xl space-y-8">
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <Link href="/dashboard/private/projects" className="text-slate-500 hover:text-slate-300">
          ← Projects
        </Link>
        <Link
          href={`/dashboard/private/projects/${projectId}`}
          className="text-brand-300 hover:underline"
        >
          View project
        </Link>
      </div>

      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      <section className="card-tool rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white">Client</h2>
        <div className="mt-4 space-y-3">
          <label className="block text-xs text-slate-400">
            Client name
            <input
              required
              className={field}
              value={form.clientName}
              onChange={(e) => setForm({ ...form, clientName: e.target.value })}
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
        <h2 className="text-sm font-semibold text-white">Project</h2>
        <div className="mt-4 space-y-3">
          <label className="block text-xs text-slate-400">
            Project name / address
            <input
              required
              className={field}
              value={form.projectName}
              onChange={(e) => setForm({ ...form, projectName: e.target.value })}
            />
          </label>
          <label className="block text-xs text-slate-400">
            Project type
            <select
              className={field}
              value={form.projectTypeSelect}
              onChange={(e) =>
                setForm({
                  ...form,
                  projectTypeSelect: e.target.value,
                  customTypeLabel: e.target.value === "other" ? form.customTypeLabel : "",
                })
              }
            >
              {typeOptions.builtIn.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
              {typeOptions.customTypes.length > 0 ? (
                <optgroup label="Saved types">
                  {typeOptions.customTypes.map((t) => (
                    <option key={t.id} value={`custom:${t.id}`}>
                      {t.label}
                    </option>
                  ))}
                </optgroup>
              ) : null}
              <option value="other">Other (specify new)</option>
            </select>
          </label>
          {form.projectTypeSelect === "other" ? (
            <label className="block text-xs text-slate-400">
              New project type label
              <input
                required
                className={field}
                value={form.customTypeLabel}
                onChange={(e) => setForm({ ...form, customTypeLabel: e.target.value })}
                placeholder="e.g. Pool house, Renovation"
              />
            </label>
          ) : null}
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
            />
          </label>
        </div>
      </section>

      <section className="card-tool rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white">Progress & assignment</h2>
        <div className="mt-4 space-y-3">
          <label className="block text-xs text-slate-400">
            Design stage
            <select
              className={field}
              value={form.designStage}
              onChange={(e) =>
                setForm({ ...form, designStage: e.target.value as PrivateDesignStage })
              }
            >
              {PRIVATE_STAGE_ORDER.map((key) => (
                <option key={key} value={key}>
                  {PRIVATE_STAGE_LABELS[key]}
                </option>
              ))}
            </select>
          </label>
          <div className="rounded-lg bg-white/[0.03] p-3 ring-1 ring-white/[0.06]">
            <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={useManualProgress}
                onChange={(e) => setUseManualProgress(e.target.checked)}
                className="rounded border-white/20 bg-transparent accent-brand-400"
              />
              Override calculated progress with a manual percentage
            </label>
            {useManualProgress ? (
              <div className="mt-3">
                <ProgressSlider
                  value={Number(form.manualProgressPercent) || 0}
                  onChange={(v) => {
                    setUseManualProgress(true);
                    setForm({ ...form, manualProgressPercent: String(v) });
                  }}
                  label="Progress complete"
                />
              </div>
            ) : (
              <p className="mt-2 text-xs text-slate-500">
                Progress is calculated from design stage and time in stage.
              </p>
            )}
          </div>
          <label className="block text-xs text-slate-400">
            Assigned athlete
            <select
              className={field}
              value={form.assignedAthleteId}
              onChange={(e) => setForm({ ...form, assignedAthleteId: e.target.value })}
            >
              <option value="">Unassigned</option>
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
        <h2 className="text-sm font-semibold text-white">Notes & dates</h2>
        <div className="mt-4 space-y-3">
          <label className="block text-xs text-slate-400">
            Stage notes
            <textarea
              rows={3}
              className={field}
              value={form.stageNotes}
              onChange={(e) => setForm({ ...form, stageNotes: e.target.value })}
            />
          </label>
          <label className="block text-xs text-slate-400">
            Brief received
            <input
              type="date"
              className={field}
              value={form.briefReceivedAt}
              onChange={(e) => setForm({ ...form, briefReceivedAt: e.target.value })}
            />
          </label>
          <label className="block text-xs text-slate-400">
            Council submitted
            <input
              type="date"
              className={field}
              value={form.councilSubmittedAt}
              onChange={(e) => setForm({ ...form, councilSubmittedAt: e.target.value })}
            />
          </label>
        </div>
      </section>

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-brand-400 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
        <Link
          href={`/dashboard/private/projects/${projectId}`}
          className="rounded-lg px-4 py-2.5 text-sm text-slate-400 ring-1 ring-white/[0.08] hover:text-slate-200"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
