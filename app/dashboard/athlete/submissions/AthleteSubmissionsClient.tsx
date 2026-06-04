"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ProgressSlider } from "@/components/ProgressSlider";
import { PROJECT_PHASE_LABELS, TASK_TYPE_LABELS } from "@/lib/ops-constants";

type AssignedProject = {
  id: string;
  name: string;
  projectNumber: string;
  complexity: string;
  client: { id: string; name: string };
};

type LineItemForm = {
  key: string;
  projectId: string;
  projectPhase: string;
  taskType: string;
  hoursWorked: string;
  completionPercent: number;
  completedSummary: string;
  blockerFlag: boolean;
  blockerNote: string;
};

type CalcPanel = {
  todayHours: number;
  monthHoursAfter: number;
  hoursRemaining: number;
  overtimeTriggered: boolean;
  overtimeHours: number;
  totalEarningsZar: number;
  alerts?: Array<{ code: string; severity: string; message: string }>;
};

type PastSubmission = {
  id: string;
  submissionDate: string;
  totalHours: number;
  wellbeingScore: number | null;
  checkInRequested: boolean;
  dailyNote: string | null;
  lockedAt: string | null;
  editable: boolean;
  alerts: Array<{ code: string; severity: string; message: string }>;
  lineItems: Array<{
    projectId: string;
    projectPhase: string;
    taskType: string;
    hoursWorked: number;
    completedSummary: string | null;
    blockerFlag: boolean;
    blockerNote: string | null;
    completionPercent?: number | null;
  }>;
};

function emptyLine(): LineItemForm {
  return {
    key: crypto.randomUUID(),
    projectId: "",
    projectPhase: "existing_drawings",
    taskType: "plans",
    hoursWorked: "",
    completionPercent: 0,
    completedSummary: "",
    blockerFlag: false,
    blockerNote: "",
  };
}

export function AthleteSubmissionsClient() {
  const [projects, setProjects] = useState<AssignedProject[]>([]);
  const [pastSubmissions, setPastSubmissions] = useState<PastSubmission[]>([]);
  const [monthlyHourCap, setMonthlyHourCap] = useState(160);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [calc, setCalc] = useState<CalcPanel | null>(null);
  const [wellbeingScore, setWellbeingScore] = useState("3");
  const [checkInRequested, setCheckInRequested] = useState(false);
  const [dailyNote, setDailyNote] = useState("");
  const [lines, setLines] = useState<LineItemForm[]>([emptyLine()]);
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [formLocked, setFormLocked] = useState(false);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  function applySubmission(sub: PastSubmission, notify?: string) {
    setSelectedDate(sub.submissionDate);
    setWellbeingScore(String(sub.wellbeingScore ?? 3));
    setCheckInRequested(sub.checkInRequested);
    setDailyNote(sub.dailyNote ?? "");
    setFormLocked(!sub.editable);
    setLines(
      sub.lineItems.length > 0
        ? sub.lineItems.map((li) => ({
            key: crypto.randomUUID(),
            projectId: li.projectId,
            projectPhase: li.projectPhase,
            taskType: li.taskType,
            hoursWorked: String(li.hoursWorked),
            completionPercent: li.completionPercent ?? 0,
            completedSummary: li.completedSummary ?? "",
            blockerFlag: li.blockerFlag,
            blockerNote: li.blockerNote ?? "",
          }))
        : [emptyLine()]
    );
    if (notify) setSuccess(notify);
  }

  function loadSubmissionIntoForm(sub: PastSubmission) {
    if (!sub.editable) {
      setError("This submission is locked. Ask admin to unlock it under Commercial → Submission locks.");
      return;
    }
    setError("");
    applySubmission(sub, `Editing ${sub.submissionDate}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetToToday() {
    setSelectedDate(today);
    setWellbeingScore("3");
    setCheckInRequested(false);
    setDailyNote("");
    setLines([emptyLine()]);
    setFormLocked(false);
    setError("");
    setSuccess("");
  }

  const load = useCallback(async () => {
    const [pr, sr] = await Promise.all([fetch("/api/athlete/projects"), fetch("/api/athlete/submissions")]);
    const pj = await pr.json();
    const sj = await sr.json();
    if (pr.ok) setProjects(pj.projects || []);
    if (sr.ok) {
      const subs: PastSubmission[] = sj.submissions || [];
      setPastSubmissions(subs);
      if (sj.monthlyHourCap) setMonthlyHourCap(sj.monthlyHourCap);
      const todaySub = subs.find((s) => s.submissionDate === today);
      if (todaySub?.editable) applySubmission(todaySub);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const todayHoursPreview = lines.reduce((sum, li) => sum + (Number(li.hoursWorked) || 0), 0);

  function updateLine(key: string, patch: Partial<LineItemForm>) {
    setLines((prev) => prev.map((li) => (li.key === key ? { ...li, ...patch } : li)));
  }

  function addLine() {
    setLines((prev) => [...prev, emptyLine()]);
  }

  function removeLine(key: string) {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((li) => li.key !== key)));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      const lineItems = lines
        .filter((li) => li.projectId && Number(li.hoursWorked) > 0)
        .map((li) => {
          const project = projects.find((p) => p.id === li.projectId);
          if (!project) throw new Error("Invalid project");
          return {
            clientId: project.client.id,
            projectId: li.projectId,
            projectPhase: li.projectPhase,
            taskType: li.taskType,
            hoursWorked: Number(li.hoursWorked),
            completionPercent: li.completionPercent,
            completedSummary: li.completedSummary || null,
            blockerFlag: li.blockerFlag,
            blockerNote: li.blockerNote || null,
          };
        });

      if (lineItems.length === 0) {
        setError("Add at least one project entry with hours.");
        return;
      }

      const r = await fetch("/api/athlete/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionDate: selectedDate,
          wellbeingScore: Number(wellbeingScore),
          checkInRequested,
          dailyNote,
          lineItems,
        }),
      });
      const j = await r.json();
      if (!r.ok) {
        setError(j.error || "Could not save submission");
        return;
      }
      setCalc(j.calculation);
      setSuccess("Daily log saved.");
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-slate-500">Loading…</p>;

  return (
    <div className="space-y-8">
    <form onSubmit={submit} className="space-y-6">
      <div className="card-tool grid gap-4 rounded-xl p-4 md:grid-cols-3">
        <label className="text-xs text-slate-400">
          Date
          <input
            readOnly
            value={selectedDate}
            className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-slate-300"
          />
        </label>
        <label className="text-xs text-slate-400">
          Wellbeing (1–5)
          <select
            value={wellbeingScore}
            onChange={(e) => setWellbeingScore(e.target.value)}
            className="select-console mt-1 block w-full rounded-md px-3 py-2 text-sm"
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-end gap-2 pb-2 text-xs text-slate-400">
          <input
            type="checkbox"
            checked={checkInRequested}
            onChange={(e) => setCheckInRequested(e.target.checked)}
            className="rounded border-white/20"
          />
          Request check-in
        </label>
        <label className="text-xs text-slate-400 md:col-span-3">
          Daily note (optional)
          <textarea
            value={dailyNote}
            onChange={(e) => setDailyNote(e.target.value)}
            rows={2}
            className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
          />
        </label>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Project entries</h2>
          <button
            type="button"
            onClick={addLine}
            className="text-xs font-medium text-brand-300 hover:text-brand-200"
          >
            + Add project entry
          </button>
        </div>

        {projects.length === 0 ? (
          <p className="text-sm text-slate-500">No assigned projects — you cannot log work yet.</p>
        ) : null}

        {lines.map((li) => {
          const project = projects.find((p) => p.id === li.projectId);
          return (
            <div key={li.key} className="card-tool grid gap-3 rounded-xl p-4 md:grid-cols-2">
              <label className="text-xs text-slate-400 md:col-span-2">
                Project
                <select
                  required
                  value={li.projectId}
                  onChange={(e) => updateLine(li.key, { projectId: e.target.value })}
                  className="select-console mt-1 block w-full rounded-md px-3 py-2 text-sm"
                >
                  <option value="">Select project…</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.client.name} — {p.name} ({p.projectNumber})
                    </option>
                  ))}
                </select>
              </label>
              {project ? (
                <p className="text-[11px] text-slate-500 md:col-span-2">Complexity: {project.complexity}</p>
              ) : null}
              <label className="text-xs text-slate-400">
                Project phase
                <select
                  value={li.projectPhase}
                  onChange={(e) => updateLine(li.key, { projectPhase: e.target.value })}
                  className="select-console mt-1 block w-full rounded-md px-3 py-2 text-sm"
                >
                  {Object.entries(PROJECT_PHASE_LABELS).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-slate-400">
                Task type
                <select
                  value={li.taskType}
                  onChange={(e) => updateLine(li.key, { taskType: e.target.value })}
                  className="select-console mt-1 block w-full rounded-md px-3 py-2 text-sm"
                >
                  {Object.entries(TASK_TYPE_LABELS).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-slate-400">
                Hours worked
                <input
                  type="number"
                  min={0.25}
                  max={24}
                  step={0.25}
                  required
                  value={li.hoursWorked}
                  onChange={(e) => updateLine(li.key, { hoursWorked: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
                />
              </label>
              <div className="md:col-span-2">
                <ProgressSlider
                  value={li.completionPercent}
                  onChange={(v) => updateLine(li.key, { completionPercent: v })}
                  disabled={formLocked}
                />
              </div>
              <label className="text-xs text-slate-400 md:col-span-2">
                What was completed
                <textarea
                  value={li.completedSummary}
                  onChange={(e) => updateLine(li.key, { completedSummary: e.target.value })}
                  rows={2}
                  className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
                />
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-400">
                <input
                  type="checkbox"
                  checked={li.blockerFlag}
                  onChange={(e) => updateLine(li.key, { blockerFlag: e.target.checked })}
                />
                Blocker flagged
              </label>
              {li.blockerFlag ? (
                <label className="text-xs text-slate-400">
                  Blocker note
                  <input
                    value={li.blockerNote}
                    onChange={(e) => updateLine(li.key, { blockerNote: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
                  />
                </label>
              ) : null}
              {lines.length > 1 ? (
                <button
                  type="button"
                  onClick={() => removeLine(li.key)}
                  className="text-xs text-slate-500 hover:text-red-300 md:col-span-2 md:text-left"
                >
                  Remove entry
                </button>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="card-tool rounded-xl p-4">
        <h2 className="text-sm font-semibold text-white">Smart calculation</h2>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm md:grid-cols-3">
          <div>
            <dt className="text-slate-500">Today (preview)</dt>
            <dd className="font-medium text-white">{todayHoursPreview.toFixed(2)}h</dd>
          </div>
          {calc ? (
            <>
              <div>
                <dt className="text-slate-500">Month after save</dt>
                <dd className="font-medium text-white">{calc.monthHoursAfter.toFixed(1)}h</dd>
              </div>
              <div>
                <dt className="text-slate-500">Remaining to {monthlyHourCap}h</dt>
                <dd className="font-medium text-white">{calc.hoursRemaining.toFixed(1)}h</dd>
              </div>
              <div>
                <dt className="text-slate-500">Overtime</dt>
                <dd className="font-medium text-amber-300">
                  {calc.overtimeTriggered ? `${calc.overtimeHours.toFixed(1)}h` : "No"}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Est. monthly earnings</dt>
                <dd className="font-medium text-brand-300">R {calc.totalEarningsZar.toLocaleString()}</dd>
              </div>
            </>
          ) : (
            <div className="col-span-2 text-xs text-slate-500">Save to update month-to-date calculations.</div>
          )}
        </dl>
      </div>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {success ? <p className="text-sm text-brand-300">{success}</p> : null}

      <button
        type="submit"
        disabled={saving || projects.length === 0 || formLocked}
        className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-brand-500 disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save daily log"}
      </button>
    </form>

      <div className="card-tool rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white">Recent submissions</h2>
        <p className="mt-1 text-xs text-slate-500">
          Logs auto-lock after 7 days. Click Edit on an unlocked entry below, or ask admin to unlock under Commercial.
        </p>
        {pastSubmissions.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No submissions yet.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {pastSubmissions.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/[0.03] px-3 py-2 text-sm"
              >
                <span className="text-slate-300">
                  {s.submissionDate} · {s.totalHours}h
                  {s.lockedAt ? (
                    <span className="ml-2 rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] uppercase text-slate-500">
                      Locked
                    </span>
                  ) : s.editable ? (
                    <span className="ml-2 text-[10px] text-brand-300">Editable</span>
                  ) : null}
                </span>
                {s.editable ? (
                  <button
                    type="button"
                    onClick={() => loadSubmissionIntoForm(s)}
                    className="text-xs text-brand-300 hover:text-brand-200"
                  >
                    Edit
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
