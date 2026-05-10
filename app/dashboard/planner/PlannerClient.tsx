"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type BoardSummary = {
  id: string;
  title: string;
  scope: "personal" | "team";
  color: string;
  ownerId: string;
  updatedAt: string;
  owner: { username: string };
  _count: { columns: number };
};

type Label = { id: string; name: string; color: string };
type Assignee = { id: string; username: string };
type TaskLbl = { label: Label };

type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  sortOrder: number;
  assigneeId: string | null;
  dueAt: string | null;
  architectUrl: string | null;
  customFields: Record<string, unknown> | null;
  assignee: Assignee | null;
  labels: TaskLbl[];
  leadStage?: string | null;
};

type ColumnRow = {
  id: string;
  title: string;
  color: string;
  sortOrder: number;
  tasks: TaskRow[];
};

type MemberRow = {
  id: string;
  userId: string;
  role: string;
  user: { id: string; username: string; role: string };
};

type BoardDetail = {
  id: string;
  title: string;
  scope: "personal" | "team";
  color: string;
  ownerId: string;
  owner: Assignee;
  columns: ColumnRow[];
  labels: Label[];
  members: MemberRow[];
  editable: boolean;
  canManageMembers: boolean;
};

type AssigneeOption = { id: string; username: string; role: string };

const LEAD_STAGES = [
  "cold",
  "no_reply",
  "positive_reply",
  "follow_up_interested",
  "negative_reply",
  "follow_up_not_interested",
];

function googleEventUrl(title: string, due: Date) {
  const start = due;
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const fmt = (d: Date) =>
    d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${fmt(start)}/${fmt(end)}`,
  });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

export function PlannerClient() {
  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const [filter, setFilter] = useState<"all" | "personal" | "team">("all");
  const [boardId, setBoardId] = useState<string | null>(null);
  const [detail, setDetail] = useState<BoardDetail | null>(null);
  const [assignees, setAssignees] = useState<AssigneeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [newBoardOpen, setNewBoardOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newScope, setNewScope] = useState<"personal" | "team">("personal");
  const [taskOpen, setTaskOpen] = useState<{ columnId: string } | null>(null);
  const [editTask, setEditTask] = useState<TaskRow & { columnId: string } | null>(null);
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);

  const refreshBoards = useCallback(async () => {
    const r = await fetch("/api/planner/boards");
    const j = await r.json();
    if (r.ok) setBoards(j.boards || []);
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    const r = await fetch(`/api/planner/boards/${encodeURIComponent(id)}`);
    if (!r.ok) return;
    const j = await r.json();
    setDetail(j as BoardDetail);
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      refreshBoards(),
      fetch("/api/planner/assignees")
        .then((r) => r.json())
        .then((j) => setAssignees(j.users || [])),
    ]).finally(() => setLoading(false));
  }, [refreshBoards]);

  useEffect(() => {
    if (!boardId && boards.length > 0) {
      setBoardId(boards[0].id);
    }
  }, [boards, boardId]);

  useEffect(() => {
    if (boardId) loadDetail(boardId);
  }, [boardId, loadDetail]);

  const filteredBoards = useMemo(() => {
    if (filter === "all") return boards;
    return boards.filter((b) => b.scope === filter);
  }, [boards, filter]);

  async function createBoard(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/planner/boards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle, scope: newScope }),
    });
    if (!r.ok) return;
    setNewTitle("");
    setNewBoardOpen(false);
    await refreshBoards();
    const j = await r.json();
    if (j.board?.id) setBoardId(j.board.id);
  }

  async function addTask(
    columnId: string,
    data: {
      title: string;
      assigneeId?: string | null;
      dueAt?: string | null;
      architectUrl?: string | null;
      labelIds?: string[];
    }
  ) {
    const r = await fetch("/api/planner/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ columnId, ...data }),
    });
    if (r.ok && boardId) await loadDetail(boardId);
  }

  async function patchTask(
    taskId: string,
    body: Record<string, unknown>
  ) {
    const r = await fetch(`/api/planner/tasks/${encodeURIComponent(taskId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (r.ok && boardId) await loadDetail(boardId);
  }

  async function onDropColumn(columnId: string) {
    if (!dragTaskId || !detail?.editable) return;
    await patchTask(dragTaskId, { columnId });
    setDragTaskId(null);
  }

  async function createLabel(name: string, color: string) {
    if (!boardId) return;
    await fetch(`/api/planner/boards/${encodeURIComponent(boardId)}/labels`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, color }),
    });
    await loadDetail(boardId);
  }

  async function addMember(userId: string, role: "editor" | "viewer") {
    if (!boardId) return;
    await fetch(`/api/planner/boards/${encodeURIComponent(boardId)}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, role }),
    });
    await loadDetail(boardId);
  }

  async function removeMember(userId: string) {
    if (!boardId) return;
    await fetch(
      `/api/planner/boards/${encodeURIComponent(boardId)}/members/${encodeURIComponent(userId)}`,
      { method: "DELETE" }
    );
    await loadDetail(boardId);
  }

  const icsUrl =
    typeof window !== "undefined" && boardId
      ? `${window.location.origin}/api/planner/boards/${encodeURIComponent(boardId)}/calendar`
      : "";

  if (loading) {
    return <p className="text-slate-500 text-sm">Loading planner…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {(["all", "personal", "team"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium ring-1 transition-colors ${
                filter === f
                  ? "bg-brand-500/20 text-brand-200 ring-brand-500/30"
                  : "bg-white/[0.04] text-slate-400 ring-white/[0.08] hover:bg-white/[0.07]"
              }`}
            >
              {f === "all" ? "All boards" : f === "personal" ? "Personal" : "Team"}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setNewBoardOpen(true)}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-brand-500"
        >
          New board
        </button>
      </div>

      {newBoardOpen && (
        <form
          onSubmit={createBoard}
          className="card-tool flex flex-wrap items-end gap-3 rounded-xl p-4"
        >
          <label className="text-xs text-slate-400">
            Title
            <input
              required
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="mt-1 block w-56 rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
              placeholder="Q1 pipeline"
            />
          </label>
          <label className="text-xs text-slate-400">
            Scope
            <select
              value={newScope}
              onChange={(e) => setNewScope(e.target.value as "personal" | "team")}
              className="mt-1 block rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
            >
              <option value="personal">Personal</option>
              <option value="team">Team</option>
            </select>
          </label>
          <button type="submit" className="rounded-lg bg-white/[0.08] px-4 py-2 text-sm text-slate-100">
            Create
          </button>
          <button
            type="button"
            onClick={() => setNewBoardOpen(false)}
            className="text-sm text-slate-500"
          >
            Cancel
          </button>
        </form>
      )}

      <div className="flex flex-wrap gap-2">
        {filteredBoards.map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => setBoardId(b.id)}
            className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
              boardId === b.id
                ? "border-brand-500/40 bg-brand-500/10 text-brand-100"
                : "border-white/[0.08] bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]"
            }`}
            style={{ borderLeftWidth: 4, borderLeftColor: b.color }}
          >
            <span className="font-medium">{b.title}</span>
            <span className="ml-2 text-[10px] uppercase text-slate-500">{b.scope}</span>
          </button>
        ))}
        {filteredBoards.length === 0 ? (
          <p className="text-sm text-slate-500">No boards yet — create one to get started.</p>
        ) : null}
      </div>

      {detail && (
        <>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">{detail.title}</h2>
              <p className="text-xs text-slate-500">
                {detail.scope === "team" ? "Team board" : "Personal board"} · Owner{" "}
                {detail.owner.username}
                {!detail.editable ? " · View only" : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {icsUrl ? (
                <a
                  href={icsUrl}
                  className="rounded-lg border border-white/[0.1] bg-white/[0.05] px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-white/[0.08]"
                >
                  Download calendar (.ics)
                </a>
              ) : null}
            </div>
          </div>

          {detail.canManageMembers && detail.scope === "team" && (
            <div className="card-tool rounded-xl p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Team access
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Editors move cards; viewers see only. Managers and admins can open all team boards.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <MemberAddForm assignees={assignees} onAdd={addMember} currentIds={detail.members.map((m) => m.userId)} />
              </div>
              <ul className="mt-3 space-y-1 text-sm text-slate-400">
                {detail.members.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-2">
                    <span>
                      {m.user.username}{" "}
                      <span className="text-xs text-slate-600">({m.role})</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => removeMember(m.userId)}
                      className="text-xs text-red-400/90 hover:text-red-300"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {detail.editable && (
            <div className="card-tool rounded-xl p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Labels</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {detail.labels.map((l) => (
                  <span
                    key={l.id}
                    className="rounded-full px-2.5 py-0.5 text-xs font-medium text-white ring-1 ring-white/15"
                    style={{ backgroundColor: `${l.color}40` }}
                  >
                    {l.name}
                  </span>
                ))}
                <LabelInlineForm onCreate={createLabel} />
              </div>
            </div>
          )}

          <div className="flex gap-4 overflow-x-auto pb-4">
            {detail.columns.map((col) => (
              <div
                key={col.id}
                className="flex w-[280px] shrink-0 flex-col rounded-xl border border-white/[0.08] bg-white/[0.02]"
                onDragOver={(e) => {
                  e.preventDefault();
                }}
                onDrop={() => onDropColumn(col.id)}
              >
                <div
                  className="border-b border-white/[0.06] px-3 py-2"
                  style={{ borderTopWidth: 3, borderTopColor: col.color }}
                >
                  <p className="text-sm font-semibold text-slate-200">{col.title}</p>
                </div>
                <div className="flex flex-1 flex-col gap-2 p-2">
                  {col.tasks.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      draggable={detail.editable}
                      onDragStart={() => setDragTaskId(t.id)}
                      onClick={() => setEditTask({ ...t, columnId: col.id })}
                      className="w-full rounded-lg border border-white/[0.06] bg-white/[0.04] p-3 text-left text-sm text-slate-200 hover:bg-white/[0.07]"
                    >
                      <p className="font-medium text-white">{t.title}</p>
                      {t.assignee ? (
                        <p className="mt-1 text-[11px] text-slate-500">{t.assignee.username}</p>
                      ) : null}
                      {t.dueAt ? (
                        <p className="mt-0.5 text-[11px] text-amber-200/90">
                          Due {new Date(t.dueAt).toLocaleString()}
                        </p>
                      ) : null}
                      {t.architectUrl ? (
                        <p className="mt-1 text-[10px] text-brand-400">Lead workflow linked</p>
                      ) : null}
                      {t.leadStage ? (
                        <p className="mt-0.5 text-[10px] uppercase text-slate-500">
                          Stage: {t.leadStage.replace(/_/g, " ")}
                        </p>
                      ) : null}
                      <div className="mt-2 flex flex-wrap gap-1">
                        {t.labels.map((x) => (
                          <span
                            key={x.label.id}
                            className="rounded px-1.5 py-0.5 text-[10px] text-white"
                            style={{ backgroundColor: `${x.label.color}50` }}
                          >
                            {x.label.name}
                          </span>
                        ))}
                      </div>
                    </button>
                  ))}
                  {detail.editable && (
                    <button
                      type="button"
                      onClick={() => setTaskOpen({ columnId: col.id })}
                      className="rounded-lg border border-dashed border-white/[0.12] py-2 text-xs text-slate-500 hover:border-brand-500/30 hover:text-brand-300"
                    >
                      + Add task
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {taskOpen && detail.editable && (
            <TaskFormModal
              labels={detail.labels}
              assignees={assignees}
              onClose={() => setTaskOpen(null)}
              onSave={async (payload) => {
                await addTask(taskOpen.columnId, payload);
                setTaskOpen(null);
              }}
            />
          )}

          {editTask && detail.editable && (
            <EditTaskModal
              task={editTask}
              labels={detail.labels}
              assignees={assignees}
              onClose={() => setEditTask(null)}
              onSave={async (taskId, payload) => {
                await patchTask(taskId, payload);
                setEditTask(null);
              }}
              onDelete={async (taskId) => {
                await fetch(`/api/planner/tasks/${encodeURIComponent(taskId)}`, { method: "DELETE" });
                setEditTask(null);
                if (boardId) await loadDetail(boardId);
              }}
            />
          )}
        </>
      )}
    </div>
  );
}

function LabelInlineForm({ onCreate }: { onCreate: (name: string, color: string) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#22c55e");
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full border border-dashed border-white/20 px-2 py-0.5 text-[11px] text-slate-500"
      >
        + Label
      </button>
    );
  }
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) onCreate(name.trim(), color);
        setName("");
        setOpen(false);
      }}
    >
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Label"
        className="w-24 rounded border border-white/10 bg-black/30 px-2 py-0.5 text-xs"
      />
      <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-6 w-8 cursor-pointer rounded border-0" />
      <button type="submit" className="text-xs text-brand-400">
        Add
      </button>
    </form>
  );
}

function MemberAddForm({
  assignees,
  onAdd,
  currentIds,
}: {
  assignees: AssigneeOption[];
  onAdd: (userId: string, role: "editor" | "viewer") => void;
  currentIds: string[];
}) {
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<"editor" | "viewer">("editor");
  const options = assignees.filter((u) => !currentIds.includes(u.id));
  return (
    <>
      <select
        value={userId}
        onChange={(e) => setUserId(e.target.value)}
        className="rounded-md border border-white/[0.08] bg-white/[0.04] px-2 py-1.5 text-xs text-slate-200"
      >
        <option value="">Add teammate…</option>
        {options.map((u) => (
          <option key={u.id} value={u.id}>
            {u.username}
          </option>
        ))}
      </select>
      <select
        value={role}
        onChange={(e) => setRole(e.target.value as "editor" | "viewer")}
        className="rounded-md border border-white/[0.08] bg-white/[0.04] px-2 py-1.5 text-xs"
      >
        <option value="editor">Editor</option>
        <option value="viewer">Viewer</option>
      </select>
      <button
        type="button"
        disabled={!userId}
        onClick={() => {
          if (userId) onAdd(userId, role);
          setUserId("");
        }}
        className="rounded-md bg-white/[0.08] px-3 py-1.5 text-xs font-medium text-slate-100 disabled:opacity-50"
      >
        Add
      </button>
    </>
  );
}

function TaskFormModal({
  labels,
  assignees,
  onClose,
  onSave,
}: {
  labels: Label[];
  assignees: AssigneeOption[];
  onClose: () => void;
  onSave: (p: {
    title: string;
    assigneeId?: string | null;
    dueAt?: string | null;
    architectUrl?: string | null;
    labelIds?: string[];
  }) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [due, setDue] = useState("");
  const [architectUrl, setArchitectUrl] = useState("");
  const [labelIds, setLabelIds] = useState<string[]>([]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/[0.1] bg-slate-900 p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-white">New task</h3>
        <div className="mt-4 space-y-3 text-sm">
          <label className="block text-slate-400">
            Title
            <input
              className="mt-1 w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-white"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label className="block text-slate-400">
            Assignee
            <select
              className="mt-1 w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-white"
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
            >
              <option value="">—</option>
              {assignees.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.username}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-slate-400">
            Due (for calendar sync)
            <input
              type="datetime-local"
              className="mt-1 w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-white"
              value={due}
              onChange={(e) => setDue(e.target.value)}
            />
          </label>
          <label className="block text-slate-400">
            Architect / lead URL (integrates with lead nurturing)
            <input
              className="mt-1 w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-white"
              value={architectUrl}
              onChange={(e) => setArchitectUrl(e.target.value)}
              placeholder="https://architectdirectory.co.uk/practice/..."
            />
          </label>
          <div>
            <p className="text-slate-400">Labels</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {labels.map((l) => (
                <label key={l.id} className="flex cursor-pointer items-center gap-1 text-xs">
                  <input
                    type="checkbox"
                    checked={labelIds.includes(l.id)}
                    onChange={(e) => {
                      setLabelIds((prev) =>
                        e.target.checked ? [...prev, l.id] : prev.filter((x) => x !== l.id)
                      );
                    }}
                  />
                  <span style={{ color: l.color }}>{l.name}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="text-sm text-slate-500">
            Cancel
          </button>
          <button
            type="button"
            onClick={async () => {
              if (!title.trim()) return;
              await onSave({
                title: title.trim(),
                assigneeId: assigneeId || null,
                dueAt: due ? new Date(due).toISOString() : null,
                architectUrl: architectUrl.trim() || null,
                labelIds,
              });
            }}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-slate-950"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}

function EditTaskModal({
  task,
  labels,
  assignees,
  onClose,
  onSave,
  onDelete,
}: {
  task: TaskRow & { columnId: string };
  labels: Label[];
  assignees: AssigneeOption[];
  onClose: () => void;
  onSave: (taskId: string, body: Record<string, unknown>) => Promise<void>;
  onDelete: (taskId: string) => Promise<void>;
}) {
  const [title, setTitle] = useState(task.title);
  const [desc, setDesc] = useState(task.description || "");
  const [assigneeId, setAssigneeId] = useState(task.assigneeId || "");
  const [due, setDue] = useState(
    task.dueAt ? task.dueAt.slice(0, 16) : ""
  );
  const [architectUrl, setArchitectUrl] = useState(task.architectUrl || "");
  const [labelIds, setLabelIds] = useState(task.labels.map((x) => x.label.id));

  const dueDate = task.dueAt ? new Date(task.dueAt) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/[0.1] bg-slate-900 p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-white">Edit task</h3>
        <div className="mt-4 space-y-3 text-sm">
          <label className="block text-slate-400">
            Title
            <input
              className="mt-1 w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-white"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label className="block text-slate-400">
            Description
            <textarea
              className="mt-1 w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-white"
              rows={3}
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
            />
          </label>
          <label className="block text-slate-400">
            Assignee
            <select
              className="mt-1 w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-white"
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
            >
              <option value="">—</option>
              {assignees.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.username}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-slate-400">
            Due
            <input
              type="datetime-local"
              className="mt-1 w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-white"
              value={due}
              onChange={(e) => setDue(e.target.value)}
            />
          </label>
          <label className="block text-slate-400">
            Architect / lead URL
            <input
              className="mt-1 w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-white"
              value={architectUrl}
              onChange={(e) => setArchitectUrl(e.target.value)}
            />
          </label>
          <div>
            <p className="text-slate-400">Labels</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {labels.map((l) => (
                <label key={l.id} className="flex cursor-pointer items-center gap-1 text-xs">
                  <input
                    type="checkbox"
                    checked={labelIds.includes(l.id)}
                    onChange={(e) => {
                      setLabelIds((prev) =>
                        e.target.checked ? [...prev, l.id] : prev.filter((x) => x !== l.id)
                      );
                    }}
                  />
                  <span style={{ color: l.color }}>{l.name}</span>
                </label>
              ))}
            </div>
          </div>
          {dueDate ? (
            <a
              href={googleEventUrl(title, dueDate)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-sm text-brand-400 hover:underline"
            >
              Open in Google Calendar
            </a>
          ) : null}
        </div>
        <div className="mt-6 flex flex-wrap justify-between gap-2">
          <button
            type="button"
            onClick={() => onDelete(task.id)}
            className="text-sm text-red-400 hover:underline"
          >
            Delete task
          </button>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="text-sm text-slate-500">
              Close
            </button>
            <button
              type="button"
              onClick={async () => {
                await onSave(task.id, {
                  title: title.trim(),
                  description: desc || null,
                  assigneeId: assigneeId || null,
                  dueAt: due ? new Date(due).toISOString() : null,
                  architectUrl: architectUrl.trim() || null,
                  labelIds,
                });
              }}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-slate-950"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
