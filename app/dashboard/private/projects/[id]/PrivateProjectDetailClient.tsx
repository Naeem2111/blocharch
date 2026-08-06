"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PRIVATE_STAGE_LABELS, PRIVATE_STAGE_ORDER, PRIVATE_STAGE_DONE_COPY } from "@/lib/private-constants";

type Detail = {
  project: {
    id: string;
    name: string;
    address: string | null;
    designStage: string;
    designStageLabel: string;
    progressPercent: number;
    feeZar: number;
    costZar: number;
    marginPercent: number | null;
    stageNotes: string | null;
    briefReceivedAt: string | null;
    councilSubmittedAt: string | null;
    stageMeta: {
      stageNumber: number;
      stageCount: number;
      typicalDays: number;
      daysIntoStage: number;
    };
    athlete: { fullName: string; initials: string } | null;
    client: { id: string; name: string; slug: string | null };
    hoursLifeToDate: number | null;
  };
  updates: Array<{ id: string; title: string; body: string | null; occurredAt: string }>;
  actionItems: Array<{ id: string; title: string; completedAt: string | null; clientFacing: boolean }>;
};

function zar(n: number) {
  return `R ${Math.round(n).toLocaleString("en-ZA")}`;
}

export function PrivateProjectDetailClient({ projectId }: { projectId: string }) {
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [notes, setNotes] = useState("");
  const [actionTitle, setActionTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [completingAction, setCompletingAction] = useState<string | null>(null);
  const [editingDetails, setEditingDetails] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [clientName, setClientName] = useState("");

  const load = useCallback(async () => {
    const r = await fetch(`/api/private/projects/${projectId}`);
    const j = await r.json();
    if (!r.ok) {
      setError(j.error || "Not found");
      return;
    }
    setData(j);
    setNotes(j.project.stageNotes ?? "");
    setProjectName(j.project.name);
    setClientName(j.project.client.name);
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveStage(designStage: string) {
    setSaving(true);
    await fetch(`/api/private/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ designStage }),
    });
    setSaving(false);
    void load();
  }

  async function saveNotes() {
    setSaving(true);
    await fetch(`/api/private/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stageNotes: notes }),
    });
    setSaving(false);
    void load();
  }

  async function addAction() {
    if (!actionTitle.trim()) return;
    setSaving(true);
    await fetch(`/api/private/projects/${projectId}/actions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: actionTitle.trim() }),
    });
    setActionTitle("");
    setSaving(false);
    void load();
  }

  async function completeAction(actionItemId: string) {
    setCompletingAction(actionItemId);
    await fetch(`/api/private/projects/${projectId}/actions`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actionItemId, complete: true }),
    });
    setCompletingAction(null);
    void load();
  }

  async function saveDetails() {
    const name = projectName.trim();
    const client = clientName.trim();
    if (!name || !client) {
      setError("Project name and client name are required.");
      return;
    }
    setSaving(true);
    setError("");
    const r = await fetch(`/api/private/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, clientName: client }),
    });
    const j = await r.json();
    setSaving(false);
    if (!r.ok) {
      setError(j.error || "Could not save");
      return;
    }
    setEditingDetails(false);
    void load();
  }

  function cancelDetailsEdit() {
    if (data) {
      setProjectName(data.project.name);
      setClientName(data.project.client.name);
    }
    setEditingDetails(false);
    setError("");
  }

  if (!data) {
    if (error) return <p className="text-sm text-red-300">{error}</p>;
    return <p className="text-sm text-slate-500">Loading…</p>;
  }

  const p = data.project;
  const openActions = data.actionItems.filter((a) => !a.completedAt && a.clientFacing);
  const completedActions = data.actionItems.filter((a) => a.completedAt);

  return (
    <div className="space-y-6">
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/dashboard/private/projects" className="text-xs text-slate-500 hover:text-slate-300">
          ← Projects
        </Link>
        {p.client.slug ? (
          <a
            href={`/private/${p.client.slug}`}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-brand-300 hover:underline"
          >
            Open client portal
          </a>
        ) : null}
        <Link
          href={`/dashboard/private/projects/${projectId}/expenses`}
          className="text-xs text-brand-300 hover:underline"
        >
          Expenses
        </Link>
      </div>

      {openActions.length > 0 ? (
        <div className="rounded-xl bg-amber-500/10 p-5 ring-1 ring-amber-500/25">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-200/80">
              Action needed from client
            </p>
            <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-amber-100">
              {openActions.length}
            </span>
          </div>
          <ul className="mt-3 space-y-2">
            {openActions.map((item, index) => (
              <li
                key={item.id}
                className="flex items-start gap-3 rounded-lg bg-amber-500/5 px-3 py-2.5 ring-1 ring-amber-500/15"
              >
                <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={false}
                    disabled={completingAction === item.id}
                    onChange={() => void completeAction(item.id)}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-amber-400/40 bg-transparent accent-amber-400"
                    aria-label={`Mark "${item.title}" as actioned`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[10px] font-medium uppercase tracking-wider text-amber-200/60">
                      Item {index + 1}
                    </span>
                    <span className="mt-0.5 block text-sm leading-snug text-amber-50">
                      {item.title}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-amber-200/50">
            Tick when the client has actioned an item — it clears from the portal and this list.
          </p>
        </div>
      ) : null}

      <div className="card-tool rounded-xl p-6">
        {editingDetails ? (
          <div className="space-y-4">
            <label className="block text-xs text-slate-400">
              Client name
              <input
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
              />
            </label>
            <label className="block text-xs text-slate-400">
              Project name
              <input
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
              />
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => void saveDetails()}
                className="rounded-lg bg-brand-500/20 px-3 py-1.5 text-xs font-medium text-brand-200 ring-1 ring-brand-500/30 disabled:opacity-50"
              >
                Save
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={cancelDetailsEdit}
                className="rounded-lg px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Client
              </p>
              <p className="mt-1 text-sm text-slate-300">{p.client.name}</p>
              <p className="mt-4 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Project
              </p>
              <h2 className="mt-1 text-lg font-semibold text-white">{p.name}</h2>
            </div>
            <button
              type="button"
              onClick={() => setEditingDetails(true)}
              className="rounded-lg bg-white/[0.04] px-3 py-1.5 text-xs text-slate-300 ring-1 ring-white/[0.08] hover:bg-white/[0.07]"
            >
              Edit
            </button>
          </div>
        )}

        <div className="mt-6">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Overall progress
          </p>
          <p className="mt-1 text-sm text-slate-400">
            Stage {p.stageMeta.stageNumber} of {p.stageMeta.stageCount} · {p.designStageLabel} ·{" "}
            {p.stageMeta.daysIntoStage} days into a typical {p.stageMeta.typicalDays}
          </p>
          <div className="mt-3 flex items-end gap-3">
            <p className="text-4xl font-semibold tabular-nums text-white">{p.progressPercent}%</p>
            <div className="mb-2 h-2 flex-1 overflow-hidden rounded-full bg-white/[0.08]">
              <div
                className="h-full rounded-full bg-brand-500"
                style={{ width: `${p.progressPercent}%` }}
              />
            </div>
          </div>
          {p.designStage === "council_approved" ? (
            <p className="mt-2 text-sm text-slate-400">{PRIVATE_STAGE_DONE_COPY}</p>
          ) : null}
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Fee (excl VAT)</p>
            <p className="mt-1 text-lg tabular-nums text-white">{zar(p.feeZar)}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Cost to date</p>
            <p className="mt-1 text-lg tabular-nums text-white">{zar(p.costZar)}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Margin</p>
            <p className="mt-1 text-lg tabular-nums text-white">
              {p.marginPercent != null ? `${p.marginPercent}%` : "—"}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card-tool rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white">Design stage</h3>
          <select
            className="mt-3 w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
            value={p.designStage}
            disabled={saving}
            onChange={(e) => void saveStage(e.target.value)}
          >
            {PRIVATE_STAGE_ORDER.map((key) => (
              <option key={key} value={key}>
                {PRIVATE_STAGE_LABELS[key]}
              </option>
            ))}
          </select>
          <label className="mt-4 block text-xs text-slate-400">
            Stage notes
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
            />
          </label>
          <button
            type="button"
            disabled={saving}
            onClick={() => void saveNotes()}
            className="mt-2 rounded-lg bg-brand-500/20 px-3 py-1.5 text-xs font-medium text-brand-200 ring-1 ring-brand-500/30"
          >
            Save notes
          </button>
        </section>

        <section className="card-tool rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white">Athlete & dates</h3>
          <p className="mt-3 text-sm text-slate-300">
            {p.athlete ? (
              <>
                <span className="mr-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-brand-500/20 text-[10px] font-bold text-brand-200">
                  {p.athlete.initials}
                </span>
                {p.athlete.fullName}
              </>
            ) : (
              "Unassigned"
            )}
          </p>
          {p.hoursLifeToDate != null ? (
            <p className="mt-2 text-xs text-slate-500">{p.hoursLifeToDate}h logged life-to-date</p>
          ) : null}
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Brief received</dt>
              <dd className="text-slate-300">{p.briefReceivedAt ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Council submitted</dt>
              <dd className="text-slate-300">{p.councilSubmittedAt ?? "—"}</dd>
            </div>
          </dl>
        </section>
      </div>

      <section className="card-tool rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white">Client action items</h3>
        <ul className="mt-3 space-y-2">
          {data.actionItems.filter((a) => !a.completedAt).map((a) => (
            <li key={a.id} className="flex items-start gap-3 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={false}
                disabled={completingAction === a.id}
                onChange={() => void completeAction(a.id)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/20 bg-transparent accent-brand-400"
                aria-label={`Mark "${a.title}" as done`}
              />
              <span className="min-w-0 flex-1">
                {a.title}
                {!a.clientFacing ? (
                  <span className="ml-2 text-[10px] uppercase tracking-wider text-slate-500">
                    Internal
                  </span>
                ) : null}
              </span>
            </li>
          ))}
          {data.actionItems.filter((a) => !a.completedAt).length === 0 ? (
            <li className="text-sm text-slate-500">None open.</li>
          ) : null}
        </ul>
        <div className="mt-3 flex gap-2">
          <input
            value={actionTitle}
            onChange={(e) => setActionTitle(e.target.value)}
            placeholder="e.g. Confirm glazing budget"
            className="flex-1 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
          />
          <button
            type="button"
            disabled={saving}
            onClick={() => void addAction()}
            className="rounded-lg bg-brand-500/20 px-3 py-1.5 text-xs font-medium text-brand-200 ring-1 ring-brand-500/30"
          >
            Add
          </button>
        </div>

        {completedActions.length > 0 ? (
          <details className="mt-4 border-t border-white/[0.06] pt-4">
            <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-300">
              Completed actions ({completedActions.length})
            </summary>
            <ul className="mt-3 space-y-2">
              {completedActions.map((a) => (
                <li
                  key={a.id}
                  className="flex items-start justify-between gap-3 rounded-lg bg-white/[0.02] px-3 py-2 text-sm"
                >
                  <span className="flex min-w-0 items-start gap-2 text-slate-400">
                    <span className="mt-0.5 text-emerald-400" aria-hidden>
                      ✓
                    </span>
                    <span>
                      <span className="line-through decoration-slate-600">{a.title}</span>
                      {!a.clientFacing ? (
                        <span className="ml-2 text-[10px] uppercase tracking-wider text-slate-600">
                          Internal
                        </span>
                      ) : null}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-slate-500">{a.completedAt?.slice(0, 10)}</span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </section>

      <section className="card-tool rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white">Recent updates</h3>
        <ul className="mt-3 space-y-3">
          {data.updates.map((u) => (
            <li key={u.id} className="flex justify-between gap-3 text-sm">
              <div>
                <p className="text-slate-200">{u.title}</p>
                {u.body ? <p className="text-xs text-slate-500">{u.body}</p> : null}
              </div>
              <span className="shrink-0 text-xs text-slate-500">{u.occurredAt}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
