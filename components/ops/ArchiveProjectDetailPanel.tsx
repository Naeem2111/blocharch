"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  COMPLEXITY_LABELS,
  PROJECT_PHASE_LABELS,
  PROJECT_STATUS_LABELS,
  projectStageSelectValue,
} from "@/lib/ops-constants";
import { clientPortalPath } from "@/lib/client-slug";
import {
  parseClientDeliverables,
  type ClientPortalDeliverable,
} from "@/lib/client-portal-deliverables";
import { composeDueAtIso, splitDueAtIso } from "@/lib/planner-due-datetime";
import type { OpsProjectPhase } from "@prisma/client";

type ClientContact = { id: string; name: string; email: string | null };

type ProjectDetail = {
  id: string;
  displayTitle: string;
  name: string;
  stageLabel: string;
  projectNumber: string;
  address: string | null;
  clientName: string;
  clientSlug: string | null;
  clientPortalEnabled: boolean;
  clientContacts: ClientContact[];
  assignedAthleteName: string | null;
  assignedAthleteCode: string | null;
  projectLeadContactId: string | null;
  currentStage: keyof typeof PROJECT_PHASE_LABELS;
  currentStatus: string;
  complexity: keyof typeof COMPLEXITY_LABELS;
  progressPercent: number | null;
  hoursLogged: number;
  startDate: string | null;
  dueDate: string | null;
  dueAt: string | null;
  handoverDate: string | null;
  completedAt: string | null;
  deadlineBeatenDays: number | null;
  deadlineBeatenMinutes: number | null;
  portalDisplayLocked: boolean;
  clientDescription: string | null;
  clientDeliverables: unknown;
  notes: string | null;
};

type SubmissionRow = {
  id: string;
  submissionDate: string;
  athleteName: string;
  totalHours: number;
  isBackloggedSession: boolean;
  dailyNote: string | null;
  lineItems: Array<{
    projectPhase: string;
    hoursWorked: number;
    completionPercent: number | null;
    completedSummary: string | null;
  }>;
};

function toDatetimeLocalValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocalValue(value: string): string | null {
  if (!value.trim()) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export function ArchiveProjectDetailPanel({
  projectId,
  onClose,
  detailPath = "/api/ops/projects",
  showOpsEditHint = true,
}: {
  projectId: string;
  onClose: () => void;
  detailPath?: string;
  showOpsEditHint?: boolean;
}) {
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");

  const [form, setForm] = useState({
    name: "",
    address: "",
    projectLeadContactId: "",
    currentStage: "",
    currentStatus: "",
    progressPercent: "",
    startDate: "",
    dueDate: "",
    dueTime: "",
    dueAmPm: "AM" as "AM" | "PM",
    handoverDate: "",
    completedAtLocal: "",
    deadlineBeatenDays: "",
    deadlineBeatenMinutes: "",
    portalDisplayLocked: true,
    clientDescription: "",
    deliverables: [] as ClientPortalDeliverable[],
  });

  const applyProject = useCallback((p: ProjectDetail) => {
    setProject(p);
    const due = splitDueAtIso(p.dueAt ?? (p.dueDate ? `${p.dueDate}T17:30:00+02:00` : null));
    setForm({
      name: p.name,
      address: p.address ?? "",
      projectLeadContactId: p.projectLeadContactId ?? "",
      currentStage: p.currentStage,
      currentStatus: p.currentStatus,
      progressPercent: p.progressPercent != null ? String(p.progressPercent) : "",
      startDate: p.startDate ?? "",
      dueDate: due.date,
      dueTime: due.time,
      dueAmPm: due.ampm,
      handoverDate: p.handoverDate ?? "",
      completedAtLocal: toDatetimeLocalValue(p.completedAt),
      deadlineBeatenDays: p.deadlineBeatenDays != null ? String(p.deadlineBeatenDays) : "",
      deadlineBeatenMinutes: p.deadlineBeatenMinutes != null ? String(p.deadlineBeatenMinutes) : "",
      portalDisplayLocked: p.portalDisplayLocked ?? true,
      clientDescription: p.clientDescription ?? "",
      deliverables: parseClientDeliverables(p.clientDeliverables),
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch(`${detailPath}/${encodeURIComponent(projectId)}`);
    const j = await r.json();
    if (!r.ok) {
      setError(j.error || "Could not load project");
      setLoading(false);
      return;
    }
    applyProject(j.project as ProjectDetail);
    setSubmissions(j.submissions || []);
    setError("");
    setLoading(false);
  }, [projectId, detailPath, applyProject]);

  useEffect(() => {
    void load();
  }, [load]);

  async function savePortalDisplay() {
    if (!project) return;
    setSaving(true);
    setSaveMessage("");
    setError("");
    try {
      const dueIso = composeDueAtIso(form.dueDate, form.dueTime, form.dueAmPm);
      const r = await fetch(`${detailPath}/${encodeURIComponent(projectId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          address: form.address.trim() || null,
          projectLeadContactId: form.projectLeadContactId || null,
          currentStage: form.currentStage,
          currentStatus: form.currentStatus,
          progressPercent: form.progressPercent === "" ? null : Number(form.progressPercent),
          startDate: form.startDate || null,
          dueDate: form.dueDate || null,
          dueAt: dueIso,
          handoverDate: form.handoverDate || null,
          completedAt: fromDatetimeLocalValue(form.completedAtLocal),
          deadlineBeatenDays: form.deadlineBeatenDays === "" ? null : Number(form.deadlineBeatenDays),
          deadlineBeatenMinutes:
            form.deadlineBeatenMinutes === "" ? null : Number(form.deadlineBeatenMinutes),
          portalDisplayLocked: form.portalDisplayLocked,
          clientDescription: form.clientDescription.trim() || null,
          clientDeliverables: form.deliverables.filter((d) => d.label.trim()),
        }),
      });
      const j = await r.json();
      if (!r.ok) {
        setError(j.error || "Could not save");
        return;
      }
      applyProject(j.project as ProjectDetail);
      setSaveMessage("Saved — client portal updated.");
    } finally {
      setSaving(false);
    }
  }

  const portalHref =
    project?.clientSlug && project.clientPortalEnabled
      ? clientPortalPath(project.clientSlug)
      : null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 pt-10">
      <div className="card-tool w-full max-w-3xl rounded-xl p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white">Edit client portal display</h2>
            <p className="text-xs text-slate-500">{project?.displayTitle ?? "Project"} · {projectId}</p>
          </div>
          <button type="button" onClick={onClose} className="text-sm text-slate-400 hover:text-white">
            Close
          </button>
        </div>

        {loading ? <p className="mt-4 text-sm text-slate-500">Loading…</p> : null}
        {error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}
        {saveMessage ? <p className="mt-4 text-sm text-emerald-400">{saveMessage}</p> : null}

        {project && !loading ? (
          <div className="mt-4 space-y-6">
            <div className="rounded-lg border border-brand-500/25 bg-brand-500/5 px-4 py-3 text-xs text-slate-300">
              Changes here update what the client sees on their portal immediately. Lock display to
              stop daily logs from overwriting completion dates and outcome metrics.
              {portalHref ? (
                <>
                  {" "}
                  <Link href={portalHref} target="_blank" className="text-brand-300 hover:underline">
                    Preview client portal →
                  </Link>
                </>
              ) : null}
            </div>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-white">Project details (client-visible)</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs text-slate-400 sm:col-span-2">
                  Project name
                  <input
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
                  />
                </label>
                <label className="text-xs text-slate-400 sm:col-span-2">
                  Address
                  <input
                    value={form.address}
                    onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                    className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
                  />
                </label>
                <label className="text-xs text-slate-400">
                  Office lead (portal)
                  <select
                    value={form.projectLeadContactId}
                    onChange={(e) => setForm((f) => ({ ...f, projectLeadContactId: e.target.value }))}
                    className="select-console mt-1 block w-full rounded-md px-3 py-2 text-sm"
                  >
                    <option value="">None</option>
                    {project.clientContacts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs text-slate-400">
                  Status
                  <select
                    value={form.currentStatus}
                    onChange={(e) => setForm((f) => ({ ...f, currentStatus: e.target.value }))}
                    className="select-console mt-1 block w-full rounded-md px-3 py-2 text-sm"
                  >
                    {Object.entries(PROJECT_STATUS_LABELS).map(([k, l]) => (
                      <option key={k} value={k}>
                        {l}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs text-slate-400">
                  Stage
                  <select
                    value={projectStageSelectValue(form.currentStage as OpsProjectPhase)}
                    onChange={(e) => setForm((f) => ({ ...f, currentStage: e.target.value }))}
                    className="select-console mt-1 block w-full rounded-md px-3 py-2 text-sm"
                  >
                    {Object.entries(PROJECT_PHASE_LABELS).map(([k, l]) => (
                      <option key={k} value={k}>
                        {l}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs text-slate-400">
                  Progress %
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={form.progressPercent}
                    onChange={(e) => setForm((f) => ({ ...f, progressPercent: e.target.value }))}
                    className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
                  />
                </label>
                <label className="text-xs text-slate-400">
                  Start date
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                    className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
                  />
                </label>
                <label className="text-xs text-slate-400">
                  Due date
                  <input
                    type="date"
                    value={form.dueDate}
                    onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
                    className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
                  />
                </label>
                <label className="text-xs text-slate-400">
                  Due time
                  <input
                    value={form.dueTime}
                    onChange={(e) => setForm((f) => ({ ...f, dueTime: e.target.value }))}
                    placeholder="5:30"
                    className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
                  />
                </label>
                <label className="text-xs text-slate-400">
                  AM / PM
                  <select
                    value={form.dueAmPm}
                    onChange={(e) => setForm((f) => ({ ...f, dueAmPm: e.target.value as "AM" | "PM" }))}
                    className="select-console mt-1 block w-full rounded-md px-3 py-2 text-sm"
                  >
                    <option value="AM">AM</option>
                    <option value="PM">PM</option>
                  </select>
                </label>
                <label className="text-xs text-slate-400">
                  Completion date & time
                  <input
                    type="datetime-local"
                    value={form.completedAtLocal}
                    onChange={(e) => setForm((f) => ({ ...f, completedAtLocal: e.target.value }))}
                    className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
                  />
                </label>
                <label className="text-xs text-slate-400">
                  Handover date
                  <input
                    type="date"
                    value={form.handoverDate}
                    onChange={(e) => setForm((f) => ({ ...f, handoverDate: e.target.value }))}
                    className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
                  />
                </label>
                <label className="text-xs text-slate-400">
                  Days early (outcome)
                  <input
                    type="number"
                    min={0}
                    value={form.deadlineBeatenDays}
                    onChange={(e) => setForm((f) => ({ ...f, deadlineBeatenDays: e.target.value }))}
                    className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
                  />
                </label>
                <label className="text-xs text-slate-400">
                  Minutes early (outcome)
                  <input
                    type="number"
                    min={0}
                    value={form.deadlineBeatenMinutes}
                    onChange={(e) => setForm((f) => ({ ...f, deadlineBeatenMinutes: e.target.value }))}
                    className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
                  />
                </label>
              </div>

              <label className="flex items-start gap-2 text-xs text-slate-400">
                <input
                  type="checkbox"
                  checked={form.portalDisplayLocked}
                  onChange={(e) => setForm((f) => ({ ...f, portalDisplayLocked: e.target.checked }))}
                  className="mt-0.5"
                />
                <span>
                  Lock client display — daily log sync will not overwrite completion dates, progress,
                  or outcome metrics for this project.
                </span>
              </label>

              <label className="block text-xs text-slate-400">
                Client-facing description
                <textarea
                  value={form.clientDescription}
                  onChange={(e) => setForm((f) => ({ ...f, clientDescription: e.target.value }))}
                  rows={4}
                  placeholder="Summary shown on the client portal…"
                  className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
                />
              </label>

              <div>
                <p className="text-xs text-slate-400">Deliverables & documents</p>
                <ul className="mt-2 space-y-2">
                  {form.deliverables.map((d, i) => (
                    <li key={i} className="flex flex-wrap gap-2">
                      <input
                        value={d.label}
                        onChange={(e) =>
                          setForm((f) => {
                            const next = [...f.deliverables];
                            next[i] = { ...next[i]!, label: e.target.value };
                            return { ...f, deliverables: next };
                          })
                        }
                        placeholder="Label"
                        className="min-w-[8rem] flex-1 rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
                      />
                      <input
                        value={d.url ?? ""}
                        onChange={(e) =>
                          setForm((f) => {
                            const next = [...f.deliverables];
                            next[i] = { ...next[i]!, url: e.target.value || null };
                            return { ...f, deliverables: next };
                          })
                        }
                        placeholder="https://…"
                        className="min-w-[12rem] flex-[2] rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            deliverables: f.deliverables.filter((_, j) => j !== i),
                          }))
                        }
                        className="text-xs text-red-400 hover:underline"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      deliverables: [...f.deliverables, { label: "", url: null }],
                    }))
                  }
                  className="mt-2 text-xs text-brand-300 hover:underline"
                >
                  + Add deliverable
                </button>
              </div>
            </section>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-4">
              <dl className="grid gap-1 text-xs text-slate-500 sm:grid-cols-2">
                <div>
                  Client: <span className="text-slate-300">{project.clientName}</span>
                </div>
                <div>
                  Athlete:{" "}
                  <span className="text-slate-300">
                    {project.assignedAthleteName ?? "Unassigned"}
                    {project.assignedAthleteCode ? ` · ${project.assignedAthleteCode}` : ""}
                  </span>
                </div>
                <div>
                  Hours logged: <span className="text-slate-300">{project.hoursLogged}h</span>
                </div>
              </dl>
              <button
                type="button"
                disabled={saving}
                onClick={() => void savePortalDisplay()}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save client portal display"}
              </button>
            </div>

            <details className="text-sm">
              <summary className="cursor-pointer text-slate-400 hover:text-slate-200">
                Daily submissions ({submissions.length})
              </summary>
              {submissions.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">No daily logs for this project.</p>
              ) : (
                <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto">
                  {submissions.map((s) => (
                    <li key={s.id} className="rounded-lg bg-white/[0.03] px-3 py-2 text-xs">
                      <p className="font-medium text-slate-200">
                        {s.submissionDate} · {s.athleteName} · {s.totalHours}h
                      </p>
                      {s.lineItems.map((li, i) => (
                        <p key={i} className="mt-1 text-slate-400">
                          {li.hoursWorked}h · {li.completionPercent ?? 0}%
                          {li.completedSummary ? ` · ${li.completedSummary}` : ""}
                        </p>
                      ))}
                    </li>
                  ))}
                </ul>
              )}
            </details>

            {showOpsEditHint ? (
              <p className="text-xs text-slate-500">
                You can also edit active projects from Ops → Projects. Archives use this panel for
                client-facing corrections.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
