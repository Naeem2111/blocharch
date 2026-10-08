function parseClock(time: string): { hours: number; minutes: number } | null {
  const m = /^(\d{1,2})(?::(\d{2}))?$/.exec(time.trim());
  if (!m) return null;
  const hours = Number(m[1]);
  const minutes = m[2] ? Number(m[2]) : 0;
  if (hours < 1 || hours > 12 || minutes < 0 || minutes > 59) return null;
  return { hours, minutes };
}

/** Build ISO datetime from separate date, time (HH:MM), and AM/PM. */
export function composeDueAtIso(
  date: string,
  time: string,
  ampm: "AM" | "PM",
  options?: { dateOnlyDefaultsToNineAm?: boolean }
): string | null {
  if (!date?.trim()) return null;
  const parsed =
    parseClock(time) ?? (options?.dateOnlyDefaultsToNineAm ? { hours: 9, minutes: 0 } : null);
  if (!parsed) return null;
  let hours = parsed.hours;
  const minutes = parsed.minutes;
  if (ampm === "AM") {
    if (hours === 12) hours = 0;
  } else if (hours !== 12) {
    hours += 12;
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date}T${pad(hours)}:${pad(minutes)}:00`;
}

export function formatPlannerDue(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function splitDueAtIso(iso: string | null | undefined): {
  date: string;
  time: string;
  ampm: "AM" | "PM";
} {
  if (!iso) return { date: "", time: "", ampm: "AM" };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: "", time: "", ampm: "AM" };
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  let h = d.getHours();
  const ampm: "AM" | "PM" = h >= 12 ? "PM" : "AM";
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  const time = `${h}:${String(d.getMinutes()).padStart(2, "0")}`;
  return { date, time, ampm };
}
