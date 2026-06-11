"use client";

import { useCallback, useEffect, useState } from "react";
import { ProjectProgressBar } from "@/components/ProjectProgressBar";
import {
  COMPLEXITY_LABELS,
  PROJECT_PHASE_LABELS,
  PROJECT_STATUS_LABELS,
} from "@/lib/ops-constants";
import { computeProjectTimeline } from "@/lib/project-timeline";

type ProjectRow = {
  id: string;
  name: string;
  projectNumber: string;
  address: string | null;
  complexity: keyof typeof COMPLEXITY_LABELS;
  currentStage: keyof typeof PROJECT_PHASE_LABELS;
  currentStatus: keyof typeof PROJECT_STATUS_LABELS;
  startDate: string | null;
  dueDate: string | null;
  handoverDate: string | null;
  progressPercent: number | null;
  notes: string | null;
  client: { name: string };
};

export function AthleteProjectsClient() {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ currentStage: "", currentStatus: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const r = await fetch("/api/athlete/projects");
    const j = await r.json();
    if (r.ok) setProjects(j.projects || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function startEdit(p: ProjectRow) {
    setEditingId(p.id);
    setForm({
      currentStage: p.currentStage,
      currentStatus: p.currentStatus,
      notes: p.notes ?? "",
    });
    setError("");
    setMsg("");
  }

  async function saveEdit(projectId: string) {
    setSaving(true);
    setError("");
    setMsg("");
    const r = await fetch(`/api/athlete/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const j = await r.json();
    setSaving(false);
    if (!r.ok) {
      setError(j.error || "Could not save");
      return;
    }
    setEditingId(null);
    setMsg("Project updated.");
    void load();
  }

  if (loading) return <p className="text-sm text-slate-500">Loading projects…</p>;

  return (
    <div className="space-y-4">
      {msg ? <p className="text-sm text-brand-300">{msg}</p> : null}
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {projects.map((p) => {
        const timeline = computeProjectTimeline({
          startDate: p.startDate,
          dueDate: p.dueDate,
          handoverDate: p.handoverDate,
        });
        return (
        <article key={p.id} className="card-tool rounded-xl p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="font-semibold text-white">{p.name}</h2>
              <p className="text-xs text-slate-500">
                {p.client.name} · {p.projectNumber}
              </p>
              <p
                className={`mt-2 text-xs ${
                  timeline.isOverdue
                    ? "text-red-300"
                    : timeline.isDueSoon
                      ? "text-amber-300"
                      : "text-slate-500"
                }`}
              >
                {timeline.daysActive != null ? `${timeline.daysActive} days active · ` : ""}
                {timeline.label}
              </p>
              <div className="mt-3 max-w-md">
                <ProjectProgressBar percent={p.progressPercent ?? 0} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-white/[0.06] px-2 py-1 text-[10px] uppercase text-slate-400">
                {COMPLEXITY_LABELS[p.complexity]}
              </span>
              {editingId !== p.id ? (
                <button
                  type="button"
                  onClick={() => startEdit(p)}
                  className="text-xs text-brand-300 hover:text-brand-200"
                >
                  Edit
                </button>
              ) : null}
            </div>
          </div>
          {p.address ? <p className="mt-2 text-sm text-slate-400">{p.address}</p> : null}

          {editingId === p.id ? (
            <div className="mt-4 grid gap-3 border-t border-white/[0.06] pt-4 md:grid-cols-2">
              <label className="text-xs text-slate-400">
                Stage
                <select
                  value={form.currentStage}
                  onChange={(e) => setForm((f) => ({ ...f, currentStage: e.target.value }))}
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
                Status
                <select
                  value={form.currentStatus}
                  onChange={(e) => setForm((f) => ({ ...f, currentStatus: e.target.value }))}
                  className="select-console mt-1 block w-full rounded-md px-3 py-2 text-sm"
                >
                  {Object.entries(PROJECT_STATUS_LABELS).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-slate-400 md:col-span-2">
                Notes
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={3}
                  className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
                />
              </label>
              <div className="flex gap-2 md:col-span-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void saveEdit(p.id)}
                  className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-brand-500 disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingId(null)}
                  className="rounded-lg px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-xs md:grid-cols-4">
                <div>
                  <dt className="text-slate-500">Stage</dt>
                  <dd className="text-slate-200">{PROJECT_PHASE_LABELS[p.currentStage]}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Status</dt>
                  <dd className="text-slate-200">{PROJECT_STATUS_LABELS[p.currentStatus]}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Due</dt>
                  <dd className="text-slate-200">{p.dueDate ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Handover</dt>
                  <dd className="text-slate-200">{p.handoverDate ?? "—"}</dd>
                </div>
              </dl>
              {p.notes ? (
                <p className="mt-3 text-sm text-slate-400">
                  <span className="text-slate-500">Notes: </span>
                  {p.notes}
                </p>
              ) : null}
            </>
          )}
        </article>
        );
      })}
      {projects.length === 0 ? (
        <p className="text-sm text-slate-500">No projects assigned yet. Ask your admin to assign projects to you.</p>
      ) : null}
    </div>
  );
}
