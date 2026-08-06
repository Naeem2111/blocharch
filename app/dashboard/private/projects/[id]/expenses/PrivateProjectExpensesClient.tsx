"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PRIVATE_FIXED_FEE_EXPENSE_LABEL, PRIVATE_STAGE_LABELS, PRIVATE_STAGE_ORDER } from "@/lib/private-constants";
import type { PrivateDesignStage, PrivateProjectExpenseKind } from "@prisma/client";

type AthleteOption = { id: string; fullName: string; athleteCode: string };

type ExpenseRow = {
  id: string;
  description: string;
  amountZar: number;
  expenseDate: string;
  kind: PrivateProjectExpenseKind;
  kindLabel: string;
  athleteId: string | null;
  athleteName: string | null;
  designStage: string | null;
  notes: string | null;
};

type ExpenseDraft = {
  description: string;
  amountZar: string;
  expenseDate: string;
  kind: PrivateProjectExpenseKind;
  athleteId: string;
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
    kind: e.kind,
    athleteId: e.athleteId ?? "",
    designStage: e.designStage ?? "",
    notes: e.notes ?? "",
  };
}

function expenseChanged(original: ExpenseRow, draft: ExpenseDraft): boolean {
  return (
    draft.description.trim() !== original.description ||
    draft.expenseDate !== original.expenseDate ||
    draft.kind !== original.kind ||
    draft.athleteId !== (original.athleteId ?? "") ||
    draft.designStage !== (original.designStage ?? "") ||
    draft.notes.trim() !== (original.notes ?? "") ||
    Number(draft.amountZar) !== original.amountZar
  );
}

export function PrivateProjectExpensesClient({ projectId }: { projectId: string }) {
  const [projectName, setProjectName] = useState("");
  const [assignedAthleteId, setAssignedAthleteId] = useState("");
  const [athletes, setAthletes] = useState<AthleteOption[]>([]);
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
  const [kind, setKind] = useState<PrivateProjectExpenseKind>("third_party");
  const [athleteId, setAthleteId] = useState("");
  const [designStage, setDesignStage] = useState("");

  const load = useCallback(async () => {
    const [expensesRes, athletesRes] = await Promise.all([
      fetch(`/api/private/projects/${projectId}/expenses`),
      fetch("/api/private/athletes"),
    ]);
    const j = await expensesRes.json();
    const athletesJson = await athletesRes.json();

    if (!expensesRes.ok) {
      setError(j.error || "Not found");
      setLoading(false);
      return;
    }

    setProjectName(j.project.name);
    setAssignedAthleteId(j.project.assignedAthleteId ?? "");
    setAthletes(athletesJson.athletes || []);
    if (j.project.designStage) {
      setDefaultStage(j.project.designStage);
      setDesignStage((prev) => prev || j.project.designStage);
    }
    if (j.project.assignedAthleteId) {
      setAthleteId((prev) => prev || j.project.assignedAthleteId);
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

  function validateAthleteForKind(
    expenseKind: PrivateProjectExpenseKind,
    selectedAthleteId: string,
  ): string | null {
    if (expenseKind === "athlete" && !selectedAthleteId.trim()) {
      return "Select an athlete — athlete payments count as income to them.";
    }
    return null;
  }

  async function addExpense() {
    if (!description.trim() || !amountZar.trim()) return;
    const athleteError = validateAthleteForKind(kind, athleteId);
    if (athleteError) {
      setError(athleteError);
      return;
    }
    setSaving(true);
    setError("");
    const r = await fetch(`/api/private/projects/${projectId}/expenses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: description.trim(),
        amountZar: Number(amountZar),
        expenseDate,
        kind,
        athleteId: kind === "athlete" ? athleteId : null,
        designStage: designStage || null,
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
    setKind("third_party");
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
    const athleteError = validateAthleteForKind(draft.kind, draft.athleteId);
    if (athleteError) {
      setError(athleteError);
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
        kind: draft.kind,
        athleteId: draft.kind === "athlete" ? draft.athleteId : null,
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
        <p className="text-xs text-slate-500">
          {expenses.length} expense{expenses.length === 1 ? "" : "s"} recorded · assign a phase,
          use fixed fee for one-off costs, or mark athlete payments as income
        </p>
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
                  <label className="block text-xs text-slate-400">
                    Type
                    <select
                      disabled={busy}
                      value={draft.kind}
                      onChange={(ev) => {
                        const nextKind = ev.target.value as PrivateProjectExpenseKind;
                        setEditDrafts((prev) => ({
                          ...prev,
                          [e.id]: {
                            ...draft,
                            kind: nextKind,
                            athleteId:
                              nextKind === "athlete"
                                ? draft.athleteId || assignedAthleteId
                                : "",
                          },
                        }));
                      }}
                      className={`mt-1 ${field}`}
                    >
                      <option value="third_party">Third party</option>
                      <option value="athlete">Athlete payment (income)</option>
                    </select>
                  </label>
                  {draft.kind === "athlete" ? (
                    <label className="block text-xs text-slate-400 sm:col-span-2">
                      Athlete
                      <select
                        disabled={busy}
                        value={draft.athleteId}
                        onChange={(ev) =>
                          setEditDrafts((prev) => ({
                            ...prev,
                            [e.id]: { ...draft, athleteId: ev.target.value },
                          }))
                        }
                        className={`mt-1 ${field}`}
                      >
                        <option value="">Select athlete…</option>
                        {athletes.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.fullName}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
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
                    Phase or fixed fee
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
                      <option value="">{PRIVATE_FIXED_FEE_EXPENSE_LABEL}</option>
                      {PRIVATE_STAGE_ORDER.map((stage) => (
                        <option key={stage} value={stage}>
                          {PRIVATE_STAGE_LABELS[stage]}
                        </option>
                      ))}
                    </select>
                    {!draft.designStage ? (
                      <span className="mt-1 block text-[10px] text-slate-500">
                        One-off cost — not tied to a design phase.
                      </span>
                    ) : null}
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
                  {draft.kind === "athlete" && draft.athleteId ? (
                    <span className="text-[10px] text-brand-200/80">
                      Counts as income to{" "}
                      {athletes.find((a) => a.id === draft.athleteId)?.fullName ?? e.athleteName}
                    </span>
                  ) : null}
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
          <label className="block text-xs text-slate-400">
            Type
            <select
              value={kind}
              onChange={(e) => {
                const nextKind = e.target.value as PrivateProjectExpenseKind;
                setKind(nextKind);
                if (nextKind === "athlete" && !athleteId && assignedAthleteId) {
                  setAthleteId(assignedAthleteId);
                }
                if (nextKind === "third_party") setAthleteId("");
              }}
              className="mt-1 w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
            >
              <option value="third_party">Third party</option>
              <option value="athlete">Athlete payment (income)</option>
            </select>
          </label>
          {kind === "athlete" ? (
            <label className="block text-xs text-slate-400 sm:col-span-2">
              Athlete
              <select
                value={athleteId}
                onChange={(e) => setAthleteId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
              >
                <option value="">Select athlete…</option>
                {athletes.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.fullName}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="block text-xs text-slate-400 sm:col-span-2">
            Description
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={kind === "athlete" ? "e.g. Site visit fee" : "e.g. Surveyor fee"}
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
            Phase or fixed fee
            <select
              value={designStage}
              onChange={(e) => setDesignStage(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
            >
              <option value="">{PRIVATE_FIXED_FEE_EXPENSE_LABEL}</option>
              {PRIVATE_STAGE_ORDER.map((stage) => (
                <option key={stage} value={stage}>
                  {PRIVATE_STAGE_LABELS[stage]}
                </option>
              ))}
            </select>
            {!designStage ? (
              <span className="mt-1 block text-[10px] text-slate-500">
                One-off cost — not tied to a design phase (like housekeeping on daily logs).
              </span>
            ) : null}
          </label>
        </div>
        {kind === "athlete" ? (
          <p className="mt-2 text-xs text-slate-500">
            Athlete payments are project costs and count toward the athlete&apos;s private work
            income.
          </p>
        ) : null}
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
