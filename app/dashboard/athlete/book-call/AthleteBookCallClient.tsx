"use client";

import { useCallback, useEffect, useState } from "react";

type Project = { id: string; name: string; client: { name: string } };
type Slot = { start: string; end: string; label: string };
type RequestRow = {
  id: string;
  projectName: string | null;
  reason: string;
  contextNotes: string | null;
  requestedStartAt: string;
  requestedEndAt: string;
  status: string;
  adminNote: string | null;
  counterStartAt: string | null;
  counterEndAt: string | null;
  zoomLink: string | null;
  googleEventLink: string | null;
  createdAt: string;
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Awaiting Jethro",
  approved: "Approved",
  confirmed: "Confirmed",
  declined: "Declined",
  counter_proposed: "New time suggested",
  cancelled: "Cancelled",
};

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AthleteBookCallClient() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [slotSource, setSlotSource] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [projectId, setProjectId] = useState("");
  const [reason, setReason] = useState("");
  const [contextNotes, setContextNotes] = useState("");
  const [selectedSlot, setSelectedSlot] = useState("");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [slotsError, setSlotsError] = useState("");

  /** Dropdown when we have generated slots; free-form datetime only as fallback. */
  const useManualPicker = slots.length === 0;

  const refresh = useCallback(async () => {
    const [projR, slotR, reqR] = await Promise.all([
      fetch("/api/athlete/projects"),
      fetch("/api/athlete/book-call/slots"),
      fetch("/api/athlete/book-call"),
    ]);
    const [projJ, slotJ, reqJ] = await Promise.all([
      projR.json().catch(() => ({})),
      slotR.json().catch(() => ({})),
      reqR.json().catch(() => ({})),
    ]);
    if (projR.ok) setProjects(projJ.projects || []);
    if (slotR.ok) {
      setSlots(slotJ.slots || []);
      setCalendarConnected(!!slotJ.calendarConnected);
      setSlotSource(slotJ.source || "");
      setSlotsError("");
    } else {
      setSlots([]);
      setSlotsError(
        (slotJ as { error?: string }).error || "Could not load time slots — use the date/time fields below."
      );
    }
    if (reqR.ok) setRequests(reqJ.requests || []);
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!reason.trim()) {
      setError("Reason is required");
      return;
    }

    let requestedStartAt: string;
    let requestedEndAt: string;

    if (useManualPicker) {
      if (!customStart) {
        setError("Choose a preferred start date and time");
        return;
      }
      const start = new Date(customStart);
      if (Number.isNaN(start.getTime())) {
        setError("Invalid start time");
        return;
      }
      const end = customEnd ? new Date(customEnd) : new Date(start.getTime() + 30 * 60 * 1000);
      if (Number.isNaN(end.getTime()) || end <= start) {
        setError("End time must be after start time");
        return;
      }
      requestedStartAt = start.toISOString();
      requestedEndAt = end.toISOString();
    } else {
      const slot = slots.find((s) => s.start === selectedSlot);
      if (!slot) {
        setError("Choose an available time slot");
        return;
      }
      requestedStartAt = slot.start;
      requestedEndAt = slot.end;
    }

    setSaving(true);
    try {
      const r = await fetch("/api/athlete/book-call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: projectId || null,
          reason,
          contextNotes,
          requestedStartAt,
          requestedEndAt,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError((j as { error?: string }).error || "Could not submit request");
        return;
      }
      setSuccess("Check-in request sent. Jethro will approve or suggest another time.");
      setReason("");
      setContextNotes("");
      setSelectedSlot("");
      setCustomStart("");
      setCustomEnd("");
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  async function actOnRequest(id: string, action: "confirm_counter" | "cancel") {
    setError("");
    const r = await fetch(`/api/athlete/book-call/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      setError((j as { error?: string }).error || "Could not update");
      return;
    }
    setSuccess(action === "confirm_counter" ? "Time confirmed — added to calendar." : "Request cancelled.");
    await refresh();
  }

  if (loading) return <p className="text-sm text-slate-500">Loading…</p>;

  return (
    <div className="space-y-8">
      {!calendarConnected ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100/90">
          {slots.length > 0
            ? "Jethro's Google Calendar is not connected — times below are standard weekday slots (UK). He will confirm manually."
            : "Jethro's Google Calendar is not connected — enter your preferred date and time below and he will confirm manually."}
        </p>
      ) : (
        <p className="text-sm text-slate-500">
          Showing available slots from Jethro&apos;s calendar
          {slotSource === "google_calendar" ? " (live)." : " (standard weekday hours)."}
        </p>
      )}
      {slotsError ? (
        <p className="text-sm text-amber-400/90">{slotsError}</p>
      ) : null}

      <form onSubmit={submit} className="card-tool space-y-4 rounded-xl p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">New request</h2>

        <label className="block text-xs text-slate-400">
          Project
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="select-console mt-1 block w-full rounded-md px-3 py-2 text-sm"
          >
            <option value="">General / no project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {p.client.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-xs text-slate-400">
          Reason for the call <span className="text-red-400">*</span>
          <input
            required
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
            placeholder="e.g. Review GA package before client meeting"
          />
        </label>

        {useManualPicker ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs text-slate-400">
              Preferred start <span className="text-red-400">*</span>
              <input
                type="datetime-local"
                required
                value={customStart}
                onChange={(e) => {
                  setCustomStart(e.target.value);
                  if (e.target.value && !customEnd) {
                    const s = new Date(e.target.value);
                    if (!Number.isNaN(s.getTime())) {
                      const end = new Date(s.getTime() + 30 * 60 * 1000);
                      const pad = (n: number) => String(n).padStart(2, "0");
                      setCustomEnd(
                        `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}T${pad(end.getHours())}:${pad(end.getMinutes())}`
                      );
                    }
                  }
                }}
                className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
              />
            </label>
            <label className="block text-xs text-slate-400">
              Preferred end (optional, default 30 min)
              <input
                type="datetime-local"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
              />
            </label>
          </div>
        ) : (
          <label className="block text-xs text-slate-400">
            Preferred time <span className="text-red-400">*</span>
            <select
              required
              value={selectedSlot}
              onChange={(e) => setSelectedSlot(e.target.value)}
              className="select-console mt-1 block w-full rounded-md px-3 py-2 text-sm"
            >
              <option value="">Select a slot…</option>
              {slots.map((s) => (
                <option key={s.start} value={s.start}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="block text-xs text-slate-400">
          Notes / context (optional)
          <textarea
            value={contextNotes}
            onChange={(e) => setContextNotes(e.target.value)}
            rows={3}
            className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
            placeholder="Anything Jethro should know before the call"
          />
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-brand-500 disabled:opacity-50"
          >
            {saving ? "Sending…" : "Request check-in"}
          </button>
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          {success ? <p className="text-sm text-emerald-400">{success}</p> : null}
        </div>
      </form>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Your requests</h2>
        {requests.length === 0 ? (
          <p className="text-sm text-slate-500">No check-in requests yet.</p>
        ) : (
          <ul className="space-y-3">
            {requests.map((r) => (
              <li key={r.id} className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-slate-100">{r.reason}</p>
                    {r.projectName ? (
                      <p className="text-xs text-slate-500">{r.projectName}</p>
                    ) : null}
                    <p className="mt-1 text-sm text-slate-400">
                      {formatWhen(r.requestedStartAt)}
                      {r.status === "counter_proposed" && r.counterStartAt
                        ? ` → suggested: ${formatWhen(r.counterStartAt)}`
                        : ""}
                    </p>
                    <span className="mt-2 inline-block rounded bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-400">
                      {STATUS_LABEL[r.status] ?? r.status}
                    </span>
                  </div>
                  {r.zoomLink ? (
                    <a
                      href={r.zoomLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-brand-400 hover:text-brand-300"
                    >
                      Zoom link ↗
                    </a>
                  ) : null}
                </div>
                {r.adminNote ? (
                  <p className="mt-2 text-sm text-slate-400">Jethro: {r.adminNote}</p>
                ) : null}
                {r.status === "counter_proposed" ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void actOnRequest(r.id, "confirm_counter")}
                      className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-slate-950"
                    >
                      Confirm suggested time
                    </button>
                    <button
                      type="button"
                      onClick={() => void actOnRequest(r.id, "cancel")}
                      className="rounded-lg bg-white/[0.08] px-3 py-1.5 text-xs text-slate-300"
                    >
                      Cancel
                    </button>
                  </div>
                ) : null}
                {["approved", "confirmed"].includes(r.status) && r.googleEventLink ? (
                  <a
                    href={r.googleEventLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-block text-xs text-brand-400"
                  >
                    View in Google Calendar ↗
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
