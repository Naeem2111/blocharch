"use client";

import { useCallback, useEffect, useState } from "react";
import type { PrivateProjectTypeOption } from "@/lib/private-project-types";

export function PrivateProjectTypesClient() {
  const [types, setTypes] = useState<PrivateProjectTypeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [editLabels, setEditLabels] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const r = await fetch("/api/private/project-types");
    const j = await r.json();
    if (!r.ok) {
      setError(j.error || "Failed to load");
      setLoading(false);
      return;
    }
    const rows: PrivateProjectTypeOption[] = j.types || [];
    setTypes(rows);
    setEditLabels(Object.fromEntries(rows.map((t) => [t.value, t.label])));
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function addType() {
    const label = newLabel.trim();
    if (!label) return;
    setBusy("add");
    setError("");
    const r = await fetch("/api/private/project-types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label }),
    });
    const j = await r.json();
    setBusy(null);
    if (!r.ok) {
      setError(j.error || "Could not add type");
      return;
    }
    setNewLabel("");
    void load();
  }

  async function saveType(type: PrivateProjectTypeOption) {
    const label = editLabels[type.value]?.trim();
    if (!label || label === type.label) return;
    setBusy(type.value);
    setError("");
    const r = await fetch("/api/private/project-types", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: type.id ?? undefined,
        builtInKey: type.builtInKey ?? undefined,
        label,
      }),
    });
    const j = await r.json();
    setBusy(null);
    if (!r.ok) {
      setError(j.error || "Could not save type");
      return;
    }
    void load();
  }

  async function removeType(type: PrivateProjectTypeOption) {
    if (!type.id || type.isBuiltIn) return;
    if (!confirm(`Remove “${type.label}” from the project type list?`)) return;
    setBusy(type.value);
    setError("");
    const r = await fetch("/api/private/project-types", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: type.id }),
    });
    const j = await r.json();
    setBusy(null);
    if (!r.ok) {
      setError(j.error || "Could not remove type");
      return;
    }
    void load();
  }

  const field =
    "w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white";

  if (loading) return <p className="text-sm text-slate-500">Loading project types…</p>;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      <section className="card-tool rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white">Type list</h2>
        <p className="mt-1 text-xs text-slate-500">
          Built-in types can be renamed. Custom types can be added or removed when not in use.
        </p>
        <ul className="mt-4 space-y-3">
          {types.map((type) => {
            const edited = editLabels[type.value] ?? type.label;
            const changed = edited.trim() !== type.label;
            const loadingRow = busy === type.value;
            return (
              <li
                key={type.value}
                className="flex flex-wrap items-center gap-2 rounded-lg bg-white/[0.03] p-3 ring-1 ring-white/[0.06]"
              >
                <input
                  value={edited}
                  disabled={loadingRow}
                  onChange={(e) =>
                    setEditLabels((prev) => ({ ...prev, [type.value]: e.target.value }))
                  }
                  className={`min-w-[12rem] flex-1 ${field}`}
                />
                {type.isBuiltIn ? (
                  <span className="text-[10px] uppercase tracking-wider text-slate-500">Built-in</span>
                ) : null}
                {changed ? (
                  <button
                    type="button"
                    disabled={loadingRow || !edited.trim()}
                    onClick={() => void saveType(type)}
                    className="rounded bg-brand-500/20 px-2 py-1 text-[10px] font-medium text-brand-200 ring-1 ring-brand-500/30 disabled:opacity-50"
                  >
                    Save
                  </button>
                ) : null}
                {!type.isBuiltIn ? (
                  <button
                    type="button"
                    disabled={loadingRow}
                    onClick={() => void removeType(type)}
                    className="rounded px-2 py-1 text-[10px] font-medium text-red-300/80 ring-1 ring-red-500/20 hover:bg-red-500/10 disabled:opacity-50"
                  >
                    Remove
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="card-tool rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white">Add project type</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="e.g. Pool house, Renovation"
            className={`min-w-[14rem] flex-1 ${field}`}
          />
          <button
            type="button"
            disabled={busy === "add" || !newLabel.trim()}
            onClick={() => void addType()}
            className="rounded-lg bg-brand-500/20 px-3 py-2 text-xs font-medium text-brand-200 ring-1 ring-brand-500/30 disabled:opacity-50"
          >
            {busy === "add" ? "Adding…" : "Add type"}
          </button>
        </div>
      </section>
    </div>
  );
}
