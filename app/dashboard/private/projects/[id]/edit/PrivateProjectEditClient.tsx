"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ProgressSlider } from "@/components/ProgressSlider";
import { PRIVATE_STAGE_LABELS, PRIVATE_STAGE_ORDER } from "@/lib/private-constants";
import {
  buildProjectPhaseBreakdown,
  defaultPhaseSplits,
  phaseSplitSum,
  type PhaseSplitMap,
} from "@/lib/private-phase-splits";
import {
  addPhase,
  assignStageToPhase,
  defaultPhaseStructure,
  removePhase,
  renamePhase,
  type PhaseStructure,
} from "@/lib/private-phase-structure";
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
  phaseStructure: PhaseStructure;
  expensesTotalZar: number;
  unassignedExpenseZar: number;
  expenseRecords?: Array<{ designStage: string | null; amountZar: number }>;
  phaseGroups: Array<{
    id: string;
    name: string;
    feeZar: number;
    costZar: number;
    stages: PhaseRow[];
  }>;
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
  const [phaseStructure, setPhaseStructure] = useState<PhaseStructure>(defaultPhaseStructure());
  const [expenseRecords, setExpenseRecords] = useState<
    Array<{ designStage: string | null; amountZar: number }>
  >([]);
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
    setPhaseStructure(p.phaseStructure);
    setExpenseRecords(p.expenseRecords ?? []);
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
  const { phaseGroups, totalExpenseZar, unassignedExpenseZar } = useMemo(
    () =>
      buildProjectPhaseBreakdown({
        designStage: form.designStage,
        feeZar: feeTotal,
        phaseFeePercents,
        phaseStructure,
        expenses: expenseRecords,
      }),
    [form.designStage, feeTotal, phaseFeePercents, phaseStructure, expenseRecords],
  );

  const feeSplitSum = phaseSplitSum(phaseFeePercents);

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
        phaseStructure,
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
            <h2 className="text-sm font-semibold text-white">Stages & phase billing</h2>
            <p className="mt-1 text-xs text-slate-500">
              Create stages, assign design phases to each stage, and set fee/cost splits per phase.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setPhaseStructure((s) => addPhase(s))}
              className="rounded-lg bg-brand-500/20 px-3 py-1.5 text-xs font-medium text-brand-200 ring-1 ring-brand-500/30"
            >
              Add stage
            </button>
            <button
              type="button"
              onClick={() => setPhaseFeePercents(defaultPhaseSplits())}
              className="rounded-lg bg-white/[0.04] px-3 py-1.5 text-xs text-slate-300 ring-1 ring-white/[0.08] hover:bg-white/[0.07]"
            >
              Reset fee splits
            </button>
          </div>
        </div>

        <div className="mt-4 space-y-5">
          {phaseGroups.map((group) => (
            <div key={group.id} className="rounded-lg bg-white/[0.03] p-4 ring-1 ring-white/[0.06]">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={phaseStructure.phases.find((p) => p.id === group.id)?.name ?? group.name}
                  onChange={(e) =>
                    setPhaseStructure((s) => renamePhase(s, group.id, e.target.value))
                  }
                  className="min-w-[10rem] flex-1 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-sm font-semibold text-white"
                />
                <span className="text-xs tabular-nums text-slate-500">
                  {group.stages.length} phase{group.stages.length === 1 ? "" : "s"} · {zar(group.feeZar)} fee
                </span>
                <button
                  type="button"
                  disabled={group.stages.length > 0 || phaseStructure.phases.length <= 1}
                  onClick={() => {
                    const next = removePhase(phaseStructure, group.id);
                    if (next) setPhaseStructure(next);
                  }}
                  className="rounded px-2 py-0.5 text-[10px] font-medium text-red-300/80 ring-1 ring-red-500/20 hover:bg-red-500/10 disabled:opacity-40"
                >
                  Remove stage
                </button>
              </div>

              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[40rem] text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-wider text-slate-500">
                      <th className="pb-2 pr-3 font-semibold">Phase</th>
                      <th className="pb-2 pr-3 font-semibold">Move to stage</th>
                      <th className="pb-2 pr-3 font-semibold">Status</th>
                      <th className="pb-2 pr-3 font-semibold">Fee %</th>
                      <th className="pb-2 pr-3 font-semibold">Cost %</th>
                      <th className="pb-2 pr-3 font-semibold text-right">Fee</th>
                      <th className="pb-2 font-semibold text-right">Expenses</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.stages.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-3 text-slate-500">
                          No phases assigned — move phases here from another stage.
                        </td>
                      </tr>
                    ) : (
                      group.stages.map((row) => (
                        <tr key={row.stage} className="border-b border-white/[0.04]">
                          <td className="py-3 pr-3 text-slate-200">{row.label}</td>
                          <td className="py-3 pr-3">
                            <select
                              value={group.id}
                              onChange={(e) =>
                                setPhaseStructure((s) =>
                                  assignStageToPhase(s, row.stage, e.target.value),
                                )
                              }
                              className="rounded border border-white/[0.08] bg-white/[0.04] px-2 py-1 text-xs text-white"
                            >
                              {phaseStructure.phases.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name}
                                </option>
                              ))}
                            </select>
                          </td>
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
                          <td className="py-3 pr-3 tabular-nums text-slate-400">
                            {row.costPercent}%
                          </td>
                          <td className="py-3 pr-3 text-right tabular-nums text-slate-400">
                            {zar(row.feeZar)}
                          </td>
                          <td className="py-3 text-right tabular-nums text-slate-400">
                            {zar(row.expenseZar)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-3 text-xs text-slate-500">
          Fee splits total {feeSplitSum}%
          {feeSplitSum !== 100 ? (
            <span className="text-amber-300"> — must total 100% before saving</span>
          ) : null}
          {" · "}
          Expenses total {zar(totalExpenseZar)}
          {unassignedExpenseZar > 0 ? (
            <span className="text-amber-300">
              {" "}
              ({zar(unassignedExpenseZar)} unassigned — set a phase on each expense)
            </span>
          ) : null}
          {" · "}
          <Link
            href={`/dashboard/private/projects/${projectId}/expenses`}
            className="text-brand-300 hover:underline"
          >
            Manage expenses
          </Link>
        </p>
      </section>

      <section className="card-tool rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white">Progress & assignment</h2>
        <div className="mt-4 space-y-3">
          <label className="block text-xs text-slate-400">
            Current design phase
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
                Progress is calculated from design phase and time in phase.
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
            Phase notes
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
