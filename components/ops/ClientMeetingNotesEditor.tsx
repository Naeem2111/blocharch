"use client";

import { useCallback, useEffect, useState } from "react";
import type { ClientMeetingNote, MeetingNoteProjectOption } from "@/lib/client-meeting-notes";
import { MeetingNoteProjectChip } from "@/components/client-portal/MeetingNoteProjectChip";

type ContactOption = { name: string; title?: string | null };

const emptyDraft = { title: "", body: "", people: [""], projectIds: [] as string[] };

export function ClientMeetingNotesEditor({
  clientId,
  contacts,
}: {
  clientId: string;
  contacts: ContactOption[];
}) {
  const [notes, setNotes] = useState<ClientMeetingNote[]>([]);
  const [projectOptions, setProjectOptions] = useState<MeetingNoteProjectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const response = await fetch(`/api/ops/clients/${clientId}/meeting-notes`);
    const payload = (await response.json().catch(() => null)) as {
      notes?: ClientMeetingNote[];
      projects?: MeetingNoteProjectOption[];
      error?: string;
    } | null;
    if (!response.ok) {
      setError(payload?.error || "Could not load meeting notes.");
      setLoading(false);
      return;
    }
    setNotes(payload?.notes ?? []);
    setProjectOptions(payload?.projects ?? []);
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
        body: JSON.stringify({
          title: draft.title,
          body: draft.body,
          people: draft.people.map((name) => name.trim()).filter(Boolean),
          projectIds: draft.projectIds,
        }),
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

  const peopleOptions = contacts
    .map((contact) => ({ name: contact.name.trim(), title: contact.title?.trim() || null }))
    .filter((contact) => contact.name);

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
        <label className="block text-[11px] text-slate-500">
          Discussion, optional
          <textarea
            value={draft.body}
            onChange={(event) => setDraft((current) => ({ ...current, body: event.target.value }))}
            placeholder="Add a note if you need one"
            rows={2}
            className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
          />
        </label>
        <div className="space-y-2">
          <p className="text-[11px] text-slate-500">People are optional. Add another when a point is for more than one person.</p>
          {draft.people.map((name, index) => (
            <div key={index} className="flex gap-2">
              <input
                value={name}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    people: current.people.map((person, personIndex) =>
                      personIndex === index ? event.target.value : person
                    ),
                  }))
                }
                placeholder={index === 0 ? "Person (optional)" : "Another person"}
                list={`meeting-note-people-${clientId}`}
                className="block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
              />
              {draft.people.length > 1 ? (
                <button
                  type="button"
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      people: current.people.filter((_, personIndex) => personIndex !== index),
                    }))
                  }
                  className="shrink-0 text-xs text-slate-500 hover:text-slate-200"
                >
                  Remove
                </button>
              ) : null}
            </div>
          ))}
          <button
            type="button"
            onClick={() => setDraft((current) => ({ ...current, people: [...current.people, ""] }))}
            className="text-xs text-brand-300 hover:text-brand-200"
          >
            Add another person
          </button>
          {peopleOptions.length > 0 ? (
            <datalist id={`meeting-note-people-${clientId}`}>
              {peopleOptions.map((contact) => (
                <option key={contact.name} value={contact.name}>
                  {contact.title ? `${contact.name} · ${contact.title}` : contact.name}
                </option>
              ))}
            </datalist>
          ) : null}
        </div>
        <fieldset className="space-y-1.5">
          <legend className="text-[11px] text-slate-500">Projects, optional</legend>
          {projectOptions.length === 0 ? (
            <p className="text-xs text-slate-500">This client has no projects to reference yet.</p>
          ) : (
            <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto rounded-md border border-white/[0.06] p-2">
              {projectOptions.map((project) => {
                const checked = draft.projectIds.includes(project.id);
                return (
                  <MeetingNoteProjectChip
                    key={project.id}
                    name={project.name}
                    dueDate={project.dueDate}
                    selected={checked}
                    onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        projectIds: checked
                          ? current.projectIds.filter((id) => id !== project.id)
                          : [...current.projectIds, project.id],
                      }))
                    }
                  />
                );
              })}
            </div>
          )}
        </fieldset>
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
                  {note.projects.length > 0 ? (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {note.projects.map((project) => (
                        <MeetingNoteProjectChip key={project.id} name={project.name} dueDate={project.dueDate} />
                      ))}
                    </div>
                  ) : null}
                  {note.people.length > 0 ? (
                    <div className="mt-1 space-y-1">
                      {note.people.map((person, index) => (
                        <p key={`${person.name}-${index}`} className="flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
                          <span className="rounded-full border border-white/[0.1] bg-white/[0.06] px-2 py-0.5 text-slate-100">
                            {person.name}
                          </span>
                          {person.title ? (
                            <span className="rounded-full border border-white/[0.1] bg-white/[0.06] px-2 py-0.5 text-slate-300">
                              {person.title}
                            </span>
                          ) : null}
                        </p>
                      ))}
                    </div>
                  ) : null}
                  <p className="mt-1 text-xs text-slate-500">{note.discussedAt ? "Discussed" : "To discuss"}</p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(note.id);
                      setDraft({
                        title: note.title,
                        body: note.body,
                        people: note.people.length ? note.people.map((person) => person.name) : [""],
                        projectIds: note.projects.map((project) => project.id),
                      });
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
