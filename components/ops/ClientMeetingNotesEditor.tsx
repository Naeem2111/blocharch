"use client";

import { useCallback, useEffect, useState } from "react";
import type { ClientMeetingNote } from "@/lib/client-meeting-notes";

type ContactOption = { name: string };

const emptyDraft = { title: "", body: "", forName: "" };

export function ClientMeetingNotesEditor({
  clientId,
  contacts,
}: {
  clientId: string;
  contacts: ContactOption[];
}) {
  const [notes, setNotes] = useState<ClientMeetingNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const response = await fetch(`/api/ops/clients/${clientId}/meeting-notes`);
    const payload = (await response.json().catch(() => null)) as { notes?: ClientMeetingNote[]; error?: string } | null;
    if (!response.ok) {
      setError(payload?.error || "Could not load meeting notes.");
      setLoading(false);
      return;
    }
    setNotes(payload?.notes ?? []);
    setLoading(false);
  }, [clientId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveDraft() {
    setSaving(true);
    setError("");
    const response = await fetch(
      editingId
        ? `/api/ops/clients/${clientId}/meeting-notes/${editingId}`
        : `/api/ops/clients/${clientId}/meeting-notes`,
      {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      }
    );
    const payload = (await response.json().catch(() => null)) as { notes?: ClientMeetingNote[]; error?: string } | null;
    setSaving(false);
    if (!response.ok || !payload?.notes) {
      setError(payload?.error || "Could not save that note.");
      return;
    }
    setNotes(payload.notes);
    setDraft(emptyDraft);
    setEditingId(null);
  }

  async function remove(note: ClientMeetingNote) {
    if (!window.confirm(`Remove “${note.title}” from meeting notes?`)) return;
    setError("");
    const response = await fetch(`/api/ops/clients/${clientId}/meeting-notes/${note.id}`, { method: "DELETE" });
    const payload = (await response.json().catch(() => null)) as { notes?: ClientMeetingNote[]; error?: string } | null;
    if (!response.ok || !payload?.notes) {
      setError(payload?.error || "Could not remove that note.");
      return;
    }
    setNotes(payload.notes);
    if (editingId === note.id) {
      setEditingId(null);
      setDraft(emptyDraft);
    }
  }

  async function setDiscussed(note: ClientMeetingNote, discussed: boolean) {
    setError("");
    const response = await fetch(`/api/ops/clients/${clientId}/meeting-notes/${note.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ discussed }),
    });
    const payload = (await response.json().catch(() => null)) as { notes?: ClientMeetingNote[]; error?: string } | null;
    if (!response.ok || !payload?.notes) {
      setError(payload?.error || "Could not update that note.");
      return;
    }
    setNotes(payload.notes);
  }

  const names = contacts.map((contact) => contact.name.trim()).filter(Boolean);

  return (
    <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-3 md:col-span-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Meeting notes</p>
      <p className="mt-1 text-[11px] text-slate-500">
        Shown on this client&apos;s portal. They can reorder open points and tick them off in the meeting.
      </p>
      <div className="mt-3 grid gap-2">
        <input
          value={draft.title}
          onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
          placeholder="Title"
          className="block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
        />
        <textarea
          value={draft.body}
          onChange={(event) => setDraft((current) => ({ ...current, body: event.target.value }))}
          placeholder="What to discuss"
          rows={2}
          className="block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
        />
        <input
          value={draft.forName}
          onChange={(event) => setDraft((current) => ({ ...current, forName: event.target.value }))}
          placeholder="For"
          list={`meeting-note-people-${clientId}`}
          className="block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
        />
        {names.length > 0 ? (
          <datalist id={`meeting-note-people-${clientId}`}>
            {names.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        ) : null}
        <div className="flex gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => void saveDraft()}
            className="btn-brand-primary rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
          >
            {saving ? "Saving…" : editingId ? "Update note" : "Add note"}
          </button>
          {editingId ? (
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setDraft(emptyDraft);
              }}
              className="text-xs text-slate-500"
            >
              Cancel
            </button>
          ) : null}
        </div>
      </div>
      {error ? <p className="mt-2 text-xs text-red-400">{error}</p> : null}
      {loading ? <p className="mt-3 text-xs text-slate-500">Loading notes…</p> : null}
      {notes.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {[...notes]
            .sort((a, b) => {
              if (Boolean(a.discussedAt) !== Boolean(b.discussedAt)) return a.discussedAt ? 1 : -1;
              if (a.discussedAt && b.discussedAt) return b.discussedAt.localeCompare(a.discussedAt);
              return a.sortOrder - b.sortOrder;
            })
            .map((note) => (
            <li key={note.id} className="rounded-md border border-white/[0.06] px-3 py-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white">{note.title}</p>
                  <p className="text-xs text-slate-500">
                    For {note.forName}
                    {" · "}
                    {note.discussedAt ? "Discussed" : "To discuss"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(note.id);
                      setDraft({ title: note.title, body: note.body, forName: note.forName });
                    }}
                    className="text-brand-300 hover:text-brand-200"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => void setDiscussed(note, !note.discussedAt)}
                    className="text-slate-400 hover:text-slate-200"
                  >
                    {note.discussedAt ? "Reopen" : "Mark discussed"}
                  </button>
                  <button type="button" onClick={() => void remove(note)} className="text-red-400 hover:text-red-300">
                    Remove
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
