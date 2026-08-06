"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ProgressSlider } from "@/components/ProgressSlider";
import { PRIVATE_STAGE_LABELS, PRIVATE_STAGE_ORDER } from "@/lib/private-constants";
import {
  defaultPhaseSplits,
  phaseSplitSum,
  type PhaseSplitMap,
} from "@/lib/private-phase-splits";
import {
  projectTypeSelectValue,
  type PrivateProjectTypeOption,
} from "@/lib/private-project-types";
import type { PrivateDesignStage } from "@prisma/client";

type Athlete = { id: string; fullName: string; athleteCode: string };

type PhaseRow = {
  stage: PrivateDesignStage;
  label: string;
  status: "completed" | "current" | "upcoming";
  feePercent: number;
  costPercent: number;
  feeZar: number;
  costZar: number;
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
  phaseFeePercents: PhaseSplitMap;
  phaseCostPercents: PhaseSplitMap;
  phases: PhaseRow[];
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

function zar(n: number) {
  return `R ${Math.round(n).toLocaleString("en-ZA")}`;
}

function statusLabel(status: PhaseRow["status"]) {
  if (status === "completed") return "Complete";
  if (status === "current") return "Current";
  return "Upcoming";
}

function statusClass(status: PhaseRow["status"]) {
  if (status === "completed") return "bg-emerald-500/15 text-emerald-200 ring-emerald-500/25";
  if (status === "current") return "bg-brand-500/15 text-brand-200 ring-brand-500/30";
  return "bg-white/[0.04] text-slate-400 ring-white/[0.08]";
}

export function PrivateProjectEditClient({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [typeOptions, setTypeOptions] = useState<PrivateProjectTypeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [useManualProgress, setUseManualProgress] = useState(false);
  const [phaseFeePercents, setPhaseFeePercents] = useState<PhaseSplitMap>(defaultPhaseSplits());
  const [phaseCostPercents, setPhaseCostPercents] = useState<PhaseSplitMap>(defaultPhaseSplits());
  const [form, setForm] = useState({
    clientName: "",
    contactEmail: "",
    contactPhone: "",
    projectName: "",
    projectTypeSelect: "residential_extension",
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
    setTypeOptions(typesJson.types || []);
    setUseManualProgress(p.progressIsManual);
    setPhaseFeePercents(p.phaseFeePercents);
    setPhaseCostPercents(p.phaseCostPercents);
    setForm({
      clientName: p.client.name,
      contactEmail: p.client.contactEmail ?? "",
      contactPhone: p.client.contactPhone ?? "",
      projectName: p.name,
      projectTypeSelect: projectTypeSelectValue(p),
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

  const feeTotal = Number(form.feeZar || 0);
  const phaseRows = useMemo(() => {
    const currentIdx = PRIVATE_STAGE_ORDER.indexOf(form.designStage);
    return PRIVATE_STAGE_ORDER.map((stage) => {
      const feePercent = phaseFeePercents[stage];
      const costPercent = phaseCostPercents[stage];
      const stageIdx = PRIVATE_STAGE_ORDER.indexOf(stage);
      let status: PhaseRow["status"] = "upcoming";
      if (stageIdx < currentIdx) status = "completed";
      else if (stageIdx === currentIdx) status = "current";
      return {
        stage,
        label: PRIVATE_STAGE_LABELS[stage],
        status,
        feePercent,
        costPercent,
        feeZar: Math.round((feeTotal * feePercent) / 100),
        costZar: Math.round((feeTotal * costPercent) / 100),
      };
    });
  }, [form.designStage, form.feeZar, phaseFeePercents, phaseCostPercents, feeTotal]);

  const feeSplitSum = phaseSplitSum(phaseFeePercents);
  const costSplitSum = phaseSplitSum(phaseCostPercents);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (useManualProgress) {
      const n = Number(form.manualProgressPercent);
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        setError("Progress must be between 0 and 100.");
        return;
      }
    }
    if (feeSplitSum !== 100) {
      setError(`Fee splits must total 100% (currently ${feeSplitSum}%).`);
      return;
    }
    if (costSplitSum !== 100) {
      setError(`Cost splits must total 100% (currently ${costSplitSum}%).`);
      return;
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
        feeZar: Number(form.feeZar || 0),
        assignedAthleteId: form.assignedAthleteId || null,
        designStage: form.designStage,
        manualProgressPercent: useManualProgress ? Number(form.manualProgressPercent) : null,
        stageNotes: form.stageNotes.trim() || null,
        briefReceivedAt: form.briefReceivedAt || null,
        councilSubmittedAt: form.councilSubmittedAt || null,
        phaseFeePercents,
        phaseCostPercents,
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
    <form onSubmit={(e) => void submit(e)} className="mx-auto max-w-3xl space-y-8">
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
        <Link href="/dashboard/private/project-types" className="text-slate-500 hover:text-slate-300">
          Manage project types
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
              onChange={(e) => setForm({ ...form, projectTypeSelect: e.target.value })}
            >
              {typeOptions.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
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
            />
          </label>
        </div>
      </section>

      <section className="card-tool rounded-xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-white">Project phases</h2>
            <p className="mt-1 text-xs text-slate-500">
              Each design stage with current position, fee split, and cost budget split.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              const defaults = defaultPhaseSplits();
              setPhaseFeePercents(defaults);
              setPhaseCostPercents(defaults);
            }}
            className="rounded-lg bg-white/[0.04] px-3 py-1.5 text-xs text-slate-300 ring-1 ring-white/[0.08] hover:bg-white/[0.07]"
          >
            Reset to duration-weighted splits
          </button>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-wider text-slate-500">
                <th className="pb-2 pr-3 font-semibold">Phase</th>
                <th className="pb-2 pr-3 font-semibold">Status</th>
                <th className="pb-2 pr-3 font-semibold">Fee %</th>
                <th className="pb-2 pr-3 font-semibold">Cost %</th>
                <th className="pb-2 pr-3 font-semibold text-right">Fee</th>
                <th className="pb-2 font-semibold text-right">Cost budget</th>
              </tr>
            </thead>
            <tbody>
              {phaseRows.map((row) => (
                <tr key={row.stage} className="border-b border-white/[0.04]">
                  <td className="py-3 pr-3 text-slate-200">{row.label}</td>
                  <td className="py-3 pr-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ring-1 ${statusClass(row.status)}`}
                    >
                      {statusLabel(row.status)}
                    </span>
                  </td>
                  <td className="py-3 pr-3">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      className="w-16 rounded border border-white/[0.08] bg-white/[0.04] px-2 py-1 text-sm tabular-nums text-white"
                      value={phaseFeePercents[row.stage]}
                      onChange={(e) =>
                        setPhaseFeePercents((prev) => ({
                          ...prev,
                          [row.stage]: Number(e.target.value) || 0,
                        }))
                      }
                    />
                  </td>
                  <td className="py-3 pr-3">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      className="w-16 rounded border border-white/[0.08] bg-white/[0.04] px-2 py-1 text-sm tabular-nums text-white"
                      value={phaseCostPercents[row.stage]}
                      onChange={(e) =>
                        setPhaseCostPercents((prev) => ({
                          ...prev,
                          [row.stage]: Number(e.target.value) || 0,
                        }))
                      }
                    />
                  </td>
                  <td className="py-3 pr-3 text-right tabular-nums text-slate-400">{zar(row.feeZar)}</td>
                  <td className="py-3 text-right tabular-nums text-slate-400">{zar(row.costZar)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Fee splits total {feeSplitSum}% · Cost splits total {costSplitSum}%
          {feeSplitSum !== 100 || costSplitSum !== 100 ? (
            <span className="text-amber-300"> — each must total 100% before saving</span>
          ) : null}
        </p>
      </section>

      <section className="card-tool rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white">Progress & assignment</h2>
        <div className="mt-4 space-y-3">
          <label className="block text-xs text-slate-400">
            Current design stage
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
