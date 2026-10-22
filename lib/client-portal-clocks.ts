const JOHANNESBURG = "Africa/Johannesburg";
const LONDON = "Europe/London";

function zonedOffsetMinutes(timeZone: string, date: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");
  let hour = value("hour");
  if (hour === 24) hour = 0;
  const asUtc = Date.UTC(value("year"), value("month") - 1, value("day"), hour, value("minute"), value("second"));
  return Math.round((asUtc - date.getTime()) / 60000);
}

function offsetLabel(minutes: number): string {
  const sign = minutes < 0 ? "−" : "+";
  const abs = Math.abs(minutes);
  const hours = Math.floor(abs / 60);
  const rest = abs % 60;
  if (rest === 0) return `UTC${sign}${hours}`;
  return `UTC${sign}${hours}:${String(rest).padStart(2, "0")}`;
}

export function formatPortalClock(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

export type PortalClockReadout = {
  southAfricaTime: string;
  southAfricaOffset: string;
  londonTime: string;
  londonAbbr: "GMT" | "BST";
  londonOffset: string;
  aheadLabel: string;
};

/** Live SA vs London clocks. The gap is 1 hour in British Summer Time and 2 hours in GMT. */
export function readPortalClocks(date: Date): PortalClockReadout {
  const saOffset = zonedOffsetMinutes(JOHANNESBURG, date);
  const londonOffset = zonedOffsetMinutes(LONDON, date);
  const ahead = Math.round((saOffset - londonOffset) / 60);
  const hours = Math.abs(ahead);
  const unit = hours === 1 ? "hour" : "hours";
  const aheadLabel =
    ahead > 0
      ? `SA is ${ahead} ${unit} ahead`
      : ahead < 0
        ? `London is ${hours} ${unit} ahead`
        : "SA and London are on the same time";

  return {
    southAfricaTime: formatPortalClock(date, JOHANNESBURG),
    southAfricaOffset: offsetLabel(saOffset),
    londonTime: formatPortalClock(date, LONDON),
    londonAbbr: londonOffset === 60 ? "BST" : "GMT",
    londonOffset: offsetLabel(londonOffset),
    aheadLabel,
  };
}
