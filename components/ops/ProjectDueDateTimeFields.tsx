"use client";

import {
  DEFAULT_ATHLETE_DEADLINE_WORKING_DAYS_BEFORE,
  DEFAULT_PROJECT_DUE_AMPM,
  DEFAULT_PROJECT_DUE_TIME,
  defaultAthleteDueFromClientDue,
  projectDueAtFromWallClock,
  splitProjectDueAtWallClock,
} from "@/lib/project-deadline";

export type ProjectDueFieldsValue = {
  dueDate: string;
  dueTime: string;
  dueAmPm: "AM" | "PM";
};

export function ProjectDueDateTimeFields({
  value,
  onChange,
  className = "",
  label = "Due date",
  hint,
}: {
  value: ProjectDueFieldsValue;
  onChange: (next: ProjectDueFieldsValue) => void;
  className?: string;
  label?: string;
  hint?: string;
}) {
  return (
    <div className={`grid grid-cols-1 gap-2 sm:grid-cols-3 ${className}`}>
      <label className="text-xs text-slate-400">
        {label}
        <input
          type="date"
          value={value.dueDate}
          onChange={(e) => onChange({ ...value, dueDate: e.target.value })}
          className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
        />
      </label>
      <label className="text-xs text-slate-400">
        Time
        <input
          type="text"
          inputMode="numeric"
          placeholder={DEFAULT_PROJECT_DUE_TIME}
          value={value.dueTime}
          onChange={(e) => onChange({ ...value, dueTime: e.target.value })}
          className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
        />
      </label>
      <label className="text-xs text-slate-400">
        AM / PM
        <select
          value={value.dueAmPm}
          onChange={(e) =>
            onChange({ ...value, dueAmPm: e.target.value === "AM" ? "AM" : "PM" })
          }
          className="select-console mt-1 block w-full rounded-md px-3 py-2 text-sm"
        >
          <option value="AM">AM</option>
          <option value="PM">PM</option>
        </select>
      </label>
      <p className="text-[10px] text-slate-500 sm:col-span-3">
        {hint ??
          `Defaults to ${DEFAULT_PROJECT_DUE_TIME} ${DEFAULT_PROJECT_DUE_AMPM} GMT+2 when time is left blank.`}
      </p>
    </div>
  );
}

export const emptyProjectDueFields = (): ProjectDueFieldsValue => ({
  dueDate: "",
  dueTime: DEFAULT_PROJECT_DUE_TIME,
  dueAmPm: DEFAULT_PROJECT_DUE_AMPM,
});

export type DualProjectDeadlinesValue = {
  clientDueDate: string;
  clientDueTime: string;
  clientDueAmPm: "AM" | "PM";
  athleteDueDate: string;
  athleteDueTime: string;
  athleteDueAmPm: "AM" | "PM";
};

export function emptyDualProjectDeadlines(): DualProjectDeadlinesValue {
  const empty = emptyProjectDueFields();
  return {
    clientDueDate: "",
    clientDueTime: empty.dueTime,
    clientDueAmPm: empty.dueAmPm,
    athleteDueDate: "",
    athleteDueTime: empty.dueTime,
    athleteDueAmPm: empty.dueAmPm,
  };
}

/** When client deadline changes and athlete is empty, seed ~3 working days earlier. */
export function applyClientDeadlineChange(
  prev: DualProjectDeadlinesValue,
  nextClient: ProjectDueFieldsValue
): DualProjectDeadlinesValue {
  const next: DualProjectDeadlinesValue = {
    ...prev,
    clientDueDate: nextClient.dueDate,
    clientDueTime: nextClient.dueTime,
    clientDueAmPm: nextClient.dueAmPm,
  };

  const clientInstant =
    nextClient.dueDate.trim() !== ""
      ? projectDueAtFromWallClock(
          nextClient.dueDate,
          nextClient.dueTime || DEFAULT_PROJECT_DUE_TIME,
          nextClient.dueAmPm
        )
      : null;

  if (!clientInstant) return next;

  const athleteEmpty = !prev.athleteDueDate.trim();
  if (!athleteEmpty) return next;

  const suggested = defaultAthleteDueFromClientDue(clientInstant);
  const split = splitProjectDueAtWallClock(suggested.toISOString());
  return {
    ...next,
    athleteDueDate: split.date,
    athleteDueTime: split.time || DEFAULT_PROJECT_DUE_TIME,
    athleteDueAmPm: split.ampm,
  };
}

export function DualProjectDeadlinesFields({
  value,
  onChange,
  className = "",
}: {
  value: DualProjectDeadlinesValue;
  onChange: (next: DualProjectDeadlinesValue) => void;
  className?: string;
}) {
  return (
    <div className={`space-y-4 ${className}`}>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-300">
          Client deadline
        </p>
        <p className="mt-0.5 text-[10px] text-slate-500">
          Shown to the client on their portal.
        </p>
        <ProjectDueDateTimeFields
          className="mt-2"
          label="Client deadline"
          value={{
            dueDate: value.clientDueDate,
            dueTime: value.clientDueTime,
            dueAmPm: value.clientDueAmPm,
          }}
          onChange={(client) => onChange(applyClientDeadlineChange(value, client))}
        />
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-300">
          Athlete deadline
        </p>
        <p className="mt-0.5 text-[10px] text-slate-500">
          Internal hand-in for QC. Defaults to {DEFAULT_ATHLETE_DEADLINE_WORKING_DAYS_BEFORE}{" "}
          working days before the client deadline (adjust for weekends/holidays).
        </p>
        <ProjectDueDateTimeFields
          className="mt-2"
          label="Athlete deadline"
          value={{
            dueDate: value.athleteDueDate,
            dueTime: value.athleteDueTime,
            dueAmPm: value.athleteDueAmPm,
          }}
          onChange={(athlete) =>
            onChange({
              ...value,
              athleteDueDate: athlete.dueDate,
              athleteDueTime: athlete.dueTime,
              athleteDueAmPm: athlete.dueAmPm,
            })
          }
        />
        {value.clientDueDate.trim() ? (
          <button
            type="button"
            className="mt-2 text-[11px] text-brand-300 hover:underline"
            onClick={() => {
              const clientInstant = projectDueAtFromWallClock(
                value.clientDueDate,
                value.clientDueTime || DEFAULT_PROJECT_DUE_TIME,
                value.clientDueAmPm
              );
              if (!clientInstant) return;
              const split = splitProjectDueAtWallClock(
                defaultAthleteDueFromClientDue(clientInstant).toISOString()
              );
              onChange({
                ...value,
                athleteDueDate: split.date,
                athleteDueTime: split.time || DEFAULT_PROJECT_DUE_TIME,
                athleteDueAmPm: split.ampm,
              });
            }}
          >
            Reset athlete deadline to {DEFAULT_ATHLETE_DEADLINE_WORKING_DAYS_BEFORE} working days
            before client
          </button>
        ) : null}
      </div>
    </div>
  );
}
