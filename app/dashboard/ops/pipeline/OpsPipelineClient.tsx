"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { OpsProjectPhase } from "@prisma/client";
import Link from "next/link";
import { ClientAvatar } from "@/components/ops/ClientAvatar";
import { asAvatarTextTone } from "@/lib/avatar-text-tone";
import { OPS_PROJECT_STAGE_OPTIONS } from "@/lib/ops-constants";

type ClientOption = {
  id: string;
  name: string;
  logoUrl: string | null;
  logoBgColor: string | null;
  logoTextTone: string | null;
};

type AthleteOption = { id: string; fullName: string; athleteCode: string };

type PipelineRow = {
  id: string;
  clientId: string;
  clientName: string;
  clientLogoUrl: string | null;
  clientLogoBgColor: string | null;
  clientLogoTextTone: string | null;
  name: string;
  address: string | null;
  description: string | null;
  expectedStage: OpsProjectPhase | null;
  expectedStageLabel: string | null;
  targetStartDate: string | null;
  targetDueDate: string | null;
  notes: string | null;
  visibleToClient: boolean;
  convertedProjectId: string | null;
  convertedAt: string | null;
};

const emptyForm = {
  clientId: "",
  name: "",
  address: "",
  description: "",
  expectedStage: "survey_conversion",
  targetStartDate: "",
  targetDueDate: "",
  notes: "",
  visibleToClient: true,
};

const inputClass =
  "mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white";

export function OpsPipelineClient() {
  const [rows, setRows] = useState<PipelineRow[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [athletes, setAthletes] = useState<AthleteOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [clientFilterId, setClientFilterId] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [convertId, setConvertId] = useState<string | null>(null);
  const [convertForm, setConvertForm] = useState({
    assignedAthleteIds: [] as string[],
    primaryAthleteId: "",
    projectNumber: "",
    complexity: "medium",
  });
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const qs = clientFilterId ? `?clientId=${encodeURIComponent(clientFilterId)}` : "";
    const [pr, cr, ar] = await Promise.all([
      fetch(`/api/ops/pipeline${qs}`),
      fetch("/api/ops/clients"),
      fetch("/api/ops/athletes"),
    ]);
    const pj = await pr.json();
    const cj = await cr.json();
    const aj = await ar.json();
    if (pr.ok) setRows(pj.pipeline || []);
    if (cr.ok) setClients(cj.clients || []);
    if (ar.ok) {
      setAthletes(
        (aj.athletes || []).map((a: AthleteOption) => ({
          id: a.id,
          fullName: a.fullName,
          athleteCode: a.athleteCode,
        }))
      );
    }
    setLoading(false);
  }, [clientFilterId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => rows, [rows]);

  async function createPipeline(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const r = await fetch("/api/ops/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const j = await r.json();
      if (!r.ok) {
        setError(j.error || "Could not add pipeline project");
        return;
      }
      setOpen(false);
      setForm(emptyForm);
      setMsg("Pipeline project added.");
      await load();
    } finally {
      setSaving(false);
    }
  }

  function startEdit(row: PipelineRow) {
    setEditingId(row.id);
    setEditForm({
      clientId: row.clientId,
      name: row.name,
      address: row.address ?? "",
      description: row.description ?? "",
      expectedStage: row.expectedStage ?? "survey_conversion",
      targetStartDate: row.targetStartDate ?? "",
      targetDueDate: row.targetDueDate ?? "",
      notes: row.notes ?? "",
      visibleToClient: row.visibleToClient,
    });
    setError("");
  }

  async function saveEdit(id: string) {
    setSaving(true);
    setError("");
    try {
      const r = await fetch(`/api/ops/pipeline/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const j = await r.json();
      if (!r.ok) {
        setError(j.error || "Could not save");
        return;
      }
      setEditingId(null);
      setMsg("Pipeline updated.");
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function deleteRow(id: string, name: string) {
    if (!window.confirm(`Remove "${name}" from the pipeline?`)) return;
    const r = await fetch(`/api/ops/pipeline/${encodeURIComponent(id)}`, { method: "DELETE" });
    const j = await r.json();
    if (!r.ok) {
      setError(j.error || "Could not delete");
      return;
    }
    setMsg("Pipeline item removed.");
    await load();
  }

  function openConvert(row: PipelineRow) {
    setConvertId(row.id);
    setConvertForm({
      assignedAthleteIds: [],
      primaryAthleteId: "",
      projectNumber: "",
      complexity: "medium",
    });
    setError("");
  }

  function toggleConvertAthlete(athleteId: string, checked: boolean) {
    setConvertForm((f) => {
      const nextIds = checked
        ? Array.from(new Set([...f.assignedAthleteIds, athleteId]))
        : f.assignedAthleteIds.filter((id) => id !== athleteId);
      let primary = f.primaryAthleteId;
      if (!checked && primary === athleteId) primary = nextIds[0] ?? "";
      if (checked && nextIds.length === 1) primary = athleteId;
      const code = athletes.find((a) => a.id === primary)?.athleteCode ?? f.projectNumber;
      return {
        ...f,
        assignedAthleteIds: nextIds,
        primaryAthleteId: primary,
        projectNumber: code || f.projectNumber,
      };
    });
  }

  async function confirmConvert() {
    if (!convertId) return;
    if (convertForm.assignedAthleteIds.length === 0) {
      setError("Select at least one athlete");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const r = await fetch(`/api/ops/pipeline/${encodeURIComponent(convertId)}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignedAthleteIds: convertForm.assignedAthleteIds,
          primaryAthleteId: convertForm.primaryAthleteId,
          projectNumber: convertForm.projectNumber,
          complexity: convertForm.complexity,
        }),
      });
      const j = await r.json();
      if (!r.ok) {
        setError(j.error || "Could not convert");
        return;
      }
      setConvertId(null);
      setMsg("Promoted to live project.");
      await load();
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-slate-500">Loading pipeline…</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="text-xs text-slate-400">
          Client / firm
          <select
            value={clientFilterId}
            onChange={(e) => setClientFilterId(e.target.value)}
            className="select-console mt-1 block min-w-[14rem] rounded-md px-3 py-2 text-sm"
          >
            <option value="">All clients</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setForm({ ...emptyForm, clientId: clientFilterId || "" });
          }}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-brand-500"
        >
          Add pipeline project
        </button>
      </div>

      {msg ? <p className="text-sm text-brand-300">{msg}</p> : null}
      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      {open ? (
        <form onSubmit={createPipeline} className="card-tool grid gap-3 rounded-xl p-4 md:grid-cols-2">
          <label className="text-xs text-slate-400 md:col-span-2">
            Client <span className="text-red-400">*</span>
            <select
              required
              value={form.clientId}
              onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value }))}
              className="select-console mt-1 block w-full rounded-md px-3 py-2 text-sm"
            >
              <option value="">Select client</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-slate-400 md:col-span-2">
            Project name <span className="text-red-400">*</span>
            <input
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className={inputClass}
            />
          </label>
          <label className="text-xs text-slate-400 md:col-span-2">
            Address
            <input
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              className={inputClass}
            />
          </label>
          <label className="text-xs text-slate-400 md:col-span-2">
            Client-visible description (meeting scope)
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={3}
              className={inputClass}
            />
          </label>
          <label className="text-xs text-slate-400">
            Expected stage
            <select
              value={form.expectedStage}
              onChange={(e) => setForm((f) => ({ ...f, expectedStage: e.target.value }))}
              className="select-console mt-1 block w-full rounded-md px-3 py-2 text-sm"
            >
              {OPS_PROJECT_STAGE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-slate-400">
            Target start
            <input
              type="date"
              value={form.targetStartDate}
              onChange={(e) => setForm((f) => ({ ...f, targetStartDate: e.target.value }))}
              className={inputClass}
            />
          </label>
          <label className="text-xs text-slate-400">
            Target due
            <input
              type="date"
              value={form.targetDueDate}
              onChange={(e) => setForm((f) => ({ ...f, targetDueDate: e.target.value }))}
              className={inputClass}
            />
          </label>
          <label className="text-xs text-slate-400 md:col-span-2">
            Internal notes
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={2}
              className={inputClass}
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-400 md:col-span-2">
            <input
              type="checkbox"
              checked={form.visibleToClient}
              onChange={(e) => setForm((f) => ({ ...f, visibleToClient: e.target.checked }))}
            />
            Visible on client portal (upcoming pipeline)
          </label>
          <div className="flex gap-2 md:col-span-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Add to pipeline"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg px-4 py-2 text-sm text-slate-400 hover:text-white"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {filtered.length === 0 ? (
        <p className="text-sm text-slate-500">No upcoming pipeline projects yet.</p>
      ) : (
        <ul className="space-y-3">
          {filtered.map((row) => (
            <li key={row.id} className="card-tool rounded-xl p-4">
              {editingId === row.id ? (
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="text-xs text-slate-400 md:col-span-2">
                    Name
                    <input
                      value={editForm.name}
                      onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                      className={inputClass}
                    />
                  </label>
                  <label className="text-xs text-slate-400 md:col-span-2">
                    Description
                    <textarea
                      value={editForm.description}
                      onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                      rows={2}
                      className={inputClass}
                    />
                  </label>
                  <label className="text-xs text-slate-400">
                    Target due
                    <input
                      type="date"
                      value={editForm.targetDueDate}
                      onChange={(e) => setEditForm((f) => ({ ...f, targetDueDate: e.target.value }))}
                      className={inputClass}
                    />
                  </label>
                  <label className="flex items-end gap-2 pb-2 text-xs text-slate-400">
                    <input
                      type="checkbox"
                      checked={editForm.visibleToClient}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, visibleToClient: e.target.checked }))
                      }
                    />
                    Visible on client portal
                  </label>
                  <div className="flex gap-2 md:col-span-2">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void saveEdit(row.id)}
                      className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-slate-950"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="text-xs text-slate-400"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <ClientAvatar
                        name={row.clientName}
                        logoUrl={row.clientLogoUrl}
                        backgroundColor={row.clientLogoBgColor}
                        textTone={asAvatarTextTone(row.clientLogoTextTone)}
                        size={24}
                      />
                      <span className="text-xs text-slate-500">{row.clientName}</span>
                    </div>
                    <h3 className="mt-1 font-semibold text-white">{row.name}</h3>
                    {row.address ? <p className="mt-0.5 text-xs text-slate-500">{row.address}</p> : null}
                    {row.description ? (
                      <p className="mt-2 text-sm text-slate-400">{row.description}</p>
                    ) : null}
                    <p className="mt-2 text-xs text-slate-500">
                      {row.expectedStageLabel ? `${row.expectedStageLabel} · ` : ""}
                      {row.targetDueDate ? `Target due ${row.targetDueDate}` : "No target due date"}
                      {!row.visibleToClient ? " · Hidden from client" : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(row)}
                      className="text-xs text-brand-300 hover:text-brand-200"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => openConvert(row)}
                      className="rounded-md border border-brand-500/30 bg-brand-500/10 px-2 py-1 text-xs font-medium text-brand-200"
                    >
                      → Projects
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteRow(row.id, row.name)}
                      className="text-xs text-red-400/90 hover:text-red-300"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {convertId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="modal-panel w-full max-w-md rounded-2xl border border-white/[0.1] bg-slate-900 p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-white">Promote to project</h3>
            <p className="mt-1 text-xs text-slate-500">
              Creates a live project in the operations tracker and removes this item from the pipeline.
            </p>
            <div className="mt-4 max-h-40 space-y-1 overflow-y-auto rounded-md border border-white/[0.08] p-2">
              {athletes.map((a) => {
                const checked = convertForm.assignedAthleteIds.includes(a.id);
                return (
                  <label key={a.id} className="flex cursor-pointer items-center gap-2 text-sm text-slate-200">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => toggleConvertAthlete(a.id, e.target.checked)}
                    />
                    <span className="flex-1">{a.fullName}</span>
                    {checked ? (
                      <input
                        type="radio"
                        name="pipeline-primary"
                        checked={convertForm.primaryAthleteId === a.id}
                        onChange={() =>
                          setConvertForm((f) => ({
                            ...f,
                            primaryAthleteId: a.id,
                            projectNumber: a.athleteCode,
                          }))
                        }
                      />
                    ) : null}
                  </label>
                );
              })}
            </div>
            <label className="mt-3 block text-xs text-slate-400">
              Project number
              <input
                value={convertForm.projectNumber}
                onChange={(e) => setConvertForm((f) => ({ ...f, projectNumber: e.target.value }))}
                className={inputClass}
              />
            </label>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConvertId(null)}
                className="rounded-lg px-4 py-2 text-sm text-slate-400"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void confirmConvert()}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
              >
                {saving ? "Creating…" : "Create project"}
              </button>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              After conversion, open{" "}
              <Link href="/dashboard/ops/projects" className="text-brand-300 hover:underline">
                Project operations tracker
              </Link>
              .
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
