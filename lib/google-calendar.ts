/**
 * Google Calendar integration for Jethro's availability (Book a Call).
 *
 * Required env (see .env.example):
 * - GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN
 * - GOOGLE_CALENDAR_ID (optional, default "primary")
 */

export type GoogleCalendarConfig = {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  calendarId: string;
  timezone: string;
  slotMinutes: number;
  workdayStartHour: number;
  workdayEndHour: number;
  horizonDays: number;
};

export type AvailableSlot = {
  start: string;
  end: string;
  label: string;
};

export function getGoogleCalendarConfig(): GoogleCalendarConfig | null {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN?.trim();
  if (!clientId || !clientSecret || !refreshToken) return null;

  return {
    clientId,
    clientSecret,
    refreshToken,
    calendarId: process.env.GOOGLE_CALENDAR_ID?.trim() || "primary",
    timezone: process.env.GOOGLE_CALENDAR_TIMEZONE?.trim() || "Europe/London",
    slotMinutes: Math.min(120, Math.max(15, parseInt(process.env.GOOGLE_SLOT_MINUTES || "30", 10) || 30)),
    workdayStartHour: parseInt(process.env.GOOGLE_WORKDAY_START || "9", 10) || 9,
    workdayEndHour: parseInt(process.env.GOOGLE_WORKDAY_END || "17", 10) || 17,
    horizonDays: Math.min(42, Math.max(7, parseInt(process.env.GOOGLE_AVAILABILITY_DAYS || "21", 10) || 21)),
  };
}

export function isGoogleCalendarConfigured(): boolean {
  return getGoogleCalendarConfig() !== null;
}

let cachedAccessToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(config: GoogleCalendarConfig): Promise<string> {
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now() + 60_000) {
    return cachedAccessToken.token;
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: config.refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const data = (await res.json()) as { access_token?: string; expires_in?: number; error?: string };
  if (!res.ok || !data.access_token) {
    throw new Error(data.error || "Failed to refresh Google access token");
  }

  cachedAccessToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  };
  return data.access_token;
}

async function googleFetch(
  config: GoogleCalendarConfig,
  path: string,
  init?: RequestInit
): Promise<Response> {
  const token = await getAccessToken(config);
  return fetch(`https://www.googleapis.com/calendar/v3${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

/** Busy intervals from Google freeBusy API. */
export async function fetchBusyIntervals(
  config: GoogleCalendarConfig,
  timeMin: Date,
  timeMax: Date
): Promise<Array<{ start: Date; end: Date }>> {
  const res = await googleFetch(config, "/freeBusy", {
    method: "POST",
    body: JSON.stringify({
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      timeZone: config.timezone,
      items: [{ id: config.calendarId }],
    }),
  });

  const data = (await res.json()) as {
    calendars?: Record<string, { busy?: Array<{ start: string; end: string }> }>;
    error?: { message?: string };
  };

  if (!res.ok) {
    throw new Error(data.error?.message || "Google freeBusy request failed");
  }

  const busy = data.calendars?.[config.calendarId]?.busy ?? [];
  return busy.map((b) => ({ start: new Date(b.start), end: new Date(b.end) }));
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && aEnd > bStart;
}

function getZonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(date);
  const pick = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return {
    year: pick("year"),
    month: pick("month"),
    day: pick("day"),
    hour: pick("hour"),
    minute: pick("minute"),
    weekday: parts.find((p) => p.type === "weekday")?.value ?? "",
  };
}

/** UTC instant for a local wall-clock time in `timeZone`. */
export function dateAtLocalTime(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string
): Date {
  let t = Date.UTC(year, month - 1, day, hour, minute);
  for (let i = 0; i < 4; i++) {
    const p = getZonedParts(new Date(t), timeZone);
    const diffMin = (hour - p.hour) * 60 + (minute - p.minute) + (day - p.day) * 24 * 60;
    t -= diffMin * 60 * 1000;
  }
  return new Date(t);
}

/** Candidate weekday slots in the configured timezone. */
function generateCandidateSlots(config: GoogleCalendarConfig): AvailableSlot[] {
  const slots: AvailableSlot[] = [];
  const now = new Date();
  const slotMs = config.slotMinutes * 60 * 1000;
  for (let d = 0; d < config.horizonDays; d++) {
    const probe = new Date(now.getTime() + d * 24 * 60 * 60 * 1000);
    const zp = getZonedParts(probe, config.timezone);
    if (zp.weekday === "Sat" || zp.weekday === "Sun") continue;

    for (let hour = config.workdayStartHour; hour < config.workdayEndHour; hour++) {
      for (let min = 0; min < 60; min += config.slotMinutes) {
        const endMin = min + config.slotMinutes;
        if (endMin > 60 && hour + 1 >= config.workdayEndHour) continue;

        const start = dateAtLocalTime(zp.year, zp.month, zp.day, hour, min, config.timezone);
        if (start.getTime() < now.getTime() + 2 * 60 * 60 * 1000) continue;

        const end = new Date(start.getTime() + slotMs);
        slots.push({
          start: start.toISOString(),
          end: end.toISOString(),
          label: formatSlotLabel(start, end, config.timezone),
        });
      }
    }
  }

  return slots;
}

export function formatSlotLabel(start: Date, end: Date, timeZone: string): string {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  const endFmt = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${fmt.format(start)} – ${endFmt.format(end)}`;
}

export async function listAvailableSlots(
  extraBusy: Array<{ start: Date; end: Date }> = []
): Promise<{ slots: AvailableSlot[]; source: "google_calendar" | "manual" }> {
  const config = getGoogleCalendarConfig();
  const candidates = generateCandidateSlots(
    config ?? {
      clientId: "",
      clientSecret: "",
      refreshToken: "",
      calendarId: "primary",
      timezone: "Europe/London",
      slotMinutes: 30,
      workdayStartHour: 9,
      workdayEndHour: 17,
      horizonDays: 21,
    }
  );

  if (!config) {
    return { slots: candidates.slice(0, 40), source: "manual" };
  }

  try {
    const timeMin = new Date();
    const timeMax = new Date();
    timeMax.setDate(timeMax.getDate() + config.horizonDays);
    const busy = [...(await fetchBusyIntervals(config, timeMin, timeMax)), ...extraBusy];

    const free = candidates.filter((slot) => {
      const s = new Date(slot.start);
      const e = new Date(slot.end);
      return !busy.some((b) => overlaps(s, e, b.start, b.end));
    });

    return { slots: free.slice(0, 60), source: "google_calendar" };
  } catch (e) {
    console.error("Google Calendar availability failed:", e);
    return { slots: candidates.slice(0, 40), source: "manual" };
  }
}

export type CreateEventInput = {
  title: string;
  description: string;
  start: Date;
  end: Date;
  attendeeEmail?: string | null;
};

export async function createGoogleCalendarEvent(
  input: CreateEventInput
): Promise<{ eventId: string; htmlLink: string | null } | null> {
  const config = getGoogleCalendarConfig();
  if (!config) return null;

  const body: Record<string, unknown> = {
    summary: input.title,
    description: input.description,
    start: { dateTime: input.start.toISOString(), timeZone: config.timezone },
    end: { dateTime: input.end.toISOString(), timeZone: config.timezone },
  };

  if (input.attendeeEmail) {
    body.attendees = [{ email: input.attendeeEmail }];
  }

  const res = await googleFetch(
    config,
    `/calendars/${encodeURIComponent(config.calendarId)}/events?sendUpdates=all`,
    { method: "POST", body: JSON.stringify(body) }
  );

  const data = (await res.json()) as { id?: string; htmlLink?: string; error?: { message?: string } };
  if (!res.ok || !data.id) {
    throw new Error(data.error?.message || "Failed to create calendar event");
  }

  return { eventId: data.id, htmlLink: data.htmlLink ?? null };
}

export async function patchGoogleCalendarEvent(
  eventId: string,
  patch: { description?: string; start?: Date; end?: Date }
): Promise<void> {
  const config = getGoogleCalendarConfig();
  if (!config) return;

  const body: Record<string, unknown> = {};
  if (patch.description !== undefined) body.description = patch.description;
  if (patch.start) body.start = { dateTime: patch.start.toISOString(), timeZone: config.timezone };
  if (patch.end) body.end = { dateTime: patch.end.toISOString(), timeZone: config.timezone };

  const res = await googleFetch(
    config,
    `/calendars/${encodeURIComponent(config.calendarId)}/events/${encodeURIComponent(eventId)}?sendUpdates=all`,
    { method: "PATCH", body: JSON.stringify(body) }
  );

  if (!res.ok) {
    const data = (await res.json()) as { error?: { message?: string } };
    throw new Error(data.error?.message || "Failed to update calendar event");
  }
}
