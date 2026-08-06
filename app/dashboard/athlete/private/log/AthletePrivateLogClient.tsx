"use client";

import { useCallback, useEffect, useState } from "react";
import { ProgressSlider } from "@/components/ProgressSlider";

type ProjectOpt = { id: string; name: string; progressPercent: number };
type LogRow = {
  id: string;
  projectName: string;
  workDate: string;
  hours: number;
  notes: string | null;
};

export function AthletePrivateLogClient() {
  const [projects, setProjects] = useState<ProjectOpt[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    projectId: "",
    date: new Date().toISOString().slice(0, 10),
    hours: "",
    notes: "",
    completionPercent: 0,
  });

  const load = useCallback(async () => {
    const r = await fetch("/api/athlete/private/log");
    const j = await r.json();
    if (r.ok) {
      const projs: ProjectOpt[] = j.projects || [];
      setProjects(projs);
      setLogs(j.logs || []);
      setForm((f) => {
        const nextProjectId = f.projectId || projs[0]?.id || "";
        const selected = projs.find((p) => p.id === nextProjectId);
        return {
          ...f,
          projectId: nextProjectId,
          completionPercent: selected?.progressPercent ?? 0,
        };
      });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function handleProjectChange(projectId: string) {
    const p = projects.find((x) => x.id === projectId);
    setForm((f) => ({
      ...f,
      projectId,
      completionPercent: projectId ? (p?.progressPercent ?? 0) : 0,
    }));
  }

  const selectedProject = projects.find((p) => p.id === form.projectId);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setMsg("");
    const r = await fetch("/api/athlete/private/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: form.projectId,
        date: form.date,
        hours: Number(form.hours),
        notes: form.notes || null,
        completionPercent: form.completionPercent,
      }),
    });
    const j = await r.json();
    setSaving(false);
    if (!r.ok) {
      setError(j.error || "Could not log");
      return;
    }
    setMsg("Hours logged — feeds private commercial only, never lane billing.");
    setForm((f) => ({ ...f, hours: "", notes: "" }));
    void load();
  }

  const field =
    "mt-1 w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white";

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <form onSubmit={(e) => void submit(e)} className="card-tool space-y-4 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white">Log an entry — private work</h2>
        {error ? <p className="text-sm text-red-300">{error}</p> : null}
        {msg ? <p className="text-sm text-brand-300">{msg}</p> : null}
        <label className="block text-xs text-slate-400">
          Project
          <select
            required
            className={field}
            value={form.projectId}
            onChange={(e) => handleProjectChange(e.target.value)}
          >
            <option value="">Select project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-slate-400">
          Date
          <input
            type="date"
            required
            className={field}
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
        </label>
        <label className="block text-xs text-slate-400">
          Hours
          <input
            type="number"
            required
            min={0.25}
            max={24}
            step={0.25}
            className={field}
            value={form.hours}
            onChange={(e) => setForm({ ...form, hours: e.target.value })}
          />
        </label>
        {form.projectId ? (
          <ProgressSlider
            value={form.completionPercent}
            onChange={(v) => setForm((f) => ({ ...f, completionPercent: v }))}
            disabled={saving}
            label={
              selectedProject
                ? `Project progress (currently ${selectedProject.progressPercent}% on record)`
                : "Project progress"
            }
          />
        ) : null}
        <label className="block text-xs text-slate-400">
          Notes
          <textarea
            rows={3}
            className={field}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Reviewed council query on boundary line, drafted response."
          />
        </label>
        <button
          type="submit"
          disabled={saving || projects.length === 0}
          className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-brand-400 disabled:opacity-60"
        >
          {saving ? "Logging…" : "Log hours"}
        </button>
        <p className="text-xs leading-relaxed text-slate-500">
          This entry lands on the private-projects record and rolls into private Commercial &
          analytics — never into Athlete operations’ lane billing.
        </p>
      </form>

      <section className="card-tool rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white">Recent private entries</h2>
        <ul className="mt-4 space-y-3">
          {logs.length === 0 ? (
            <li className="text-sm text-slate-500">No entries yet.</li>
          ) : (
            logs.map((l) => (
              <li key={l.id} className="border-b border-white/[0.04] pb-3 text-sm">
                <div className="flex justify-between gap-2">
                  <span className="font-medium text-slate-200">{l.projectName}</span>
                  <span className="tabular-nums text-slate-400">{l.hours}h</span>
                </div>
                <p className="text-xs text-slate-500">{l.workDate}</p>
                {l.notes ? <p className="mt-1 text-xs text-slate-400">{l.notes}</p> : null}
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
