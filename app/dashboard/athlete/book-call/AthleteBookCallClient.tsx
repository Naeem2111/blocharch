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
    const slot = slots.find((s) => s.start === selectedSlot);
    if (!slot) {
      setError("Choose an available time slot");
      return;
    }
    if (!reason.trim()) {
      setError("Reason is required");
      return;
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
          requestedStartAt: slot.start,
          requestedEndAt: slot.end,
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
          Jethro&apos;s Google Calendar is not connected yet — you can still pick a preferred time and he will
          confirm manually. Once calendar env vars are set, slots will reflect real availability.
        </p>
      ) : (
        <p className="text-sm text-slate-500">
          Showing available slots from Jethro&apos;s calendar
          {slotSource === "google_calendar" ? " (live)." : "."}
        </p>
      )}

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
