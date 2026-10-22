"use client";

import { useCallback, useEffect, useState } from "react";
import type { OpsCatalogOption } from "@/lib/ops-catalog-types";

type Kind = "phase" | "work_type";

function moveValues(values: string[], fromIndex: number, toIndex: number): string[] {
  if (toIndex < 0 || toIndex >= values.length || fromIndex === toIndex) return values;
  const next = [...values];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}

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
  onReorder,
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
  onReorder: (kind: Kind, values: string[]) => Promise<void>;
}) {
  const [newLabel, setNewLabel] = useState("");
  const [editLabels, setEditLabels] = useState<Record<string, string>>({});
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  useEffect(() => {
    setEditLabels(Object.fromEntries(options.map((o) => [o.value, o.label])));
  }, [options]);

  const field =
    "w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white";
  const reordering = busy === `${kind}:reorder`;
  const values = options.map((option) => option.value);

  function reorder(fromIndex: number, toIndex: number) {
    const next = moveValues(values, fromIndex, toIndex);
    if (next === values) return;
    void onReorder(kind, next);
  }

  return (
    <section className="card-tool rounded-xl p-5">
      <h2 className="text-sm font-semibold text-white">{title}</h2>
      <p className="mt-1 text-xs text-slate-500">{description}</p>
      <ul className="mt-4 space-y-3">
        {options.map((option, index) => {
          const edited = editLabels[option.value] ?? option.label;
          const changed = edited.trim() !== option.label;
          const loadingRow = busy === `${kind}:${option.value}` || reordering;
          return (
            <li
              key={option.value}
              onDragOver={(e) => {
                if (dragIndex == null) return;
                e.preventDefault();
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragIndex == null) return;
                reorder(dragIndex, index);
                setDragIndex(null);
              }}
              className={`flex flex-wrap items-center gap-2 rounded-lg bg-white/[0.03] p-3 ring-1 ring-white/[0.06] ${
                dragIndex === index ? "opacity-50" : ""
              }`}
            >
              <div
                role="button"
                tabIndex={loadingRow ? -1 : 0}
                draggable={!loadingRow}
                aria-label={`Drag ${option.label}`}
                title="Drag to reorder"
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", option.value);
                  setDragIndex(index);
                }}
                onDragEnd={() => setDragIndex(null)}
                className={`cursor-grab select-none px-1 text-slate-500 active:cursor-grabbing ${
                  loadingRow ? "pointer-events-none opacity-40" : ""
                }`}
              >
                ⋮⋮
              </div>
              <div className="flex flex-col">
                <button
                  type="button"
                  aria-label={`Move ${option.label} up`}
                  disabled={loadingRow || index === 0}
                  onClick={() => reorder(index, index - 1)}
                  className="px-1 text-[10px] leading-none text-slate-400 hover:text-white disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label={`Move ${option.label} down`}
                  disabled={loadingRow || index === options.length - 1}
                  onClick={() => reorder(index, index + 1)}
                  className="px-1 text-[10px] leading-none text-slate-400 hover:text-white disabled:opacity-30"
                >
                  ↓
                </button>
              </div>
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

type CatalogSet = "uk" | "private";

export function OpsCatalogClient() {
  const [catalogSet, setCatalogSet] = useState<CatalogSet>("uk");
  const [phases, setPhases] = useState<OpsCatalogOption[]>([]);
  const [workTypes, setWorkTypes] = useState<OpsCatalogOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const query = catalogSet === "private" ? "?set=private" : "";
    const r = await fetch(`/api/ops/catalog${query}`);
    const j = await r.json();
    if (!r.ok) {
      setError(j.error || "Failed to load");
      setLoading(false);
      return;
    }
    setPhases(j.phases || []);
    setWorkTypes(j.workTypes || []);
    setLoading(false);
  }, [catalogSet]);

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
      body: JSON.stringify({ kind, label: trimmed, set: catalogSet }),
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
        set: catalogSet,
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
        set: catalogSet,
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

  async function reorderItems(kind: Kind, values: string[]) {
    const apply = (list: OpsCatalogOption[]) => {
      const byValue = new Map(list.map((option) => [option.value, option]));
      return values.map((value) => byValue.get(value)).filter((option): option is OpsCatalogOption => Boolean(option));
    };
    const previousPhases = phases;
    const previousWorkTypes = workTypes;
    if (kind === "phase") setPhases(apply(phases));
    else setWorkTypes(apply(workTypes));
    setBusy(`${kind}:reorder`);
    setError("");
    const r = await fetch("/api/ops/catalog", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, order: values, set: catalogSet }),
    });
    const j = await r.json().catch(() => ({}));
    setBusy(null);
    if (!r.ok) {
      setPhases(previousPhases);
      setWorkTypes(previousWorkTypes);
      setError(j.error || "Could not reorder");
      return;
    }
    if (Array.isArray(j.phases)) setPhases(j.phases);
    if (Array.isArray(j.workTypes)) setWorkTypes(j.workTypes);
  }

  const privateSet = catalogSet === "private";

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex flex-wrap gap-2" role="tablist" aria-label="Catalog set">
        <button
          type="button"
          role="tab"
          aria-selected={!privateSet}
          onClick={() => {
            setLoading(true);
            setCatalogSet("uk");
          }}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium ring-1 transition-colors ${
            !privateSet
              ? "bg-brand-500/20 text-brand-200 ring-brand-500/30"
              : "bg-white/[0.04] text-slate-400 ring-white/[0.08] hover:bg-white/[0.07]"
          }`}
        >
          UK clients
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={privateSet}
          onClick={() => {
            setLoading(true);
            setCatalogSet("private");
          }}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium ring-1 transition-colors ${
            privateSet
              ? "bg-sky-500/20 text-sky-200 ring-sky-400/30"
              : "bg-white/[0.04] text-slate-400 ring-white/[0.08] hover:bg-white/[0.07]"
          }`}
        >
          Private projects
        </button>
      </div>
      {loading ? <p className="text-sm text-slate-500">Loading catalog…</p> : null}
      {loading ? null : (
        <div className="grid gap-6 lg:grid-cols-2">
          {error ? <p className="text-sm text-red-300 lg:col-span-2">{error}</p> : null}
          <CatalogList
            key={`${catalogSet}-phase`}
            title="Phases / packages"
            description={
              privateSet
                ? "Private-project phases for the daily log, in this order. This list does not change the UK client phases."
                : "Shown on the UK project tracker and daily log, in this order. Drag a row or use the arrows. Built-ins are hidden from pickers when removed."
            }
            addPlaceholder={privateSet ? "e.g. Interior design, Landscaping" : "e.g. Interior package, Measured survey"}
            kind="phase"
            options={phases}
            busy={busy}
            onAdd={addItem}
            onSave={saveItem}
            onRemove={removeItem}
            onReorder={reorderItems}
          />
          <CatalogList
            key={`${catalogSet}-work`}
            title="Work types"
            description={
              privateSet
                ? "Task types athletes pick on private project logs, in this order. This list does not change the UK work types."
                : "Task types athletes pick on the UK daily log, in this order. Drag a row or use the arrows. Built-ins are hidden from pickers when removed."
            }
            addPlaceholder={privateSet ? "e.g. Specification, Site photos" : "e.g. BIM coordination, Site visit"}
            kind="work_type"
            options={workTypes}
            busy={busy}
            onAdd={addItem}
            onSave={saveItem}
            onRemove={removeItem}
            onReorder={reorderItems}
          />
        </div>
      )}
    </div>
  );
}
