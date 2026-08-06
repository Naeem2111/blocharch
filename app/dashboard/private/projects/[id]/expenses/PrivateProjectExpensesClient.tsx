"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PRIVATE_STAGE_LABELS, PRIVATE_STAGE_ORDER } from "@/lib/private-constants";
import type { PrivateDesignStage } from "@prisma/client";

type ExpenseRow = {
  id: string;
  description: string;
  amountZar: number;
  expenseDate: string;
  designStage: string | null;
  notes: string | null;
};

type ExpenseDraft = {
  description: string;
  amountZar: string;
  expenseDate: string;
  designStage: string;
  notes: string;
};

function zar(n: number) {
  return `R ${Math.round(n).toLocaleString("en-ZA")}`;
}

function expenseDraft(e: ExpenseRow): ExpenseDraft {
  return {
    description: e.description,
    amountZar: String(e.amountZar),
    expenseDate: e.expenseDate,
    designStage: e.designStage ?? "",
    notes: e.notes ?? "",
  };
}

function expenseChanged(original: ExpenseRow, draft: ExpenseDraft): boolean {
  return (
    draft.description.trim() !== original.description ||
    draft.expenseDate !== original.expenseDate ||
    draft.designStage !== (original.designStage ?? "") ||
    draft.notes.trim() !== (original.notes ?? "") ||
    Number(draft.amountZar) !== original.amountZar
  );
}

export function PrivateProjectExpensesClient({ projectId }: { projectId: string }) {
  const [projectName, setProjectName] = useState("");
  const [defaultStage, setDefaultStage] = useState<PrivateDesignStage>("site_measure_up");
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [totalZar, setTotalZar] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [itemLoading, setItemLoading] = useState<string | null>(null);
  const [editDrafts, setEditDrafts] = useState<Record<string, ExpenseDraft>>({});
  const [description, setDescription] = useState("");
  const [amountZar, setAmountZar] = useState("");
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [designStage, setDesignStage] = useState<PrivateDesignStage>("site_measure_up");

  const load = useCallback(async () => {
    const r = await fetch(`/api/private/projects/${projectId}/expenses`);
    const j = await r.json();
    if (!r.ok) {
      setError(j.error || "Not found");
      setLoading(false);
      return;
    }
    setProjectName(j.project.name);
    if (j.project.designStage) {
      setDefaultStage(j.project.designStage);
      setDesignStage((prev) => prev || j.project.designStage);
    }
    const rows: ExpenseRow[] = j.expenses || [];
    setExpenses(rows);
    setEditDrafts(Object.fromEntries(rows.map((e) => [e.id, expenseDraft(e)])));
    setTotalZar(j.totalZar ?? 0);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function addExpense() {
    if (!description.trim() || !amountZar.trim()) return;
    setSaving(true);
    setError("");
    const r = await fetch(`/api/private/projects/${projectId}/expenses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: description.trim(),
        amountZar: Number(amountZar),
        expenseDate,
        designStage,
      }),
    });
    const j = await r.json();
    setSaving(false);
    if (!r.ok) {
      setError(j.error || "Could not add expense");
      return;
    }
    setDescription("");
    setAmountZar("");
    void load();
  }

  async function saveExpense(expenseId: string) {
    const original = expenses.find((e) => e.id === expenseId);
    const draft = editDrafts[expenseId];
    if (!original || !draft) return;
    if (!expenseChanged(original, draft)) return;
    if (!draft.description.trim()) {
      setError("Description is required.");
      return;
    }
    const amount = Number(draft.amountZar);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Valid amount is required.");
      return;
    }

    setItemLoading(expenseId);
    setError("");
    const r = await fetch(`/api/private/projects/${projectId}/expenses`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        expenseId,
        description: draft.description.trim(),
        amountZar: amount,
        expenseDate: draft.expenseDate,
        designStage: draft.designStage || null,
        notes: draft.notes.trim() || null,
      }),
    });
    const j = await r.json();
    setItemLoading(null);
    if (!r.ok) {
      setError(j.error || "Could not save expense");
      return;
    }
    void load();
  }

  async function removeExpense(expenseId: string) {
    if (!confirm("Remove this expense?")) return;
    setItemLoading(expenseId);
    setError("");
    const r = await fetch(`/api/private/projects/${projectId}/expenses`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expenseId }),
    });
    const j = await r.json();
    setItemLoading(null);
    if (!r.ok) {
      setError(j.error || "Could not remove expense");
      return;
    }
    void load();
  }

  const field =
    "w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-sm text-white";

  if (loading) return <p className="text-sm text-slate-500">Loading expenses…</p>;
  if (error && !projectName) return <p className="text-sm text-red-300">{error}</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={`/dashboard/private/projects/${projectId}`}
          className="text-xs text-slate-500 hover:text-slate-300"
        >
          ← Project record
        </Link>
        <Link href="/dashboard/private/projects" className="text-xs text-slate-500 hover:text-slate-300">
          All projects
        </Link>
      </div>

      <div className="card-tool rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white">{projectName}</h2>
        <p className="mt-1 text-sm text-slate-400">Project expenses</p>
        <p className="mt-4 text-2xl font-semibold tabular-nums text-white">{zar(totalZar)}</p>
        <p className="text-xs text-slate-500">{expenses.length} expense{expenses.length === 1 ? "" : "s"} recorded · assign each to a phase for cost breakdown</p>
      </div>

      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      <div className="space-y-3">
        {expenses.length === 0 ? (
          <p className="text-sm text-slate-500">No expenses recorded yet.</p>
        ) : (
          expenses.map((e) => {
            const draft = editDrafts[e.id] ?? expenseDraft(e);
            const changed = expenseChanged(e, draft);
            const busy = itemLoading === e.id;

            return (
              <div key={e.id} className="card-tool rounded-xl p-4">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <label className="block text-xs text-slate-400">
                    Date
                    <input
                      type="date"
                      disabled={busy}
                      value={draft.expenseDate}
                      onChange={(ev) =>
                        setEditDrafts((prev) => ({
                          ...prev,
                          [e.id]: { ...draft, expenseDate: ev.target.value },
                        }))
                      }
                      className={`mt-1 ${field}`}
                    />
                  </label>
                  <label className="block text-xs text-slate-400 sm:col-span-2">
                    Description
                    <input
                      disabled={busy}
                      value={draft.description}
                      onChange={(ev) =>
                        setEditDrafts((prev) => ({
                          ...prev,
                          [e.id]: { ...draft, description: ev.target.value },
                        }))
                      }
                      className={`mt-1 ${field}`}
                    />
                  </label>
                  <label className="block text-xs text-slate-400">
                    Amount (ZAR)
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      disabled={busy}
                      value={draft.amountZar}
                      onChange={(ev) =>
                        setEditDrafts((prev) => ({
                          ...prev,
                          [e.id]: { ...draft, amountZar: ev.target.value },
                        }))
                      }
                      className={`mt-1 ${field}`}
                    />
                  </label>
                  <label className="block text-xs text-slate-400 sm:col-span-2 lg:col-span-4">
                    Phase (for cost breakdown)
                    <select
                      disabled={busy}
                      value={draft.designStage}
                      onChange={(ev) =>
                        setEditDrafts((prev) => ({
                          ...prev,
                          [e.id]: { ...draft, designStage: ev.target.value },
                        }))
                      }
                      className={`mt-1 ${field}`}
                    >
                      <option value="">Unassigned</option>
                      {PRIVATE_STAGE_ORDER.map((stage) => (
                        <option key={stage} value={stage}>
                          {PRIVATE_STAGE_LABELS[stage]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-xs text-slate-400 sm:col-span-2 lg:col-span-4">
                    Notes
                    <input
                      disabled={busy}
                      value={draft.notes}
                      onChange={(ev) =>
                        setEditDrafts((prev) => ({
                          ...prev,
                          [e.id]: { ...draft, notes: ev.target.value },
                        }))
                      }
                      placeholder="Optional"
                      className={`mt-1 ${field}`}
                    />
                  </label>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {changed ? (
                    <button
                      type="button"
                      disabled={busy || !draft.description.trim()}
                      onClick={() => void saveExpense(e.id)}
                      className="rounded bg-brand-500/20 px-2 py-0.5 text-[10px] font-medium text-brand-200 ring-1 ring-brand-500/30 disabled:opacity-50"
                    >
                      {busy ? "Saving…" : "Save"}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void removeExpense(e.id)}
                    className="rounded px-2 py-0.5 text-[10px] font-medium text-red-300/80 ring-1 ring-red-500/20 hover:bg-red-500/10 disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <section className="card-tool rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white">Add expense</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block text-xs text-slate-400">
            Date
            <input
              type="date"
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
            />
          </label>
          <label className="block text-xs text-slate-400 sm:col-span-2">
            Description
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Surveyor fee"
              className="mt-1 w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
            />
          </label>
          <label className="block text-xs text-slate-400">
            Amount (ZAR)
            <input
              type="number"
              min="0"
              step="0.01"
              value={amountZar}
              onChange={(e) => setAmountZar(e.target.value)}
              placeholder="0"
              className="mt-1 w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
            />
          </label>
          <label className="block text-xs text-slate-400 sm:col-span-2 lg:col-span-4">
            Phase (for cost breakdown)
            <select
              value={designStage}
              onChange={(e) => setDesignStage(e.target.value as PrivateDesignStage)}
              className="mt-1 w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
            >
              {PRIVATE_STAGE_ORDER.map((stage) => (
                <option key={stage} value={stage}>
                  {PRIVATE_STAGE_LABELS[stage]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={() => void addExpense()}
          className="mt-3 rounded-lg bg-brand-500/20 px-3 py-1.5 text-xs font-medium text-brand-200 ring-1 ring-brand-500/30"
        >
          Add expense
        </button>
      </section>
    </div>
  );
}
