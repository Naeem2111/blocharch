"use client";

import { useCallback, useEffect, useState } from "react";
import { COMPLEXITY_LABELS, PROJECT_PHASE_LABELS, PROJECT_STATUS_LABELS } from "@/lib/ops-constants";

type ClientOption = { id: string; name: string };
type AthleteOption = { id: string; fullName: string; athleteCode: string };
type ProjectRow = {
  id: string;
  clientName: string;
  assignedAthleteName: string | null;
  name: string;
  projectNumber: string;
  complexity: keyof typeof COMPLEXITY_LABELS;
  currentStage: keyof typeof PROJECT_PHASE_LABELS;
  currentStatus: keyof typeof PROJECT_STATUS_LABELS;
  dueDate: string | null;
  blockerFlag: boolean;
};

export function OpsProjectsClient() {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [athletes, setAthletes] = useState<AthleteOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    clientId: "",
    assignedAthleteId: "",
    name: "",
    projectNumber: "",
    address: "",
    projectLead: "",
    complexity: "medium",
    dueDate: "",
  });

  const load = useCallback(async () => {
    const [pr, cr, ar] = await Promise.all([
      fetch("/api/ops/projects"),
      fetch("/api/ops/clients"),
      fetch("/api/ops/athletes"),
    ]);
    const pj = await pr.json();
    const cj = await cr.json();
    const aj = await ar.json();
    if (pr.ok) setProjects(pj.projects || []);
    if (cr.ok) setClients((cj.clients || []).map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })));
    if (ar.ok)
      setAthletes(
        (aj.athletes || []).map((a: { id: string; fullName: string; athleteCode: string }) => ({
          id: a.id,
          fullName: a.fullName,
          athleteCode: a.athleteCode,
        }))
      );
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createProject(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const r = await fetch("/api/ops/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        assignedAthleteId: form.assignedAthleteId || null,
        dueDate: form.dueDate || null,
      }),
    });
    const j = await r.json();
    if (!r.ok) {
      setError(j.error || "Could not create project");
      return;
    }
    setOpen(false);
    setForm({
      clientId: "",
      assignedAthleteId: "",
      name: "",
      projectNumber: "",
      address: "",
      projectLead: "",
      complexity: "medium",
      dueDate: "",
    });
    await load();
  }

  if (loading) return <p className="text-sm text-slate-500">Loading projects…</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-400">{projects.length} project(s)</p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-brand-500"
        >
          New project
        </button>
      </div>

      {open && (
        <form onSubmit={createProject} className="card-tool grid gap-3 rounded-xl p-4 md:grid-cols-2">
          <label className="text-xs text-slate-400">
            Client
            <select
              required
              value={form.clientId}
              onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value }))}
              className="select-console mt-1 block w-full rounded-md px-3 py-2 text-sm"
            >
              <option value="">Select client…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-slate-400">
            Assigned athlete
            <select
              value={form.assignedAthleteId}
              onChange={(e) => setForm((f) => ({ ...f, assignedAthleteId: e.target.value }))}
              className="select-console mt-1 block w-full rounded-md px-3 py-2 text-sm"
            >
              <option value="">Unassigned</option>
              {athletes.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.fullName} ({a.athleteCode})
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-slate-400">
            Project name
            <input
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
            />
          </label>
          <label className="text-xs text-slate-400">
            Project number
            <input
              required
              value={form.projectNumber}
              onChange={(e) => setForm((f) => ({ ...f, projectNumber: e.target.value }))}
              className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
            />
          </label>
          <label className="text-xs text-slate-400 md:col-span-2">
            Address
            <input
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
            />
          </label>
          <label className="text-xs text-slate-400">
            Project lead
            <input
              value={form.projectLead}
              onChange={(e) => setForm((f) => ({ ...f, projectLead: e.target.value }))}
              className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
            />
          </label>
          <label className="text-xs text-slate-400">
            Complexity
            <select
              value={form.complexity}
              onChange={(e) => setForm((f) => ({ ...f, complexity: e.target.value }))}
              className="select-console mt-1 block w-full rounded-md px-3 py-2 text-sm"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
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
          {error ? <p className="text-sm text-red-400 md:col-span-2">{error}</p> : null}
          <div className="flex gap-2 md:col-span-2">
            <button type="submit" className="rounded-lg bg-white/[0.08] px-4 py-2 text-sm text-slate-100">
              Create project
            </button>
            <button type="button" onClick={() => setOpen(false)} className="text-sm text-slate-500">
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-white/[0.06] bg-white/[0.02] text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-3">Project</th>
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Athlete</th>
              <th className="px-4 py-3">Stage</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Due</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => (
              <tr key={p.id} className="border-b border-white/[0.04] text-slate-300">
                <td className="px-4 py-3">
                  <p className="font-medium text-white">
                    {p.name}
                    {p.blockerFlag ? (
                      <span className="ml-2 rounded bg-red-500/15 px-1.5 py-0.5 text-[10px] text-red-300">Blocker</span>
                    ) : null}
                  </p>
                  <p className="text-xs text-slate-500">{p.projectNumber}</p>
                </td>
                <td className="px-4 py-3">{p.clientName}</td>
                <td className="px-4 py-3">{p.assignedAthleteName ?? "—"}</td>
                <td className="px-4 py-3">{PROJECT_PHASE_LABELS[p.currentStage]}</td>
                <td className="px-4 py-3">{PROJECT_STATUS_LABELS[p.currentStatus]}</td>
                <td className="px-4 py-3">{p.dueDate ?? "—"}</td>
              </tr>
            ))}
            {projects.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  No projects yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
