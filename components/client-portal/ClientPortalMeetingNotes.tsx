"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ClientMeetingNote } from "@/lib/client-meeting-notes";
import { MeetingNoteProjectChip } from "@/components/client-portal/MeetingNoteProjectChip";

function openNotes(notes: ClientMeetingNote[]) {
  return notes.filter((note) => !note.discussedAt).sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt));
}

function discussedDayKey(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

function discussedDayLabel(key: string): string {
  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year, (month || 1) - 1, day || 1));
  return date
    .toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
    .toUpperCase();
}

function GripIcon() {
  return (
    <svg width="14" height="18" viewBox="0 0 14 18" aria-hidden className="text-slate-500">
      {[4, 9, 14].map((y) => (
        <g key={y}>
          <circle cx="4" cy={y} r="1.2" fill="currentColor" />
          <circle cx="10" cy={y} r="1.2" fill="currentColor" />
        </g>
      ))}
    </svg>
  );
}

function Chevron({ dir }: { dir: "up" | "down" }) {
  return (
    <svg width="12" height="8" viewBox="0 0 12 8" aria-hidden className="text-slate-400">
      {dir === "up" ? (
        <path d="M1 6.5 6 1.5 11 6.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      ) : (
        <path d="M1 1.5 6 6.5 11 1.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      )}
    </svg>
  );
}

function NoteContent({ note }: { note: ClientMeetingNote }) {
  return (
    <div className="min-w-0">
      <p className="font-semibold text-white">{note.title}</p>
      {note.projects.length > 0 ? (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {note.projects.map((project) => (
            <MeetingNoteProjectChip key={project.id} name={project.name} dueDate={project.dueDate} />
          ))}
        </div>
      ) : null}
      {note.body ? <p className="mt-0.5 text-sm text-slate-400">{note.body}</p> : null}
      {note.people.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {note.people.map((person) => (
            <span
              key={person.name}
              className="inline-flex flex-col rounded-full bg-white/[0.08] px-2.5 py-0.5 text-[11px] font-medium leading-tight text-slate-300"
            >
              <span>For: {person.name}</span>
              {person.title ? <span className="text-[10px] font-normal text-slate-400">{person.title}</span> : null}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function applyOrder(notes: ClientMeetingNote[], ids: string[]) {
  const rank = new Map(ids.map((id, index) => [id, index]));
  return notes.map((note) => (rank.has(note.id) ? { ...note, sortOrder: rank.get(note.id)! } : note));
}

export function ClientPortalMeetingNotes({
  slug,
  initialNotes,
}: {
  slug: string;
  initialNotes: ClientMeetingNote[];
}) {
  const [notes, setNotes] = useState(initialNotes);
  const [discussedOpen, setDiscussedOpen] = useState(true);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [leavingId, setLeavingId] = useState<string | null>(null);
  const [arrivedId, setArrivedId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ id: string } | null>(null);
  const [error, setError] = useState("");
  const chain = useRef(Promise.resolve());
  const notesRef = useRef(notes);
  const revision = useRef(0);
  notesRef.current = notes;

  useEffect(() => {
    setNotes(initialNotes);
  }, [initialNotes]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 6000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const open = useMemo(() => openNotes(notes), [notes]);
  const discussed = useMemo(
    () =>
      notes
        .filter((note) => note.discussedAt)
        .sort((a, b) => (b.discussedAt ?? "").localeCompare(a.discussedAt ?? "")),
    [notes]
  );
  const discussedGroups = useMemo(() => {
    const groups: { key: string; label: string; notes: ClientMeetingNote[] }[] = [];
    for (const note of discussed) {
      const key = discussedDayKey(note.discussedAt!);
      const last = groups[groups.length - 1];
      if (last?.key === key) last.notes.push(note);
      else groups.push({ key, label: discussedDayLabel(key), notes: [note] });
    }
    return groups;
  }, [discussed]);

  function enqueue(task: () => Promise<void>) {
    chain.current = chain.current.then(task, task);
  }

  function sync(body: { action: string; id?: string; ids?: string[] }, optimistic: ClientMeetingNote[]) {
    const mine = ++revision.current;
    const previous = notesRef.current;
    notesRef.current = optimistic;
    setNotes(optimistic);
    setError("");
    enqueue(async () => {
      const response = await fetch(`/api/clients/${encodeURIComponent(slug)}/meeting-notes`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json().catch(() => null)) as { notes?: ClientMeetingNote[]; error?: string } | null;
      if (revision.current !== mine) return;
      if (!response.ok || !payload?.notes) {
        notesRef.current = previous;
        setNotes(previous);
        setError(payload?.error || "Could not update meeting notes.");
        setToast(null);
        return;
      }
      notesRef.current = payload.notes;
      setNotes(payload.notes);
    });
  }

  function move(id: string, direction: -1 | 1) {
    const current = notesRef.current;
    const ids = openNotes(current).map((note) => note.id);
    const index = ids.indexOf(id);
    const next = index + direction;
    if (index < 0 || next < 0 || next >= ids.length) return;
    const reordered = [...ids];
    const [item] = reordered.splice(index, 1);
    reordered.splice(next, 0, item);
    sync({ action: "reorder", ids: reordered }, applyOrder(current, reordered));
  }

  function dropOn(sourceId: string, targetId: string) {
    if (!sourceId || sourceId === targetId) return;
    const current = notesRef.current;
    const ids = openNotes(current).map((note) => note.id);
    const from = ids.indexOf(sourceId);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) return;
    const reordered = [...ids];
    const [item] = reordered.splice(from, 1);
    reordered.splice(to, 0, item);
    sync({ action: "reorder", ids: reordered }, applyOrder(current, reordered));
    setDraggingId(null);
  }

  function markDiscussed(id: string) {
    if (leavingId === id) return;
    const finish = () => {
      setLeavingId(null);
      setArrivedId(id);
      setToast({ id });
      const current = notesRef.current;
      sync(
        { action: "discuss", id },
        current.map((note) => (note.id === id ? { ...note, discussedAt: new Date().toISOString() } : note))
      );
    };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      finish();
      return;
    }
    setLeavingId(id);
    window.setTimeout(finish, 320);
  }

  function reopen(id: string) {
    setToast(null);
    const current = notesRef.current;
    sync(
      { action: "reopen", id },
      current.map((note) => (note.id === id ? { ...note, discussedAt: null } : note))
    );
  }

  return (
    <section>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-white">Meeting Notes</h2>
          <p className="mt-1 text-sm text-slate-500">Reorder points, tick to mark discussed, and untick to reopen.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-white/[0.12] bg-white/[0.03] px-3 py-1 text-xs font-medium text-slate-300">
            {notes.length} note{notes.length === 1 ? "" : "s"}
          </span>
          <span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1 text-xs font-medium text-amber-200">
            {open.length} to discuss
          </span>
          <span className="rounded-full border border-emerald-400/40 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-300">
            {discussed.length} discussed
          </span>
        </div>
      </div>

      {error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}

      {notes.length === 0 ? (
        <p className="mt-8 text-sm text-slate-500">No meeting notes yet.</p>
      ) : (
        <div className="mt-8 space-y-8">
          {open.length > 0 ? (
            <div>
              <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-300">
                <span className="h-4 w-1 rounded-full bg-amber-400" aria-hidden />
                To discuss ({open.length})
              </h3>
              <ul className="mt-3 space-y-3">
                {open.map((note, index) => (
                  <li
                    key={note.id}
                    onDragOver={(event) => {
                      event.preventDefault();
                      event.dataTransfer.dropEffect = "move";
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      dropOn(event.dataTransfer.getData("text/plain") || draggingId || "", note.id);
                    }}
                    className={`client-portal-card relative overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.03] ${
                      draggingId === note.id ? "opacity-60" : ""
                    } ${leavingId === note.id ? "portal-note-leaving" : ""}`}
                  >
                    <span className="absolute bottom-0 left-0 top-0 w-1 bg-amber-400" aria-hidden />
                    <div className="flex flex-col gap-3 py-3 pl-4 pr-3 sm:flex-row sm:items-center sm:gap-4 sm:pr-4">
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <button
                          type="button"
                          draggable
                          aria-label={`Drag to reorder ${note.title}`}
                          onDragStart={(event) => {
                            event.dataTransfer.setData("text/plain", note.id);
                            event.dataTransfer.effectAllowed = "move";
                            setDraggingId(note.id);
                          }}
                          onDragEnd={() => setDraggingId(null)}
                          className="cursor-grab rounded p-1 text-slate-500 active:cursor-grabbing"
                        >
                          <GripIcon />
                        </button>
                        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04] text-xs font-semibold tabular-nums text-slate-300">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <span className="flex shrink-0 flex-col">
                          <button
                            type="button"
                            aria-label="Move up"
                            disabled={index === 0}
                            onClick={() => move(note.id, -1)}
                            className="rounded p-0.5 hover:bg-white/[0.06] disabled:opacity-30"
                          >
                            <Chevron dir="up" />
                          </button>
                          <button
                            type="button"
                            aria-label="Move down"
                            disabled={index === open.length - 1}
                            onClick={() => move(note.id, 1)}
                            className="rounded p-0.5 hover:bg-white/[0.06] disabled:opacity-30"
                          >
                            <Chevron dir="down" />
                          </button>
                        </span>
                        <NoteContent note={note} />
                      </div>
                      <button
                        type="button"
                        onClick={() => markDiscussed(note.id)}
                        className="inline-flex shrink-0 items-center gap-2 self-start rounded-lg border border-brand-400/50 px-3 py-2 text-sm text-slate-200 hover:bg-brand-500/10 sm:self-center"
                      >
                        <span
                          className={`inline-flex h-4 w-4 items-center justify-center rounded border ${
                            leavingId === note.id
                              ? "portal-discussed-toast-check border-emerald-400 bg-emerald-400 text-[10px] font-bold text-slate-950"
                              : "border-slate-400"
                          }`}
                          aria-hidden
                        >
                          {leavingId === note.id ? "✓" : ""}
                        </span>
                        Mark as discussed
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-slate-500">Nothing left to discuss.</p>
          )}

          {discussed.length > 0 ? (
            <div>
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setDiscussedOpen((open) => !open)}
                  className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400"
                >
                  <Chevron dir={discussedOpen ? "down" : "up"} />
                  Discussed ({discussed.length})
                </button>
                <span className="text-xs text-slate-500">Newest first</span>
              </div>
              {discussedOpen ? (
                <div className="mt-4 space-y-5">
                  {discussedGroups.map((group) => (
                    <div key={group.key}>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{group.label}</p>
                      <ul className="mt-2 space-y-3">
                        {group.notes.map((note) => (
                          <li
                            key={note.id}
                            className={`client-portal-card relative overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.03] ${
                              arrivedId === note.id ? "portal-note-arrived" : ""
                            }`}
                          >
                            <span className="absolute bottom-0 left-0 top-0 w-1 bg-emerald-400" aria-hidden />
                            <div className="flex flex-col gap-3 py-3 pl-4 pr-4 sm:flex-row sm:items-center sm:justify-between">
                              <NoteContent note={note} />
                              <div className="shrink-0 text-left sm:text-right">
                                <p className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-300">
                                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-400 text-[10px] font-bold text-slate-950">
                                    ✓
                                  </span>
                                  Discussed
                                </p>
                                <button
                                  type="button"
                                  onClick={() => reopen(note.id)}
                                  className="mt-1 block text-xs text-slate-400 hover:text-slate-200"
                                >
                                  Untick to reopen
                                </button>
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      )}

      {toast ? (
        <div className="portal-discussed-toast fixed bottom-5 right-4 z-50 flex items-center gap-4 rounded-xl border border-white/[0.1] bg-[#0e1726] px-4 py-3 shadow-2xl sm:right-8">
          <p className="inline-flex items-center gap-2 text-sm font-medium text-white">
            <span className="portal-discussed-toast-check inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-400 text-[11px] font-bold text-slate-950">
              ✓
            </span>
            Marked as discussed
          </p>
          <button type="button" onClick={() => reopen(toast.id)} className="text-sm font-semibold text-brand-300 hover:text-brand-200">
            Undo
          </button>
          <button type="button" aria-label="Dismiss" onClick={() => setToast(null)} className="text-slate-500 hover:text-white">
            ×
          </button>
        </div>
      ) : null}
    </section>
  );
}
