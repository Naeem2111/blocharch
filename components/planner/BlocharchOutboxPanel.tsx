"use client";

import { useCallback, useEffect, useState } from "react";

type AthleteOption = { id: string; fullName: string; athleteCode: string };
type ProjectOption = { id: string; name: string; clientName: string; assignedAthleteId: string | null };
type OutboxRow = {
  id: string;
  athleteName: string;
  projectName: string | null;
  title: string | null;
  priority: string;
  deliveredAt: string | null;
  createdAt: string;
};

const PRIORITIES = ["low", "normal", "high", "urgent"] as const;

const emptyForm = {
  athleteId: "",
  projectId: "",
  title: "",
  description: "",
  dueAt: "",
  priority: "normal" as (typeof PRIORITIES)[number],
  notes: "",
};

export function BlocharchOutboxPanel() {
  const [athletes, setAthletes] = useState<AthleteOption[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [history, setHistory] = useState<OutboxRow[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    const r = await fetch("/api/planner/outbox?limit=30");
    const j = await r.json().catch(() => ({}));
    if (r.ok) setHistory(j.tasks || []);
  }, []);

  useEffect(() => {
    Promise.all([fetch("/api/planner/outbox/options").then((r) => r.json()), loadHistory()]).then(
      ([opts]) => {
        if (opts.athletes) {
          setAthletes(
            opts.athletes.map((x: { id: string; fullName: string; athleteCode: string }) => ({
              id: x.id,
              fullName: x.fullName,
              athleteCode: x.athleteCode,
            }))
          );
        }
        if (opts.projects) {
          setProjects(
            opts.projects.map(
              (x: {
                id: string;
                name: string;
                clientName: string;
                assignedAthleteId: string | null;
              }) => ({
                id: x.id,
                name: x.name,
                clientName: x.clientName,
                assignedAthleteId: x.assignedAthleteId,
              })
            )
          );
        }
      }
    );
  }, [loadHistory]);

  const projectOptions = form.athleteId
    ? projects.filter((p) => p.assignedAthleteId === form.athleteId)
    : projects;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!form.athleteId) {
      setError("Select an athlete");
      return;
    }
    setSaving(true);
    try {
      const r = await fetch("/api/planner/outbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          athleteId: form.athleteId,
          projectId: form.projectId || null,
          title: form.title || null,
          description: form.description || null,
          dueAt: form.dueAt || null,
          priority: form.priority,
          notes: form.notes || null,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError((j as { error?: string }).error || "Could not assign task");
        return;
      }
      const athleteName = athletes.find((a) => a.id === form.athleteId)?.fullName ?? "athlete";
      setSuccess(`Assigned to ${athleteName} — card added to their Blocharch Inbox.`);
      setForm({ ...emptyForm, athleteId: form.athleteId });
      await loadHistory();
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card-tool space-y-6 rounded-xl p-5 ring-1 ring-amber-500/20">
      <div>
        <h2 className="text-lg font-semibold text-amber-100">Blocharch Outbox</h2>
        <p className="mt-1 text-sm text-slate-400">
          Assign work to an athlete. Each assignment creates a card on their{" "}
          <span className="text-slate-300">Blocharch Inbox</span> automatically.
        </p>
      </div>

      <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
        <label className="text-xs text-slate-400 sm:col-span-2">
          Athlete <span className="text-red-400">*</span>
          <select
            required
            value={form.athleteId}
            onChange={(e) => setForm((f) => ({ ...f, athleteId: e.target.value, projectId: "" }))}
            className="select-console mt-1 block w-full rounded-md px-3 py-2 text-sm"
          >
            <option value="">Select athlete…</option>
            {athletes.map((a) => (
              <option key={a.id} value={a.id}>
                {a.fullName} ({a.athleteCode})
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs text-slate-400">
          Project (optional)
          <select
            value={form.projectId}
            onChange={(e) => setForm((f) => ({ ...f, projectId: e.target.value }))}
            className="select-console mt-1 block w-full rounded-md px-3 py-2 text-sm"
          >
            <option value="">None</option>
            {projectOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {p.clientName}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs text-slate-400">
          Priority
          <select
            value={form.priority}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                priority: e.target.value as (typeof PRIORITIES)[number],
              }))
            }
            className="select-console mt-1 block w-full rounded-md px-3 py-2 text-sm"
          >
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs text-slate-400 sm:col-span-2">
          Task title (optional)
          <input
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
            placeholder="e.g. Update GA drawings"
          />
        </label>

        <label className="text-xs text-slate-400 sm:col-span-2">
          Description (optional)
          <textarea
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            rows={3}
            className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
          />
        </label>

        <label className="text-xs text-slate-400">
          Due date (optional)
          <input
            type="date"
            value={form.dueAt}
            onChange={(e) => setForm((f) => ({ ...f, dueAt: e.target.value }))}
            className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
          />
        </label>

        <label className="text-xs text-slate-400 sm:col-span-2">
          Notes (optional)
          <textarea
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            rows={2}
            className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
          />
        </label>

        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-500 disabled:opacity-50"
          >
            {saving ? "Assigning…" : "Assign to athlete Inbox"}
          </button>
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          {success ? <p className="text-sm text-emerald-400">{success}</p> : null}
        </div>
      </form>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recent assignments</h3>
        {history.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No assignments yet.</p>
        ) : (
          <ul className="mt-2 divide-y divide-white/[0.06] rounded-lg border border-white/[0.06]">
            {history.map((row) => (
              <li key={row.id} className="flex flex-wrap justify-between gap-2 px-3 py-2 text-sm">
                <span className="text-slate-200">
                  {row.title || "Untitled"} → {row.athleteName}
                  {row.projectName ? ` · ${row.projectName}` : ""}
                </span>
                <span className="text-xs text-slate-500">
                  {row.deliveredAt ? "Delivered" : "Pending"} · {new Date(row.createdAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
