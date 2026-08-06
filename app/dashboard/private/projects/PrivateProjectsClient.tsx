"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PRIVATE_STAGE_LABELS, PRIVATE_STAGE_ORDER } from "@/lib/private-constants";

type ProjectRow = {
  id: string;
  name: string;
  designStage: string;
  designStageLabel: string;
  progressPercent: number;
  feeZar: number;
  marginPercent: number | null;
  client: { id: string; name: string };
  athlete: { initials: string; fullName: string } | null;
};

function zar(n: number) {
  return `R ${Math.round(n).toLocaleString("en-ZA")}`;
}

export function PrivateProjectsClient() {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [stageOpenId, setStageOpenId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ projectName: "", clientName: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch("/api/private/projects?scope=active");
    const j = await r.json();
    if (!r.ok) {
      setError(j.error || "Failed to load");
      setLoading(false);
      return;
    }
    setProjects(j.projects || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function setStage(projectId: string, designStage: string) {
    setSaving(true);
    setError("");
    const r = await fetch(`/api/private/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ designStage }),
    });
    const j = await r.json();
    setSaving(false);
    if (!r.ok) {
      setError(j.error || "Could not update stage");
      return;
    }
    setStageOpenId(null);
    void load();
  }

  function startEdit(p: ProjectRow) {
    setEditingId(p.id);
    setEditForm({ projectName: p.name, clientName: p.client.name });
    setStageOpenId(null);
    setError("");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm({ projectName: "", clientName: "" });
  }

  async function saveEdit(projectId: string) {
    const projectName = editForm.projectName.trim();
    const clientName = editForm.clientName.trim();
    if (!projectName || !clientName) {
      setError("Project name and client name are required.");
      return;
    }
    setSaving(true);
    setError("");
    const r = await fetch(`/api/private/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: projectName, clientName }),
    });
    const j = await r.json();
    setSaving(false);
    if (!r.ok) {
      setError(j.error || "Could not save");
      return;
    }
    setEditingId(null);
    void load();
  }

  if (loading) return <p className="text-sm text-slate-500">Loading projects…</p>;

  return (
    <div className="space-y-4">
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      <div className="card-tool overflow-x-auto rounded-xl">
        <table className="w-full min-w-[52rem] text-left text-sm">
          <thead>
            <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-wider text-slate-500">
              <th className="px-4 py-3 font-semibold">Project</th>
              <th className="px-4 py-3 font-semibold">Client</th>
              <th className="px-4 py-3 font-semibold">Athlete</th>
              <th className="px-4 py-3 font-semibold">Stage</th>
              <th className="px-4 py-3 font-semibold">Progress</th>
              <th className="px-4 py-3 font-semibold">Fee</th>
              <th className="px-4 py-3 font-semibold">Margin</th>
              <th className="px-4 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {projects.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-slate-500">
                  No active private projects.{" "}
                  <Link href="/dashboard/private/onboarding" className="text-brand-300 hover:underline">
                    Onboard one
                  </Link>
                </td>
              </tr>
            ) : (
              projects.map((p) => (
                <tr key={p.id} className="border-b border-white/[0.04] align-top">
                  <td className="px-4 py-3">
                    {editingId === p.id ? (
                      <input
                        value={editForm.projectName}
                        onChange={(e) => setEditForm({ ...editForm, projectName: e.target.value })}
                        className="w-full min-w-[12rem] rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 py-1.5 text-sm text-white"
                        placeholder="Project name / address"
                      />
                    ) : (
                      <Link
                        href={`/dashboard/private/projects/${p.id}`}
                        className="font-medium text-white hover:text-brand-300"
                      >
                        {p.name}
                      </Link>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-300">
                    {editingId === p.id ? (
                      <input
                        value={editForm.clientName}
                        onChange={(e) => setEditForm({ ...editForm, clientName: e.target.value })}
                        className="w-full min-w-[10rem] rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 py-1.5 text-sm text-white"
                        placeholder="Client name"
                      />
                    ) : (
                      p.client.name
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-brand-500/20 text-[10px] font-bold text-brand-200"
                      title={p.athlete?.fullName}
                    >
                      {p.athlete?.initials ?? "—"}
                    </span>
                  </td>
                  <td className="relative px-4 py-3">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => setStageOpenId(stageOpenId === p.id ? null : p.id)}
                      className="rounded-lg bg-white/[0.04] px-2.5 py-1.5 text-left text-xs text-slate-200 ring-1 ring-white/[0.08] hover:bg-white/[0.07]"
                    >
                      {p.designStageLabel} ▾
                    </button>
                    {stageOpenId === p.id ? (
                      <div className="absolute left-4 z-20 mt-1 max-h-64 w-64 overflow-y-auto rounded-lg border border-white/[0.1] bg-[#0f131a] py-1 shadow-xl">
                        {PRIVATE_STAGE_ORDER.map((key) => (
                          <button
                            key={key}
                            type="button"
                            className={`block w-full px-3 py-2 text-left text-xs hover:bg-white/[0.06] ${
                              key === p.designStage ? "text-brand-300" : "text-slate-300"
                            }`}
                            onClick={() => void setStage(p.id, key)}
                          >
                            {key === p.designStage ? "✓ " : ""}
                            {PRIVATE_STAGE_LABELS[key]}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-white/[0.08]">
                        <div
                          className="h-full rounded-full bg-brand-500"
                          style={{ width: `${p.progressPercent}%` }}
                        />
                      </div>
                      <span className="tabular-nums text-slate-400">{p.progressPercent}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-slate-300">{zar(p.feeZar)}</td>
                  <td className="px-4 py-3 tabular-nums text-slate-300">
                    {p.marginPercent != null ? `${p.marginPercent}%` : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {editingId === p.id ? (
                      <div className="flex flex-col gap-1.5">
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => void saveEdit(p.id)}
                          className="text-left text-xs font-medium text-brand-300 hover:underline disabled:opacity-50"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={cancelEdit}
                          className="text-left text-xs text-slate-500 hover:text-slate-300 disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1.5">
                        <button
                          type="button"
                          onClick={() => startEdit(p)}
                          className="text-left text-xs text-slate-400 hover:text-brand-300"
                        >
                          Edit
                        </button>
                        <Link
                          href={`/dashboard/private/projects/${p.id}/expenses`}
                          className="text-xs text-brand-300 hover:underline"
                        >
                          Expenses
                        </Link>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
