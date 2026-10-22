"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MiniMonthCalendar } from "@/components/MiniMonthCalendar";
import { ProgressSlider } from "@/components/ProgressSlider";

type CatalogOption = { value: string; label: string };

type ProjectOpt = {
  id: string;
  name: string;
  address: string | null;
  client: { id: string; name: string };
  designStageLabel: string;
  currentDesignPhaseId: string | null;
  progressPercent: number;
};

type EntryForm = {
  key: string;
  projectId: string;
  designPhaseId: string;
  taskTypes: string[];
  taskTypeOther: string;
  hoursWorked: string;
  completionPercent: number;
  completedSummary: string;
};

type DayEntry = {
  id: string;
  projectId: string;
  projectName: string;
  clientName: string;
  designPhaseId: string;
  designPhaseLabel: string;
  taskTypes: string[];
  taskTypeNote: string;
  hours: number;
  completionPercent: number | null;
  completedSummary: string;
};

type DayLog = {
  date: string;
  totalHours: number;
  entries: DayEntry[];
};

function emptyEntry(): EntryForm {
  return {
    key: crypto.randomUUID(),
    projectId: "",
    designPhaseId: "",
    taskTypes: [],
    taskTypeOther: "",
    hoursWorked: "",
    completionPercent: 0,
    completedSummary: "",
  };
}

function formsFromDay(day: DayLog): EntryForm[] {
  return day.entries.map((entry) => ({
    key: entry.id,
    projectId: entry.projectId,
    designPhaseId: entry.designPhaseId,
    taskTypes: entry.taskTypes ?? [],
    taskTypeOther: entry.taskTypeNote ?? "",
    hoursWorked: String(entry.hours),
    completionPercent: entry.completionPercent ?? 0,
    completedSummary: entry.completedSummary,
  }));
}

function previousCompletions(days: DayLog[], projectId: string, excludeDate: string) {
  if (!projectId) return [];
  const rows: Array<{ date: string; text: string }> = [];
  for (const day of days) {
    if (day.date === excludeDate) continue;
    for (const entry of day.entries) {
      const text = entry.completedSummary.trim();
      if (!text || entry.projectId !== projectId) continue;
      rows.push({ date: day.date, text });
    }
  }
  const seen = new Set<string>();
  const options: Array<{ key: string; label: string; text: string }> = [];
  for (const row of rows) {
    if (seen.has(row.text)) continue;
    seen.add(row.text);
    const short = row.text.length > 72 ? `${row.text.slice(0, 69)}…` : row.text;
    options.push({ key: `${row.date}:${options.length}`, label: `${row.date} — ${short}`, text: row.text });
    if (options.length >= 20) break;
  }
  return options;
}

function entryError(entry: EntryForm, projects: ProjectOpt[], phases: CatalogOption[], workTypes: CatalogOption[]): string | null {
  if (!entry.projectId) return "Select a project for this entry.";
  const project = projects.find((item) => item.id === entry.projectId);
  if (!project) return "Select a project assigned to you.";
  if (!phases.some((phase) => phase.value === entry.designPhaseId)) return "Choose a phase for this entry.";
  if (entry.taskTypes.length === 0 || entry.taskTypes.some((value) => !workTypes.some((item) => item.value === value))) {
    return "Choose a work type for this entry.";
  }
  if (entry.taskTypes.includes("other") && !entry.taskTypeOther.trim()) return "Describe the Other work type.";
  if (Number(entry.hoursWorked) < 0.25) return "Enter hours worked for this entry.";
  return null;
}

export function AthletePrivateLogClient() {
  const [projects, setProjects] = useState<ProjectOpt[]>([]);
  const [phases, setPhases] = useState<CatalogOption[]>([]);
  const [workTypes, setWorkTypes] = useState<CatalogOption[]>([]);
  const [days, setDays] = useState<DayLog[]>([]);
  const [monthHours, setMonthHours] = useState(0);
  const [monthEarningsZar, setMonthEarningsZar] = useState(0);
  const [hourlyRateZar, setHourlyRateZar] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [entryLines, setEntryLines] = useState<EntryForm[]>([]);
  const [draftEntry, setDraftEntry] = useState<EntryForm | null>(null);
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [calendarMonth, setCalendarMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const applyDay = useCallback((day: DayLog) => {
    setEditingDate(day.date);
    setSelectedDate(day.date);
    setCalendarMonth(day.date.slice(0, 7));
    setEntryLines(formsFromDay(day));
    setDraftEntry(null);
  }, []);

  const beginEmptyDay = useCallback(() => {
    setEditingDate(null);
    setEntryLines([]);
    setDraftEntry(null);
    setError("");
  }, []);

  const load = useCallback(
    async (applyToday = true) => {
      const response = await fetch("/api/athlete/private/log");
      const body = await response.json();
      if (response.ok) {
        const nextDays: DayLog[] = body.days || [];
        setProjects(body.projects || []);
        setPhases(body.phases || []);
        setWorkTypes(body.workTypes || []);
        setDays(nextDays);
        setMonthHours(Number(body.monthHours) || 0);
        setMonthEarningsZar(Number(body.monthEarningsZar) || 0);
        setHourlyRateZar(Number(body.hourlyRateZar) || 0);
        if (applyToday) {
          const todayLog = nextDays.find((day) => day.date === today);
          if (todayLog) applyDay(todayLog);
          else beginEmptyDay();
        }
      }
      setLoading(false);
    },
    [applyDay, beginEmptyDay, today],
  );

  useEffect(() => {
    void load();
  }, [load]);

  function onPickDate(date: string) {
    setSelectedDate(date);
    setCalendarMonth(date.slice(0, 7));
    setSuccess("");
    setError("");
    const day = days.find((item) => item.date === date);
    if (day) {
      applyDay(day);
      return;
    }
    beginEmptyDay();
  }

  function updateLine(key: string, patch: Partial<EntryForm>) {
    if (draftEntry?.key === key) {
      setDraftEntry({ ...draftEntry, ...patch });
      return;
    }
    setEntryLines((prev) => prev.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }

  function startDraft() {
    if (draftEntry || projects.length === 0) return;
    setDraftEntry(emptyEntry());
    setError("");
  }

  function confirmDraft() {
    if (!draftEntry) return;
    const validation = entryError(draftEntry, projects, phases, workTypes);
    if (validation) {
      setError(validation);
      return;
    }
    setEntryLines((prev) => [...prev, draftEntry]);
    setDraftEntry(null);
    setError("");
    setSuccess("Entry added. You can add another or save the daily log.");
  }

  const todayPreview =
    entryLines.reduce((sum, line) => sum + (Number(line.hoursWorked) || 0), 0) +
    (draftEntry ? Number(draftEntry.hoursWorked) || 0 : 0);
  const savedSelectedHours = days.find((day) => day.date === selectedDate)?.totalHours ?? 0;
  const monthAfter = Math.max(0, monthHours - savedSelectedHours + todayPreview);

  const marks = useMemo(
    () =>
      days.map((day) => ({
        date: day.date,
        label: `${day.totalHours}h logged`,
        color: "#3b82f6",
      })),
    [days],
  );

  const pastDays = useMemo(
    () => days.filter((day) => day.date !== selectedDate || editingDate !== day.date),
    [days, editingDate, selectedDate],
  );

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (draftEntry) {
      setError("Confirm or cancel your current entry before saving the daily log.");
      return;
    }
    for (const line of entryLines) {
      const validation = entryError(line, projects, phases, workTypes);
      if (validation) {
        setError(validation);
        return;
      }
    }
    if (entryLines.length === 0) {
      setError("Add at least one entry with hours.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/athlete/private/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: selectedDate,
          entries: entryLines.map((line) => ({
            projectId: line.projectId,
            designPhaseId: line.designPhaseId,
            taskTypes: line.taskTypes,
            taskTypeOther: line.taskTypeOther,
            hours: Number(line.hoursWorked),
            completionPercent: line.completionPercent,
            completedSummary: line.completedSummary,
          })),
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(body.error || "Could not save the daily log");
        return;
      }
      setMonthHours(Number(body.monthHours) || 0);
      setMonthEarningsZar(Number(body.monthEarningsZar) || 0);
      setSuccess("Daily log saved.");
      setEntryLines([]);
      setDraftEntry(null);
      setEditingDate(null);
      void load(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the daily log");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-slate-500">Loading…</p>;

  const visibleLines = [...entryLines, ...(draftEntry ? [draftEntry] : [])];

  return (
    <div className="space-y-8">
      <form onSubmit={(event) => void submit(event)} className="space-y-6">
        <div className="card-tool grid gap-4 rounded-xl p-4 lg:grid-cols-[1fr,minmax(220px,280px)]">
          <div>
            <label className="text-xs text-slate-400">
              Date
              <input
                type="date"
                value={selectedDate}
                onChange={(event) => onPickDate(event.target.value)}
                className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
              />
            </label>
            <p className="mt-3 text-xs leading-relaxed text-slate-500">
              A day with no saved log opens blank. Pick a marked day to open that log.
            </p>
          </div>
          <div className="border-t border-white/[0.06] pt-4 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
            <label className="text-xs text-slate-400">
              Month
              <input
                type="month"
                value={calendarMonth}
                onChange={(event) => setCalendarMonth(event.target.value)}
                className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
              />
            </label>
            <MiniMonthCalendar
              className="mt-3"
              month={calendarMonth}
              marks={marks}
              selectedDate={selectedDate}
              onSelectDate={onPickDate}
            />
            <p className="mt-2 text-[10px] text-slate-600">Blue dots = logged days.</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-white">Work entries</h2>
            <p className="mt-1 text-xs text-slate-500">
              Confirm each entry before adding another. Phases and work types come from the private project set.
            </p>
          </div>

          {!draftEntry && projects.length > 0 ? (
            <button
              type="button"
              onClick={startDraft}
              className="group card-tool card-tool-hover flex w-full flex-col items-start gap-2 rounded-xl border-l-4 border-l-brand-500/70 p-4 text-left"
            >
              <span className="text-sm font-semibold text-brand-200 group-hover:text-brand-100">+ Add project work</span>
              <span className="text-xs leading-relaxed text-slate-500">
                Hours, design phase, and what was completed on an assigned private project.
              </span>
            </button>
          ) : null}

          {draftEntry ? (
            <p className="text-xs text-amber-300/90">Finish this entry and click Confirm entry before adding another.</p>
          ) : null}

          {projects.length === 0 ? (
            <p className="text-sm text-slate-500">No private projects assigned yet — you cannot log work.</p>
          ) : null}

          {entryLines.length === 0 && !draftEntry && projects.length > 0 ? (
            <p className="text-sm text-slate-500">No entries yet — add project work above.</p>
          ) : null}

          {visibleLines.map((line, index) => {
            const isDraft = draftEntry?.key === line.key;
            const project = projects.find((item) => item.id === line.projectId);
            const phaseOptions =
              line.designPhaseId && !phases.some((phase) => phase.value === line.designPhaseId)
                ? [{ value: line.designPhaseId, label: "Saved phase" }, ...phases]
                : phases;
            const previous = previousCompletions(days, line.projectId, selectedDate);
            return (
              <div
                key={line.key}
                className={`card-tool grid gap-3 rounded-xl border border-brand-500/20 border-l-4 border-l-brand-500/70 bg-brand-500/[0.02] p-4 md:grid-cols-2 ${
                  isDraft ? "ring-1 ring-brand-500/20" : ""
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3 md:col-span-2">
                  <p className="text-xs font-medium text-slate-500">
                    {isDraft ? "Current entry" : `Entry ${index + 1}`}
                    {isDraft ? (
                      <button
                        type="button"
                        onClick={() => {
                          setDraftEntry(null);
                          setError("");
                        }}
                        className="ml-3 text-slate-600 hover:text-red-300"
                      >
                        Cancel
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setEntryLines((prev) => prev.filter((item) => item.key !== line.key))}
                        className="ml-3 text-slate-600 hover:text-red-300"
                      >
                        Remove
                      </button>
                    )}
                  </p>
                </div>
                <label className="text-xs text-slate-400 md:col-span-2">
                  Project
                  <select
                    required
                    value={line.projectId}
                    onChange={(event) => {
                      const projectId = event.target.value;
                      const next = projects.find((item) => item.id === projectId);
                      updateLine(line.key, {
                        projectId,
                        completionPercent: next?.progressPercent ?? 0,
                      });
                    }}
                    className="select-console mt-1 block w-full rounded-md px-3 py-2 text-sm"
                  >
                    <option value="">Select project…</option>
                    {projects.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.client.name} — {item.name}
                      </option>
                    ))}
                  </select>
                </label>
                {project?.address ? (
                  <p className="text-[11px] text-slate-500 md:col-span-2">{project.address}</p>
                ) : null}
                <label className="text-xs text-slate-400 md:col-span-2">
                  Phase
                  <select
                    required
                    value={line.designPhaseId}
                    onChange={(event) => updateLine(line.key, { designPhaseId: event.target.value })}
                    className="select-console mt-1 block w-full rounded-md px-3 py-2 text-sm"
                  >
                    <option value="">Select phase…</option>
                    {phaseOptions.map((phase) => (
                      <option key={phase.value} value={phase.value}>
                        {phase.label}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="text-xs text-slate-400 md:col-span-2">
                  <p className="mb-2">Work types</p>
                  {workTypes.length === 0 ? (
                    <p className="text-sm text-slate-500">No work types are available yet.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {workTypes.map((option) => {
                        const checked = line.taskTypes.includes(option.value);
                        return (
                          <label
                            key={option.value}
                            className={`flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 ring-1 ${
                              checked
                                ? "bg-sky-500/15 text-sky-200 ring-sky-400/30"
                                : "bg-white/[0.03] text-slate-400 ring-white/[0.08]"
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="sr-only"
                              checked={checked}
                              onChange={() => {
                                const next = checked
                                  ? line.taskTypes.filter((value) => value !== option.value)
                                  : [...line.taskTypes, option.value];
                                updateLine(line.key, { taskTypes: next });
                              }}
                            />
                            {option.label}
                          </label>
                        );
                      })}
                    </div>
                  )}
                  {line.taskTypes.includes("other") ? (
                    <input
                      value={line.taskTypeOther}
                      onChange={(event) => updateLine(line.key, { taskTypeOther: event.target.value })}
                      placeholder="Describe the other work type"
                      className="mt-2 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
                    />
                  ) : null}
                </div>
                <label className="text-xs text-slate-400">
                  Hours worked
                  <input
                    type="number"
                    min={0.25}
                    max={24}
                    step={0.25}
                    required
                    value={line.hoursWorked}
                    onChange={(event) => updateLine(line.key, { hoursWorked: event.target.value })}
                    className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
                  />
                </label>
                <div className="md:col-span-2">
                  <ProgressSlider
                    value={line.completionPercent}
                    onChange={(value) => updateLine(line.key, { completionPercent: value })}
                    label={
                      project
                        ? `Project progress (currently ${project.progressPercent}% on record)`
                        : "Project progress"
                    }
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs text-slate-400">
                    What was completed
                    {previous.length > 0 ? (
                      <select
                        value=""
                        onChange={(event) => {
                          const picked = previous.find((note) => note.key === event.target.value);
                          if (picked) updateLine(line.key, { completedSummary: picked.text });
                        }}
                        className="select-console mt-1 block w-full rounded-md px-3 py-2 text-sm"
                      >
                        <option value="">Previous completions…</option>
                        {previous.map((note) => (
                          <option key={note.key} value={note.key}>
                            {note.label}
                          </option>
                        ))}
                      </select>
                    ) : null}
                    <textarea
                      value={line.completedSummary}
                      onChange={(event) => updateLine(line.key, { completedSummary: event.target.value })}
                      rows={2}
                      className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
                      placeholder="Reviewed the concept layout and updated the elevation."
                    />
                  </label>
                </div>
                {isDraft ? (
                  <div className="flex flex-wrap gap-2 md:col-span-2">
                    <button
                      type="button"
                      onClick={confirmDraft}
                      className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-brand-500"
                    >
                      Confirm entry
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDraftEntry(null);
                        setError("");
                      }}
                      className="rounded-lg border border-white/[0.12] px-4 py-2 text-sm text-slate-400 hover:text-white"
                    >
                      Cancel
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="card-tool rounded-xl p-4">
          <h2 className="text-sm font-semibold text-white">Smart calculation</h2>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm md:grid-cols-3">
            <div>
              <dt className="text-slate-500">Today (preview)</dt>
              <dd className="font-medium text-white">{todayPreview.toFixed(2)}h</dd>
            </div>
            <div>
              <dt className="text-slate-500">Month after save</dt>
              <dd className="font-medium text-white">{monthAfter.toFixed(1)}h</dd>
            </div>
            <div>
              <dt className="text-slate-500">Est. monthly earnings</dt>
              <dd className="font-medium text-brand-300">
                R {Math.round(hourlyRateZar * monthAfter).toLocaleString()}
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-slate-500">
            Saved private hours roll into private Commercial & analytics. This month on record is{" "}
            {monthHours.toFixed(1)}h · R {monthEarningsZar.toLocaleString()}.
          </p>
        </div>

        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        {success ? <p className="text-sm text-brand-300">{success}</p> : null}

        <button
          type="submit"
          disabled={saving || projects.length === 0 || entryLines.length === 0 || !!draftEntry}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-brand-500 disabled:opacity-50"
        >
          {saving ? "Saving…" : editingDate ? "Update daily log" : "Save daily log"}
        </button>
      </form>

      <div className="card-tool rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white">Previous logs</h2>
        <p className="mt-1 text-xs text-slate-500">
          Collapsed by default — expand a day to see project cards, then click a card to edit.
        </p>
        {pastDays.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No other logs yet.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {pastDays.map((day) => {
              const expanded = expandedDates.has(day.date);
              return (
                <li key={day.date} className="overflow-hidden rounded-lg ring-1 ring-white/[0.08]">
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedDates((prev) => {
                        const next = new Set(prev);
                        if (next.has(day.date)) next.delete(day.date);
                        else next.add(day.date);
                        return next;
                      })
                    }
                    className="flex w-full items-center justify-between gap-2 bg-white/[0.03] px-3 py-2.5 text-left text-sm hover:bg-white/[0.06]"
                  >
                    <span className="flex items-center gap-2 text-slate-300">
                      <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded bg-white/[0.06] text-xs font-bold text-slate-400">
                        {expanded ? "−" : "+"}
                      </span>
                      {day.date} · {day.totalHours}h · {day.entries.length} project
                      {day.entries.length === 1 ? "" : "s"}
                      <span className="text-[10px] text-brand-300">Editable</span>
                    </span>
                  </button>
                  {expanded ? (
                    <div className="grid gap-2 border-t border-white/[0.06] bg-white/[0.02] p-3 sm:grid-cols-2">
                      {day.entries.map((entry) => (
                        <button
                          key={entry.id}
                          type="button"
                          onClick={() => {
                            setError("");
                            applyDay(day);
                            setSuccess(`Editing ${day.date}`);
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                          className="rounded-lg bg-white/[0.04] p-3 text-left ring-1 ring-white/[0.08] hover:bg-brand-500/10 hover:ring-brand-500/25"
                        >
                          <p className="text-sm font-medium text-white">{entry.projectName}</p>
                          <p className="text-xs text-slate-500">
                            {entry.clientName}
                            {entry.designPhaseLabel ? ` · ${entry.designPhaseLabel}` : ""}
                            {entry.taskTypes?.length
                              ? ` · ${entry.taskTypes
                                  .map((value) => workTypes.find((item) => item.value === value)?.label ?? value)
                                  .join(", ")}`
                              : ""}
                          </p>
                          <p className="mt-2 text-xs text-slate-400">
                            {entry.hours}h
                            {entry.completionPercent != null ? ` · ${entry.completionPercent}%` : ""}
                          </p>
                          {entry.completedSummary ? (
                            <p className="mt-1 line-clamp-2 text-xs text-slate-500">{entry.completedSummary}</p>
                          ) : null}
                          <p className="mt-2 text-[10px] font-medium text-brand-300">Click to edit this day</p>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
