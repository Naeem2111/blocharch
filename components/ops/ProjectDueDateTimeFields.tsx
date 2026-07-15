"use client";

import {
  DEFAULT_PROJECT_DUE_AMPM,
  DEFAULT_PROJECT_DUE_TIME,
} from "@/lib/project-deadline";

type Value = {
  dueDate: string;
  dueTime: string;
  dueAmPm: "AM" | "PM";
};

export function ProjectDueDateTimeFields({
  value,
  onChange,
  className = "",
}: {
  value: Value;
  onChange: (next: Value) => void;
  className?: string;
}) {
  return (
    <div className={`grid grid-cols-1 gap-2 sm:grid-cols-3 ${className}`}>
      <label className="text-xs text-slate-400">
        Due date
        <input
          type="date"
          value={value.dueDate}
          onChange={(e) => onChange({ ...value, dueDate: e.target.value })}
          className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
        />
      </label>
      <label className="text-xs text-slate-400">
        Due time
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
        Defaults to {DEFAULT_PROJECT_DUE_TIME} {DEFAULT_PROJECT_DUE_AMPM} when time is left blank.
      </p>
    </div>
  );
}

export const emptyProjectDueFields = (): Value => ({
  dueDate: "",
  dueTime: DEFAULT_PROJECT_DUE_TIME,
  dueAmPm: DEFAULT_PROJECT_DUE_AMPM,
});
