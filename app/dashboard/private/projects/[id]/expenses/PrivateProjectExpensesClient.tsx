"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type ExpenseRow = {
  id: string;
  description: string;
  amountZar: number;
  expenseDate: string;
  notes: string | null;
};

function zar(n: number) {
  return `R ${Math.round(n).toLocaleString("en-ZA")}`;
}

export function PrivateProjectExpensesClient({ projectId }: { projectId: string }) {
  const [projectName, setProjectName] = useState("");
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [totalZar, setTotalZar] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [description, setDescription] = useState("");
  const [amountZar, setAmountZar] = useState("");
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().slice(0, 10));

  const load = useCallback(async () => {
    const r = await fetch(`/api/private/projects/${projectId}/expenses`);
    const j = await r.json();
    if (!r.ok) {
      setError(j.error || "Not found");
      setLoading(false);
      return;
    }
    setProjectName(j.project.name);
    setExpenses(j.expenses || []);
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
        <p className="text-xs text-slate-500">{expenses.length} expense{expenses.length === 1 ? "" : "s"} recorded</p>
      </div>

      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      <div className="card-tool overflow-x-auto rounded-xl">
        <table className="w-full min-w-[36rem] text-left text-sm">
          <thead>
            <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-wider text-slate-500">
              <th className="px-4 py-3 font-semibold">Date</th>
              <th className="px-4 py-3 font-semibold">Description</th>
              <th className="px-4 py-3 font-semibold">Notes</th>
              <th className="px-4 py-3 font-semibold text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {expenses.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-slate-500">
                  No expenses recorded yet.
                </td>
              </tr>
            ) : (
              expenses.map((e) => (
                <tr key={e.id} className="border-b border-white/[0.04]">
                  <td className="px-4 py-3 text-slate-400">{e.expenseDate}</td>
                  <td className="px-4 py-3 text-white">{e.description}</td>
                  <td className="px-4 py-3 text-slate-500">{e.notes ?? "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-300">{zar(e.amountZar)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
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
