"use client";

import { useCallback, useEffect, useState } from "react";
import type { OpsCatalogOption } from "@/lib/ops-catalog-types";

type Kind = "phase" | "work_type";

function CatalogList({
  title,
  description,
  addPlaceholder,
  kind,
  options,
  busy,
  onAdd,
  onSave,
  onRemove,
}: {
  title: string;
  description: string;
  addPlaceholder: string;
  kind: Kind;
  options: OpsCatalogOption[];
  busy: string | null;
  onAdd: (kind: Kind, label: string) => Promise<void>;
  onSave: (kind: Kind, option: OpsCatalogOption, label: string) => Promise<void>;
  onRemove: (kind: Kind, option: OpsCatalogOption) => Promise<void>;
}) {
  const [newLabel, setNewLabel] = useState("");
  const [editLabels, setEditLabels] = useState<Record<string, string>>({});

  useEffect(() => {
    setEditLabels(Object.fromEntries(options.map((o) => [o.value, o.label])));
  }, [options]);

  const field =
    "w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white";

  return (
    <section className="card-tool rounded-xl p-5">
      <h2 className="text-sm font-semibold text-white">{title}</h2>
      <p className="mt-1 text-xs text-slate-500">{description}</p>
      <ul className="mt-4 space-y-3">
        {options.map((option) => {
          const edited = editLabels[option.value] ?? option.label;
          const changed = edited.trim() !== option.label;
          const loadingRow = busy === `${kind}:${option.value}`;
          return (
            <li
              key={option.value}
              className="flex flex-wrap items-center gap-2 rounded-lg bg-white/[0.03] p-3 ring-1 ring-white/[0.06]"
            >
              <input
                value={edited}
                disabled={loadingRow}
                onChange={(e) =>
                  setEditLabels((prev) => ({ ...prev, [option.value]: e.target.value }))
                }
                className={`min-w-[12rem] flex-1 ${field}`}
              />
              {option.isBuiltIn ? (
                <span className="text-[10px] uppercase tracking-wider text-slate-500">Built-in</span>
              ) : null}
              {changed ? (
                <button
                  type="button"
                  disabled={loadingRow || !edited.trim()}
                  onClick={() => void onSave(kind, option, edited)}
                  className="rounded bg-brand-500/20 px-2 py-1 text-[10px] font-medium text-brand-200 ring-1 ring-brand-500/30 disabled:opacity-50"
                >
                  Save
                </button>
              ) : null}
              <button
                type="button"
                disabled={loadingRow}
                onClick={() => void onRemove(kind, option)}
                className="rounded px-2 py-1 text-[10px] font-medium text-red-300/80 ring-1 ring-red-500/20 hover:bg-red-500/10 disabled:opacity-50"
              >
                Remove
              </button>
            </li>
          );
        })}
      </ul>
      <div className="mt-4 flex flex-wrap gap-2">
        <input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder={addPlaceholder}
          className={`min-w-[14rem] flex-1 ${field}`}
        />
        <button
          type="button"
          disabled={busy === `${kind}:add` || !newLabel.trim()}
          onClick={async () => {
            await onAdd(kind, newLabel);
            setNewLabel("");
          }}
          className="rounded-lg bg-brand-500/20 px-3 py-2 text-xs font-medium text-brand-200 ring-1 ring-brand-500/30 disabled:opacity-50"
        >
          {busy === `${kind}:add` ? "Adding…" : "Add"}
        </button>
      </div>
    </section>
  );
}

export function OpsCatalogClient() {
  const [phases, setPhases] = useState<OpsCatalogOption[]>([]);
  const [workTypes, setWorkTypes] = useState<OpsCatalogOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const r = await fetch("/api/ops/catalog");
    const j = await r.json();
    if (!r.ok) {
      setError(j.error || "Failed to load");
      setLoading(false);
      return;
    }
    setPhases(j.phases || []);
    setWorkTypes(j.workTypes || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function addItem(kind: Kind, label: string) {
    const trimmed = label.trim();
    if (!trimmed) return;
    setBusy(`${kind}:add`);
    setError("");
    const r = await fetch("/api/ops/catalog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, label: trimmed }),
    });
    const j = await r.json();
    setBusy(null);
    if (!r.ok) {
      setError(j.error || "Could not add");
      return;
    }
    void load();
  }

  async function saveItem(kind: Kind, option: OpsCatalogOption, label: string) {
    const trimmed = label.trim();
    if (!trimmed || trimmed === option.label) return;
    setBusy(`${kind}:${option.value}`);
    setError("");
    const r = await fetch("/api/ops/catalog", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind,
        id: option.id,
        builtInKey: option.builtInKey,
        label: trimmed,
      }),
    });
    const j = await r.json();
    setBusy(null);
    if (!r.ok) {
      setError(j.error || "Could not save");
      return;
    }
    void load();
  }

  async function removeItem(kind: Kind, option: OpsCatalogOption) {
    const verb = option.isBuiltIn ? "Hide" : "Remove";
    if (!confirm(`${verb} “${option.label}”?${option.isBuiltIn ? " It will no longer appear in project and daily-log pickers." : ""}`)) {
      return;
    }
    setBusy(`${kind}:${option.value}`);
    setError("");
    const r = await fetch("/api/ops/catalog", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind,
        id: option.id,
        builtInKey: option.builtInKey,
      }),
    });
    const j = await r.json();
    setBusy(null);
    if (!r.ok) {
      setError(j.error || "Could not remove");
      return;
    }
    void load();
  }

  if (loading) return <p className="text-sm text-slate-500">Loading catalog…</p>;

  return (
    <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-2">
      {error ? <p className="text-sm text-red-300 lg:col-span-2">{error}</p> : null}
      <CatalogList
        title="Phases / packages"
        description="Shown on the project tracker and daily log. Rename, add custom packages, or remove any option (built-ins are hidden from pickers)."
        addPlaceholder="e.g. Interior package, Measured survey"
        kind="phase"
        options={phases}
        busy={busy}
        onAdd={addItem}
        onSave={saveItem}
        onRemove={removeItem}
      />
      <CatalogList
        title="Work types"
        description="Task types athletes pick on the daily log. Rename, add custom types, or remove any option (built-ins are hidden from pickers)."
        addPlaceholder="e.g. BIM coordination, Site visit"
        kind="work_type"
        options={workTypes}
        busy={busy}
        onAdd={addItem}
        onSave={saveItem}
        onRemove={removeItem}
      />
    </div>
  );
}
