"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DateTimeSplitFields,
  type DateTimeSplitValue,
} from "@/components/DateTimeSplitFields";
import { composeDueAtIso, splitDueAtIso } from "@/lib/planner-due-datetime";

type RequestRow = {
  id: string;
  athleteName: string;
  athleteCode: string;
  projectName: string | null;
  clientName: string | null;
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

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function splitFromIso(iso: string | null): DateTimeSplitValue {
  if (!iso) return { date: "", time: "", ampm: "AM" };
  return splitDueAtIso(iso);
}

export function OpsCheckInRequestsClient() {
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [zoomDraft, setZoomDraft] = useState<Record<string, string>>({});
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});
  const [counterStart, setCounterStart] = useState<Record<string, DateTimeSplitValue>>({});
  const [counterEnd, setCounterEnd] = useState<Record<string, DateTimeSplitValue>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const q = filter === "pending" ? "?status=pending" : "";
    const r = await fetch(`/api/ops/check-in-requests${q}`);
    const j = await r.json().catch(() => ({}));
    if (r.ok) {
      setRows(j.requests || []);
      setPendingCount(j.pendingCount ?? 0);
      setCalendarConnected(!!j.calendarConnected);
    }
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  async function patch(id: string, body: Record<string, unknown>) {
    setBusyId(id);
    const r = await fetch(`/api/ops/check-in-requests/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await r.json().catch(() => ({}));
    setBusyId(null);
    if (!r.ok) {
      window.alert((j as { error?: string }).error || "Update failed");
      return;
    }
    await load();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-400">
          {pendingCount} need attention
          {calendarConnected ? " · Google Calendar connected" : " · Calendar not connected (approve still works)"}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setFilter("pending")}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium ring-1 ${
              filter === "pending"
                ? "bg-brand-500/20 text-brand-200 ring-brand-500/30"
                : "bg-white/[0.04] text-slate-400 ring-white/[0.08]"
            }`}
          >
            Pending
          </button>
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium ring-1 ${
              filter === "all"
                ? "bg-brand-500/20 text-brand-200 ring-brand-500/30"
                : "bg-white/[0.04] text-slate-400 ring-white/[0.08]"
            }`}
          >
            All
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-500">No check-in requests.</p>
      ) : (
        <ul className="space-y-4">
          {rows.map((r) => (
            <li key={r.id} className="card-tool rounded-xl p-4">
              <div className="flex flex-wrap justify-between gap-2">
                <div>
                  <p className="font-semibold text-white">
                    {r.athleteName}{" "}
                    <span className="text-xs font-normal text-slate-500">({r.athleteCode})</span>
                  </p>
                  {r.projectName ? (
                    <p className="text-sm text-slate-400">
                      {r.projectName}
                      {r.clientName ? ` · ${r.clientName}` : ""}
                    </p>
                  ) : null}
                  <p className="mt-2 text-sm text-slate-200">{r.reason}</p>
                  {r.contextNotes ? (
                    <p className="mt-1 text-sm text-slate-500">{r.contextNotes}</p>
                  ) : null}
                  <p className="mt-2 text-sm text-brand-200/90">
                    Requested: {formatWhen(r.requestedStartAt)}
                  </p>
                  <p className="text-[10px] uppercase text-slate-600">{r.status}</p>
                </div>
                {r.googleEventLink ? (
                  <a
                    href={r.googleEventLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-brand-400"
                  >
                    Calendar ↗
                  </a>
                ) : null}
              </div>

              {["pending", "counter_proposed"].includes(r.status) ? (
                <div className="mt-4 space-y-3 border-t border-white/[0.06] pt-4">
                  <label className="block text-xs text-slate-400">
                    Zoom link (optional)
                    <input
                      value={zoomDraft[r.id] ?? r.zoomLink ?? ""}
                      onChange={(e) => setZoomDraft((d) => ({ ...d, [r.id]: e.target.value }))}
                      className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
                      placeholder="https://zoom.us/j/..."
                    />
                  </label>
                  <label className="block text-xs text-slate-400">
                    Note to athlete (optional)
                    <input
                      value={noteDraft[r.id] ?? r.adminNote ?? ""}
                      onChange={(e) => setNoteDraft((d) => ({ ...d, [r.id]: e.target.value }))}
                      className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
                    />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() =>
                        void patch(r.id, {
                          action: "approve",
                          zoomLink: zoomDraft[r.id] ?? r.zoomLink,
                          adminNote: noteDraft[r.id] ?? r.adminNote,
                        })
                      }
                      className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-slate-950 disabled:opacity-50"
                    >
                      Approve & add to calendar
                    </button>
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() =>
                        void patch(r.id, {
                          action: "decline",
                          adminNote: noteDraft[r.id] ?? r.adminNote,
                        })
                      }
                      className="rounded-lg bg-white/[0.08] px-3 py-1.5 text-xs text-slate-300"
                    >
                      Decline
                    </button>
                  </div>
                  <div className="rounded-lg bg-white/[0.03] p-3">
                    <p className="text-xs font-medium text-slate-400">Suggest another time</p>
                    <div className="mt-2 space-y-3">
                      <DateTimeSplitFields
                        label="Proposed start"
                        required
                        value={counterStart[r.id] ?? splitFromIso(r.counterStartAt)}
                        onChange={(v) => setCounterStart((d) => ({ ...d, [r.id]: v }))}
                      />
                      <DateTimeSplitFields
                        label="Proposed end"
                        required
                        value={counterEnd[r.id] ?? splitFromIso(r.counterEndAt)}
                        onChange={(v) => setCounterEnd((d) => ({ ...d, [r.id]: v }))}
                      />
                    </div>
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      className="mt-2 rounded-lg bg-amber-600/80 px-3 py-1.5 text-xs font-semibold text-slate-950"
                      onClick={() => {
                        const cs = counterStart[r.id] ?? splitFromIso(r.counterStartAt);
                        const ce = counterEnd[r.id] ?? splitFromIso(r.counterEndAt);
                        const startIso = composeDueAtIso(cs.date, cs.time, cs.ampm);
                        const endIso = composeDueAtIso(ce.date, ce.time, ce.ampm);
                        if (!startIso || !endIso) {
                          window.alert("Set valid proposed start and end times");
                          return;
                        }
                        const start = new Date(startIso);
                        const end = new Date(endIso);
                        if (end <= start) {
                          window.alert("End must be after start");
                          return;
                        }
                        void patch(r.id, {
                          action: "counter",
                          counterStartAt: start.toISOString(),
                          counterEndAt: end.toISOString(),
                          adminNote: noteDraft[r.id] ?? r.adminNote,
                          zoomLink: zoomDraft[r.id] ?? r.zoomLink,
                        });
                      }}
                    >
                      Send proposed time to athlete
                    </button>
                  </div>
                </div>
              ) : null}

              {["approved", "confirmed"].includes(r.status) ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="text-xs text-slate-400 hover:text-white"
                    onClick={() =>
                      void patch(r.id, {
                        action: "update",
                        zoomLink: zoomDraft[r.id] ?? r.zoomLink,
                        adminNote: noteDraft[r.id] ?? r.adminNote,
                      })
                    }
                  >
                    Save Zoom / note
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
