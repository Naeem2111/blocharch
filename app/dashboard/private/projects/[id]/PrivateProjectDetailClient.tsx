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
    phaseGroups: Array<{
      id: string;
      name: string;
      feeZar: number;
      costZar: number;
      stages: Array<{
        stage: string;
        label: string;
        status: "completed" | "current" | "upcoming";
        feePercent: number;
        costPercent: number;
        feeZar: number;
        costZar: number;
      }>;
    }>;
    phases: Array<{
      stage: string;
      label: string;
      status: "completed" | "current" | "upcoming";
      feePercent: number;
      costPercent: number;
      feeZar: number;
      costZar: number;
    }>;
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
  const [itemLoading, setItemLoading] = useState<string | null>(null);
  const [editTitles, setEditTitles] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const r = await fetch(`/api/private/projects/${projectId}`);
    const j = await r.json();
    if (!r.ok) {
      setError(j.error || "Not found");
      return;
    }
    setData(j);
    setNotes(j.project.stageNotes ?? "");
    const titles: Record<string, string> = {};
    for (const a of (j.actionItems as Detail["actionItems"]).filter((x) => !x.completedAt)) {
      titles[a.id] = a.title;
    }
    setEditTitles(titles);
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

  async function saveActionTitle(actionItemId: string) {
    const original = data?.actionItems.find((a) => a.id === actionItemId)?.title;
    const title = editTitles[actionItemId]?.trim();
    if (!title) return;
    if (title === original) return;
    setItemLoading(actionItemId);
    await fetch(`/api/private/projects/${projectId}/actions`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actionItemId, title }),
    });
    setItemLoading(null);
    void load();
  }

  async function removeAction(actionItemId: string) {
    if (!confirm("Remove this action item?")) return;
    setItemLoading(actionItemId);
    await fetch(`/api/private/projects/${projectId}/actions`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actionItemId }),
    });
    setItemLoading(null);
    void load();
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
        <Link
          href={`/dashboard/private/projects/${projectId}/edit`}
          className="text-xs text-brand-300 hover:underline"
        >
          Edit project
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

        {p.phaseGroups?.length ? (
          <div className="mt-6 space-y-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Phases & stage billing
            </p>
            {p.phaseGroups.map((group) => (
              <div key={group.id} className="rounded-lg bg-white/[0.03] p-3 ring-1 ring-white/[0.06]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-white">{group.name}</p>
                  <p className="text-xs tabular-nums text-slate-500">
                    {zar(group.feeZar)} fee · {zar(group.costZar)} expenses
                  </p>
                </div>
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full min-w-[32rem] text-left text-sm">
                    <thead>
                      <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-wider text-slate-500">
                        <th className="pb-2 pr-3 font-semibold">Stage</th>
                        <th className="pb-2 pr-3 font-semibold">Status</th>
                        <th className="pb-2 pr-3 font-semibold">Fee</th>
                        <th className="pb-2 font-semibold">Expenses</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.stages.map((row) => (
                        <tr key={row.stage} className="border-b border-white/[0.04]">
                          <td className="py-2 pr-3 text-slate-200">{row.label}</td>
                          <td className="py-2 pr-3 capitalize text-slate-400">{row.status}</td>
                          <td className="py-2 pr-3 tabular-nums text-slate-300">
                            {zar(row.feeZar)}{" "}
                            <span className="text-slate-500">({row.feePercent}%)</span>
                          </td>
                          <td className="py-2 tabular-nums text-slate-300">
                            {zar(row.costZar)}{" "}
                            <span className="text-slate-500">({row.costPercent}%)</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        ) : p.phases?.length ? (
          <div className="mt-6">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Phase breakdown
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[36rem] text-left text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-wider text-slate-500">
                    <th className="pb-2 pr-3 font-semibold">Phase</th>
                    <th className="pb-2 pr-3 font-semibold">Status</th>
                    <th className="pb-2 pr-3 font-semibold">Fee</th>
                    <th className="pb-2 font-semibold">Expenses</th>
                  </tr>
                </thead>
                <tbody>
                  {p.phases.map((row) => (
                    <tr key={row.stage} className="border-b border-white/[0.04]">
                      <td className="py-2 pr-3 text-slate-200">{row.label}</td>
                      <td className="py-2 pr-3 capitalize text-slate-400">{row.status}</td>
                      <td className="py-2 pr-3 tabular-nums text-slate-300">
                        {zar(row.feeZar)}{" "}
                        <span className="text-slate-500">({row.feePercent}%)</span>
                      </td>
                      <td className="py-2 tabular-nums text-slate-300">
                        {zar(row.costZar)}{" "}
                        <span className="text-slate-500">({row.costPercent}%)</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
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
          {data.actionItems.filter((a) => !a.completedAt).map((a) => {
            const loading = itemLoading === a.id || completingAction === a.id;
            const originalTitle = a.title;
            const editedTitle = editTitles[a.id] ?? a.title;
            const titleChanged = editedTitle.trim() !== originalTitle;
            return (
              <li key={a.id} className="flex items-start gap-3 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={false}
                  disabled={loading}
                  onChange={() => void completeAction(a.id)}
                  className="mt-2 h-4 w-4 shrink-0 rounded border-white/20 bg-transparent accent-brand-400"
                  aria-label={`Mark "${a.title}" as done`}
                />
                <div className="min-w-0 flex-1 space-y-2">
                  <input
                    value={editedTitle}
                    disabled={loading}
                    onChange={(e) =>
                      setEditTitles((prev) => ({ ...prev, [a.id]: e.target.value }))
                    }
                    onBlur={() => {
                      if (titleChanged) void saveActionTitle(a.id);
                    }}
                    className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-sm text-white"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    {!a.clientFacing ? (
                      <span className="text-[10px] uppercase tracking-wider text-slate-500">
                        Internal
                      </span>
                    ) : null}
                    {titleChanged ? (
                      <button
                        type="button"
                        disabled={loading || !editedTitle.trim()}
                        onClick={() => void saveActionTitle(a.id)}
                        className="rounded bg-brand-500/20 px-2 py-0.5 text-[10px] font-medium text-brand-200 ring-1 ring-brand-500/30 disabled:opacity-50"
                      >
                        {loading ? "Saving…" : "Save"}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => void removeAction(a.id)}
                      className="rounded px-2 py-0.5 text-[10px] font-medium text-red-300/80 ring-1 ring-red-500/20 hover:bg-red-500/10 disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
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
