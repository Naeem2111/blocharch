"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";

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
  summary: string | null;
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

/** Snippet from task description for board cards */
function taskCardDescriptionPreview(description: string | null): string | null {
  const body = (description ?? "").trim();
  if (!body) return null;
  const line = body
    .split(/\r?\n/)
    .map((x) => x.trim())
    .find((x) => x.length > 0);
  return line ?? body.slice(0, 280);
}

/** Column used for “mark done” — explicit Done/Completed title, else last column if there are at least two */
function resolveCompletedColumnId(columns: ColumnRow[]): string | null {
  const named = columns.find((c) => /^(done|completed)\b/i.test(c.title.trim()));
  if (named) return named.id;
  if (columns.length >= 2) return columns[columns.length - 1]!.id;
  return null;
}

const PLANNER_SHORT_DESC_HINT =
  "Brief preview on the board. Paragraphs or lists work (– or • for bullets; line breaks stay).";

const PLANNER_LONG_DESC_HINT =
  "Detailed notes: paragraphs, bullets (– •), or numbered lines (1. 2.). Plain text — line breaks are kept.";

function normalizeColumnTaskOrder(col: ColumnRow): ColumnRow {
  return {
    ...col,
    tasks: col.tasks.map((t, i) => ({ ...t, sortOrder: i })),
  };
}

/** insertBeforeTaskId: insert moved task before this row; null = append to column tail. */
function plannerDetailAfterMovingTask(
  detail: BoardDetail,
  taskId: string,
  destColumnId: string,
  insertBeforeTaskId: string | null
): BoardDetail {
  let mover: TaskRow | null = null;

  const stripped = detail.columns.map((col) => {
    const found = col.tasks.find((t) => t.id === taskId);
    if (!found) return col;
    mover = found;
    return {
      ...col,
      tasks: col.tasks.filter((t) => t.id !== taskId),
    };
  });

  if (!mover) return detail;

  const merged = stripped.map((col) => {
    if (col.id !== destColumnId) return col;
    const ts = [...col.tasks];
    let insertAt = ts.length;
    if (insertBeforeTaskId !== null) {
      const bi = ts.findIndex((t) => t.id === insertBeforeTaskId);
      insertAt = bi === -1 ? ts.length : bi;
    }
    const mergedTasks = [...ts.slice(0, insertAt), mover!, ...ts.slice(insertAt)].map((t, i) => ({
      ...t,
      sortOrder: i,
    }));
    return {
      ...col,
      tasks: mergedTasks,
    };
  });

  return {
    ...detail,
    columns: merged.map(normalizeColumnTaskOrder),
  };
}

/** Where to slice a card vertically for “drop before vs after”. */
function taskCardDropPlacement(e: React.DragEvent, cardEl: HTMLElement): "before" | "after" {
  const r = cardEl.getBoundingClientRect();
  return e.clientY < r.top + r.height / 2 ? "before" : "after";
}

function insertAnchorBeforeId(
  columnTasks: TaskRow[],
  hoveredTaskId: string,
  placement: "before" | "after",
  draggingId: string | null
): string | null {
  const sans = draggingId ? columnTasks.filter((t) => t.id !== draggingId) : columnTasks;
  if (placement === "before") return hoveredTaskId;
  const ti = sans.findIndex((t) => t.id === hoveredTaskId);
  if (ti === -1) return null;
  const nextRow = sans[ti + 1];
  return nextRow ? nextRow.id : null;
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
  const [dropTargetColumnId, setDropTargetColumnId] = useState<string | null>(null);
  /** Drop stripe: insert before row id (null = end of column). */
  const [taskDropGuide, setTaskDropGuide] = useState<{
    columnId: string;
    beforeTaskId: string | null;
  } | null>(null);
  const [addColumnOpen, setAddColumnOpen] = useState(false);
  const [newColTitle, setNewColTitle] = useState("");
  const [newColColor, setNewColColor] = useState("#64748b");

  const suppressNextCardClickRef = useRef(false);
  /** Mirrors dragTaskId for drop handlers (state can lag in edge timings). */
  const dragTaskIdRef = useRef<string | null>(null);
  const detailRef = useRef(detail);

  useEffect(() => {
    detailRef.current = detail;
  }, [detail]);

  useEffect(() => {
    dragTaskIdRef.current = dragTaskId;
  }, [dragTaskId]);

  const completedColumnId = useMemo(
    () => (detail ? resolveCompletedColumnId(detail.columns) : null),
    [detail]
  );

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
      summary?: string | null;
      description?: string | null;
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
    body: Record<string, unknown>,
    options?: { reloadOnSuccess?: boolean }
  ): Promise<boolean> {
    const reloadOnSuccess = options?.reloadOnSuccess !== false;
    const r = await fetch(`/api/planner/tasks/${encodeURIComponent(taskId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) return false;
    if (reloadOnSuccess && boardId) await loadDetail(boardId);
    return true;
  }

  const persistTaskOrder = useCallback(
    async (snapshot: BoardDetail) => {
      try {
        const r = await fetch(
          `/api/planner/boards/${encodeURIComponent(snapshot.id)}/reorder-tasks`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              columns: snapshot.columns.map((c) => ({
                columnId: c.id,
                taskIds: c.tasks.map((t) => t.id),
              })),
            }),
          }
        );
        if (!r.ok && boardId) await loadDetail(boardId);
      } catch {
        if (boardId) await loadDetail(boardId);
      }
    },
    [boardId, loadDetail]
  );

  /** Reorder visually, then POST full layout once (server catches up in background). */
  function reorderTasksAndPersist(
    snapshot: BoardDetail,
    taskId: string,
    destColumnId: string,
    insertBeforeTaskId: string | null
  ) {
    const nextDetail = plannerDetailAfterMovingTask(
      snapshot,
      taskId,
      destColumnId,
      insertBeforeTaskId
    );
    setDetail(nextDetail);
    void persistTaskOrder(nextDetail);
  }

  function resolveDraggedTaskId(dataTransfer?: DataTransfer | null) {
    return (
      dragTaskIdRef.current ||
      dragTaskId ||
      dataTransfer?.getData("text/plain")?.trim() ||
      null
    );
  }

  async function onDropColumn(columnId: string, dataTransfer?: DataTransfer | null) {
    const snap = detailRef.current;
    if (!snap?.editable) return;
    const taskId = resolveDraggedTaskId(dataTransfer)?.trim() || null;
    setDropTargetColumnId(null);
    setTaskDropGuide(null);
    setDragTaskId(null);
    dragTaskIdRef.current = null;
    if (!taskId) return;

    reorderTasksAndPersist(snap, taskId, columnId, null);
  }

  /** Drop onto a card outline: insert relative to midpoint. */
  function onDropCard(columnId: string, anchorTaskId: string, e: React.DragEvent) {
    const snap = detailRef.current;
    if (!snap?.editable) return;
    const taskIdRaw = resolveDraggedTaskId(e.dataTransfer)?.trim() || null;
    setDropTargetColumnId(null);
    setTaskDropGuide(null);
    setDragTaskId(null);
    dragTaskIdRef.current = null;
    if (!taskIdRaw || !snap) return;
    /** Dropping onto the card itself has no insertion anchor once the row is stripped. */
    if (anchorTaskId === taskIdRaw) return;

    const col = snap.columns.find((c) => c.id === columnId);
    if (!col) return;

    const placement = taskCardDropPlacement(e, e.currentTarget as HTMLElement);
    const beforeId = insertAnchorBeforeId(col.tasks, anchorTaskId, placement, taskIdRaw);

    reorderTasksAndPersist(snap, taskIdRaw, columnId, beforeId);
  }

  /** Hits the flex gutter between cards — insert before anchor task without relying on midpoint. */
  function onDropInsertRail(columnId: string, insertBeforeTaskId: string | null, e: React.DragEvent) {
    const snap = detailRef.current;
    if (!snap?.editable) return;
    const taskIdRaw = resolveDraggedTaskId(e.dataTransfer)?.trim() || null;
    setDropTargetColumnId(null);
    setTaskDropGuide(null);
    setDragTaskId(null);
    dragTaskIdRef.current = null;
    if (!taskIdRaw) return;

    reorderTasksAndPersist(snap, taskIdRaw, columnId, insertBeforeTaskId);
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

  async function patchLabel(labelId: string, patch: { name?: string; color?: string }): Promise<boolean> {
    const r = await fetch(`/api/planner/labels/${encodeURIComponent(labelId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      window.alert((j as { error?: string }).error || "Could not update label");
      return false;
    }
    if (boardId) await loadDetail(boardId);
    return true;
  }

  async function deleteLabel(labelId: string) {
    const r = await fetch(`/api/planner/labels/${encodeURIComponent(labelId)}`, {
      method: "DELETE",
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      window.alert((j as { error?: string }).error || "Could not delete label");
      return;
    }
    if (boardId) await loadDetail(boardId);
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

  async function patchColumnApi(id: string, patch: Record<string, unknown>) {
    return fetch(`/api/planner/columns/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
  }

  async function patchColumn(id: string, patch: Record<string, unknown>) {
    const r = await patchColumnApi(id, patch);
    if (r.ok && boardId) await loadDetail(boardId);
  }

  async function reorderColumns(fromIdx: number, toIdx: number) {
    if (!detail || !boardId || toIdx < 0 || toIdx >= detail.columns.length) return;
    const a = detail.columns[fromIdx];
    const b = detail.columns[toIdx];
    if (!a || !b) return;
    const nextCols = [...detail.columns];
    nextCols[fromIdx] = { ...b, sortOrder: a.sortOrder };
    nextCols[toIdx] = { ...a, sortOrder: b.sortOrder };
    setDetail({ ...detail, columns: nextCols });

    const aOrder = a.sortOrder;
    const bOrder = b.sortOrder;
    const [r1, r2] = await Promise.all([
      patchColumnApi(a.id, { sortOrder: bOrder }),
      patchColumnApi(b.id, { sortOrder: aOrder }),
    ]);
    if (!r1.ok || !r2.ok) await loadDetail(boardId);
  }

  async function addColumn() {
    if (!boardId || !newColTitle.trim()) return;
    const r = await fetch(`/api/planner/boards/${encodeURIComponent(boardId)}/columns`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newColTitle.trim(), color: newColColor }),
    });
    if (r.ok) {
      setNewColTitle("");
      setNewColColor("#64748b");
      setAddColumnOpen(false);
      await loadDetail(boardId);
    }
  }

  async function deleteColumn(columnId: string) {
    const r = await fetch(`/api/planner/columns/${encodeURIComponent(columnId)}`, {
      method: "DELETE",
    });
    if (r.ok && boardId) await loadDetail(boardId);
    else if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      window.alert(j?.error || "Could not delete column");
    }
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
              className="select-console mt-1 block rounded-md px-3 py-2 text-sm"
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
                {detail.editable ? (
                  <>
                    {" "}
                    · Drag cards to reorder (drop on the top or bottom half of a card) or move lists; the
                    board updates instantly and syncs in the background.
                    {completedColumnId ? (
                      <>
                        {" "}
                        Done checkbox moves to Done/Completed (or the last column when there isn’t one
                        titled Done).
                      </>
                    ) : null}
                  </>
                ) : null}
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
              <p className="mt-1 text-[11px] text-slate-600">
                Edit name or colour anytime. Deleting removes the tag from every task on this board.
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {detail.labels.map((l) => (
                  <EditableLabelChip
                    key={l.id}
                    label={l}
                    onPatch={patchLabel}
                    onDelete={deleteLabel}
                  />
                ))}
                <LabelInlineForm onCreate={createLabel} />
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-end gap-4">
          <div className="flex min-w-0 flex-1 gap-4 overflow-x-auto pb-4">
            {detail.columns.map((col, colIdx) => (
              <div
                key={col.id}
                className={`flex w-[280px] shrink-0 flex-col rounded-xl border border-white/[0.08] bg-white/[0.02] transition-[box-shadow,background-color,border-color] duration-150 ${
                  detail.editable && dragTaskId && dropTargetColumnId === col.id
                    ? "border-brand-500/35 bg-brand-500/[0.07] ring-2 ring-brand-500/25"
                    : ""
                }`}
                onDragOver={(e) => {
                  if (!detail.editable || !dragTaskId) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  setDropTargetColumnId(col.id);
                }}
                onDragLeave={(e) => {
                  if (!detail.editable || !dragTaskId) return;
                  const related = e.relatedTarget as Node | null;
                  if (related && e.currentTarget.contains(related)) return;
                  setDropTargetColumnId((prev) => (prev === col.id ? null : prev));
                  setTaskDropGuide((prev) => (prev?.columnId === col.id ? null : prev));
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  void onDropColumn(col.id, e.dataTransfer);
                }}
              >
                <EditableColumnHeader
                  column={col}
                  editable={detail.editable}
                  colIndex={colIdx}
                  totalColumns={detail.columns.length}
                  onPatch={patchColumn}
                  onDelete={deleteColumn}
                  onReorder={reorderColumns}
                />
                <div
                  className={`flex min-h-[160px] flex-1 flex-col space-y-3 p-2 transition-colors duration-150 ${
                    detail.editable && dragTaskId && dropTargetColumnId === col.id
                      ? "rounded-lg bg-brand-500/[0.06]"
                      : ""
                  }`}
                  onDragOver={(e) => {
                    if (!detail.editable || !dragTaskId || col.tasks.length > 0) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    setDropTargetColumnId(col.id);
                    setTaskDropGuide({ columnId: col.id, beforeTaskId: null });
                  }}
                  onDrop={(e) => {
                    if (col.tasks.length > 0) return;
                    e.preventDefault();
                    e.stopPropagation();
                    void onDropColumn(col.id, e.dataTransfer);
                  }}
                >
                  {col.tasks.map((t) => {
                    const descPreview = taskCardDescriptionPreview(t.description);
                    const showDoneTick =
                      detail.editable && completedColumnId !== null && detail.columns.length >= 2;
                    const isInDoneColumn = col.id === completedColumnId;
                    const showInsertLine =
                      detail.editable &&
                      dragTaskId &&
                      dragTaskId !== t.id &&
                      taskDropGuide?.columnId === col.id &&
                      taskDropGuide.beforeTaskId === t.id;

                    return (
                      <Fragment key={t.id}>
                        {showInsertLine ? (
                          <div
                            role="presentation"
                            aria-hidden
                            className="-mx-0.5 h-0.5 shrink-0 rounded-full bg-brand-400/85 shadow-[0_0_8px_rgba(52,211,153,0.35)]"
                          />
                        ) : null}
                      {detail.editable && dragTaskId && dragTaskId !== t.id ? (
                        <div
                          role="separator"
                          aria-orientation="horizontal"
                          aria-label="Drop to insert row here"
                          className={`h-[12px] shrink-0 rounded-md border transition-colors md:h-[14px] ${
                            dragTaskId && taskDropGuide?.columnId === col.id && taskDropGuide.beforeTaskId === t.id
                              ? "border-brand-400/50 bg-brand-500/15"
                              : "border-transparent bg-transparent hover:border-brand-500/25 hover:bg-brand-500/10"
                          }`}
                          onDragOver={(e) => {
                            if (!dragTaskId) return;
                            e.preventDefault();
                            e.stopPropagation();
                            e.dataTransfer.dropEffect = "move";
                            setDropTargetColumnId(col.id);
                            setTaskDropGuide({ columnId: col.id, beforeTaskId: t.id });
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onDropInsertRail(col.id, t.id, e);
                          }}
                        />
                      ) : null}
                      <div
                        role={detail.editable ? "button" : undefined}
                        tabIndex={detail.editable ? 0 : undefined}
                        draggable={detail.editable}
                        onDragStart={(e) => {
                          if (!detail.editable) return;
                          suppressNextCardClickRef.current = false;
                          dragTaskIdRef.current = t.id;
                          setDragTaskId(t.id);
                          e.dataTransfer.effectAllowed = "move";
                          e.dataTransfer.setData("text/plain", t.id);
                          const card = e.currentTarget;
                          try {
                            const ghost = card.cloneNode(true) as HTMLElement;
                            ghost.style.width = `${card.offsetWidth}px`;
                            ghost.style.opacity = "0.92";
                            ghost.style.transform = "rotate(2deg)";
                            ghost.style.boxShadow = "0 12px 40px rgba(0,0,0,0.45)";
                            ghost.style.borderRadius = "0.5rem";
                            ghost.style.pointerEvents = "none";
                            ghost.style.position = "absolute";
                            ghost.style.top = "-9999px";
                            ghost.style.left = "0";
                            document.body.appendChild(ghost);
                            e.dataTransfer.setDragImage(ghost, e.clientX - card.getBoundingClientRect().left, e.clientY - card.getBoundingClientRect().top);
                            requestAnimationFrame(() =>
                              requestAnimationFrame(() => {
                                ghost.remove();
                              })
                            );
                          } catch {
                            /* setDragImage unsupported — fallback to default preview */
                          }
                        }}
                        onDragEnd={() => {
                          dragTaskIdRef.current = null;
                          setDragTaskId(null);
                          setDropTargetColumnId(null);
                          setTaskDropGuide(null);
                          suppressNextCardClickRef.current = true;
                        }}
                        onDragOver={(e) => {
                          if (!detail.editable || !dragTaskId || dragTaskId === t.id) return;
                          e.preventDefault();
                          e.stopPropagation();
                          e.dataTransfer.dropEffect = "move";
                          setDropTargetColumnId(col.id);
                          const placement = taskCardDropPlacement(e, e.currentTarget as HTMLElement);
                          const guideBeforeId = insertAnchorBeforeId(
                            col.tasks,
                            t.id,
                            placement,
                            dragTaskId
                          );
                          setTaskDropGuide({ columnId: col.id, beforeTaskId: guideBeforeId });
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          void onDropCard(col.id, t.id, e);
                        }}
                        onClick={() => {
                          if (suppressNextCardClickRef.current) {
                            suppressNextCardClickRef.current = false;
                            return;
                          }
                          setEditTask({ ...t, columnId: col.id });
                        }}
                        onKeyDown={(e) => {
                          if (!detail.editable) return;
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setEditTask({ ...t, columnId: col.id });
                          }
                        }}
                        className={`w-full rounded-lg border border-white/[0.06] bg-white/[0.04] p-3 text-left text-sm text-slate-200 outline-none transition-[opacity,transform,box-shadow] duration-150 hover:bg-white/[0.07] focus-visible:ring-2 focus-visible:ring-brand-500/50 ${
                          detail.editable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
                        } ${
                          dragTaskId === t.id
                            ? "opacity-35 scale-[0.985] shadow-inner ring-1 ring-brand-500/30"
                            : ""
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          {showDoneTick ? (
                            <label
                              className="mt-0.5 shrink-0 cursor-pointer"
                              onClick={(e) => e.stopPropagation()}
                              onPointerDown={(e) => e.stopPropagation()}
                              onKeyDown={(e) => e.stopPropagation()}
                            >
                              <input
                                type="checkbox"
                                checked={isInDoneColumn}
                                title={isInDoneColumn ? "Move out of Done" : "Mark done"}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  const snap = detailRef.current;
                                  const doneId = completedColumnId;
                                  const firstId = snap?.columns[0]?.id;
                                  if (!doneId || !firstId || !snap) return;
                                  if (e.target.checked) {
                                    reorderTasksAndPersist(snap, t.id, doneId, null);
                                  } else {
                                    reorderTasksAndPersist(snap, t.id, firstId, null);
                                  }
                                }}
                                className="h-3.5 w-3.5 rounded border-white/20 bg-white/[0.06] text-brand-500 focus:ring-brand-500"
                              />
                            </label>
                          ) : null}
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-white">{t.title}</p>
                            {descPreview ? (
                              <p className="mt-1 line-clamp-4 whitespace-pre-wrap text-[12px] leading-snug text-slate-400">
                                {descPreview}
                              </p>
                            ) : null}
                            {t.labels.length > 0 ? (
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
                            ) : null}
                          </div>
                        </div>
                      </div>
                      </Fragment>
                    );
                  })}
                  {detail.editable && dragTaskId && col.tasks.length > 0 ? (
                    <div
                      role="separator"
                      aria-orientation="horizontal"
                      aria-label="Drop to add at bottom of column"
                      className={`h-[14px] shrink-0 rounded-md border transition-colors ${
                        taskDropGuide?.columnId === col.id && taskDropGuide.beforeTaskId === null
                          ? "border-brand-400/50 bg-brand-500/15"
                          : "border-transparent hover:border-brand-500/25 hover:bg-brand-500/10"
                      }`}
                      onDragOver={(e) => {
                        if (!dragTaskId) return;
                        e.preventDefault();
                        e.stopPropagation();
                        e.dataTransfer.dropEffect = "move";
                        setDropTargetColumnId(col.id);
                        setTaskDropGuide({ columnId: col.id, beforeTaskId: null });
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onDropInsertRail(col.id, null, e);
                      }}
                    />
                  ) : null}
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
            {detail.editable ? (
              <div className="flex w-[260px] shrink-0 flex-col gap-2 rounded-xl border border-dashed border-white/[0.12] bg-white/[0.02] p-3">
                {!addColumnOpen ? (
                  <button
                    type="button"
                    onClick={() => setAddColumnOpen(true)}
                    className="rounded-lg py-8 text-sm text-slate-500 hover:text-brand-300"
                  >
                    + Add column
                  </button>
                ) : (
                  <form
                    className="flex flex-col gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void addColumn();
                    }}
                  >
                    <p className="text-xs font-medium text-slate-400">New column</p>
                    <input
                      required
                      value={newColTitle}
                      onChange={(e) => setNewColTitle(e.target.value)}
                      placeholder="Column title"
                      className="rounded-md border border-white/[0.08] bg-white/[0.04] px-2 py-1.5 text-sm text-white"
                    />
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-1 text-xs text-slate-500">
                        Colour
                        <input
                          type="color"
                          value={newColColor}
                          onChange={(e) => setNewColColor(e.target.value)}
                          className="h-8 w-10 cursor-pointer rounded border-0 bg-transparent"
                        />
                      </label>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-slate-950"
                      >
                        Add
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAddColumnOpen(false);
                          setNewColTitle("");
                        }}
                        className="text-xs text-slate-500"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </div>
            ) : null}
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
              key={editTask.id}
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

function EditableColumnHeader({
  column,
  editable,
  colIndex,
  totalColumns,
  onPatch,
  onDelete,
  onReorder,
}: {
  column: ColumnRow;
  editable: boolean;
  colIndex: number;
  totalColumns: number;
  onPatch: (id: string, patch: Record<string, unknown>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onReorder: (from: number, to: number) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(column.title);
  const [color, setColor] = useState(column.color);

  useEffect(() => {
    setTitle(column.title);
    setColor(column.color);
  }, [column.id, column.title, column.color]);

  const canMoveLeft = colIndex > 0;
  const canMoveRight = colIndex < totalColumns - 1;
  const canDelete = totalColumns > 1 && column.tasks.length === 0;

  if (!editable) {
    return (
      <div
        className="border-b border-white/[0.06] px-3 py-2"
        style={{ borderTopWidth: 3, borderTopColor: column.color }}
      >
        <p className="text-sm font-semibold text-slate-200">{column.title}</p>
      </div>
    );
  }

  if (editing) {
    return (
      <div
        className="border-b border-white/[0.06] px-2 py-2"
        style={{ borderTopWidth: 3, borderTopColor: color }}
      >
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mb-2 w-full rounded border border-white/10 bg-black/40 px-2 py-1 text-sm text-white"
          autoFocus
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="flex items-center gap-2 text-xs text-slate-500">
            Colour
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-7 w-12 cursor-pointer rounded border-0 bg-transparent"
            />
          </label>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="text-xs text-slate-500 hover:text-slate-300"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={async () => {
                const t = title.trim();
                if (!t) return;
                await onPatch(column.id, { title: t, color });
                setEditing(false);
              }}
              className="rounded bg-brand-600 px-2 py-1 text-xs font-semibold text-slate-950"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="border-b border-white/[0.06] px-2 py-1.5"
      style={{ borderTopWidth: 3, borderTopColor: column.color }}
    >
      <div className="flex items-start justify-between gap-1">
        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-200">{column.title}</p>
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            title="Move left"
            disabled={!canMoveLeft}
            onClick={() => onReorder(colIndex, colIndex - 1)}
            className="rounded p-0.5 text-slate-500 hover:bg-white/10 hover:text-slate-200 disabled:opacity-30"
          >
            ←
          </button>
          <button
            type="button"
            title="Move right"
            disabled={!canMoveRight}
            onClick={() => onReorder(colIndex, colIndex + 1)}
            className="rounded p-0.5 text-slate-500 hover:bg-white/10 hover:text-slate-200 disabled:opacity-30"
          >
            →
          </button>
          <button
            type="button"
            title="Edit column"
            onClick={() => setEditing(true)}
            className="rounded px-1.5 py-0.5 text-xs text-brand-400 hover:bg-white/10"
          >
            Edit
          </button>
        </div>
      </div>
      {canDelete ? (
        <button
          type="button"
          onClick={() => {
            if (window.confirm("Delete this empty column?")) void onDelete(column.id);
          }}
          className="mt-1 text-[10px] text-red-400/80 hover:text-red-300"
        >
          Delete column
        </button>
      ) : null}
    </div>
  );
}

function EditableLabelChip({
  label,
  onPatch,
  onDelete,
}: {
  label: Label;
  onPatch: (id: string, patch: { name: string; color: string }) => Promise<boolean>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(label.name);
  const [color, setColor] = useState(label.color);

  useEffect(() => {
    setName(label.name);
    setColor(label.color);
  }, [label.id, label.name, label.color]);

  if (editing) {
    return (
      <form
        className="flex flex-wrap items-center gap-2 rounded-lg border border-white/[0.12] bg-white/[0.04] px-2 py-1.5"
        onSubmit={async (e) => {
          e.preventDefault();
          const n = name.trim();
          if (!n) return;
          const ok = await onPatch(label.id, { name: n, color });
          if (ok) setEditing(false);
        }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-28 rounded border border-white/10 bg-black/40 px-2 py-0.5 text-xs text-white"
          autoFocus
          maxLength={64}
        />
        <label className="flex cursor-pointer items-center gap-1 text-[10px] text-slate-500">
          Colour
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-6 w-8 cursor-pointer rounded border-0 bg-transparent"
          />
        </label>
        <button type="submit" className="text-xs font-semibold text-brand-400 hover:text-brand-300">
          Save
        </button>
        <button
          type="button"
          className="text-xs text-slate-500 hover:text-slate-300"
          onClick={() => {
            setEditing(false);
            setName(label.name);
            setColor(label.color);
          }}
        >
          Cancel
        </button>
      </form>
    );
  }

  return (
    <div
      className="flex max-w-full items-center gap-1 rounded-full py-0.5 pl-2.5 pr-1 ring-1 ring-white/15"
      style={{ backgroundColor: `${label.color}40` }}
    >
      <span className="max-w-[10rem] truncate text-xs font-medium text-white" title={label.name}>
        {label.name}
      </span>
      <button
        type="button"
        title="Edit label"
        onClick={() => setEditing(true)}
        className="shrink-0 rounded px-1.5 py-0.5 text-[10px] text-brand-400 hover:bg-white/10"
      >
        Edit
      </button>
      <button
        type="button"
        title="Delete label"
        onClick={() => {
          if (
            window.confirm(
              `Delete label "${label.name}"? It will be removed from all tasks on this board.`
            )
          ) {
            void onDelete(label.id);
          }
        }}
        className="shrink-0 rounded px-1.5 py-0.5 text-[10px] text-red-400/90 hover:bg-white/10"
      >
        Delete
      </button>
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
        className="select-console rounded-md px-2 py-1.5 text-xs text-slate-100"
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
        className="select-console rounded-md px-2 py-1.5 text-xs text-slate-100"
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
    summary?: string | null;
    description?: string | null;
    assigneeId?: string | null;
    dueAt?: string | null;
    architectUrl?: string | null;
    labelIds?: string[];
  }) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [due, setDue] = useState("");
  const [architectUrl, setArchitectUrl] = useState("");
  const [labelIds, setLabelIds] = useState<string[]>([]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/[0.1] bg-slate-900 p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-white">New task</h3>
        <div className="mt-4 space-y-3 text-sm">
          <label className="block text-slate-400">
            Title
            <input
              className="select-console mt-1 w-full rounded-lg px-3 py-2 text-sm"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label className="block text-slate-400">
            Short summary
            <span className="mt-1 block text-[11px] font-normal leading-snug text-slate-600">
              {PLANNER_SHORT_DESC_HINT}
            </span>
            <textarea
              className="mt-2 w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 font-mono text-[13px] leading-relaxed text-white"
              rows={4}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="e.g.\nGoal: finalize brief\n- Sketch option A\n- Client sign-off "
            />
          </label>
          <label className="block text-slate-400">
            Full description
            <span className="mt-1 block text-[11px] font-normal leading-snug text-slate-600">
              {PLANNER_LONG_DESC_HINT}
            </span>
            <textarea
              className="mt-2 w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 font-mono text-[13px] leading-relaxed text-white"
              rows={12}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Longer checklist, paragraphs, numbered steps...\n\n1. First step\n2. Second step "
            />
          </label>
          <label className="block text-slate-400">
            Assignee
            <select
              className="select-console mt-1 w-full rounded-lg px-3 py-2 text-sm"
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
              className="select-console mt-1 w-full rounded-lg px-3 py-2 text-sm"
              value={due}
              onChange={(e) => setDue(e.target.value)}
            />
          </label>
          <label className="block text-slate-400">
            Architect / lead URL (integrates with lead nurturing)
            <input
              className="select-console mt-1 w-full rounded-lg px-3 py-2 text-sm"
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
                summary: summary.trim() || null,
                description: description.trim() ? description : null,
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
  const [summary, setSummary] = useState(task.summary || "");
  const [description, setDescription] = useState(task.description || "");
  const [assigneeId, setAssigneeId] = useState(task.assigneeId || "");
  const [due, setDue] = useState(
    task.dueAt ? task.dueAt.slice(0, 16) : ""
  );
  const [architectUrl, setArchitectUrl] = useState(task.architectUrl || "");
  const [labelIds, setLabelIds] = useState(task.labels.map((x) => x.label.id));

  const dueDate = task.dueAt ? new Date(task.dueAt) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/[0.1] bg-slate-900 p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-white">Edit task</h3>
        <div className="mt-4 space-y-3 text-sm">
          <label className="block text-slate-400">
            Title
            <input
              className="select-console mt-1 w-full rounded-lg px-3 py-2 text-sm"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label className="block text-slate-400">
            Short summary
            <span className="mt-1 block text-[11px] font-normal leading-snug text-slate-600">
              {PLANNER_SHORT_DESC_HINT}
            </span>
            <textarea
              className="mt-2 w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 font-mono text-[13px] leading-relaxed text-white"
              rows={5}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
            />
          </label>
          <label className="block text-slate-400">
            Full description
            <span className="mt-1 block text-[11px] font-normal leading-snug text-slate-600">
              {PLANNER_LONG_DESC_HINT}
            </span>
            <textarea
              className="mt-2 w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 font-mono text-[13px] leading-relaxed text-white"
              rows={14}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <label className="block text-slate-400">
            Assignee
            <select
              className="select-console mt-1 w-full rounded-lg px-3 py-2 text-sm"
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
              className="select-console mt-1 w-full rounded-lg px-3 py-2 text-sm"
              value={due}
              onChange={(e) => setDue(e.target.value)}
            />
          </label>
          <label className="block text-slate-400">
            Architect / lead URL
            <input
              className="select-console mt-1 w-full rounded-lg px-3 py-2 text-sm"
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
                  summary: summary.trim() || null,
                  description: description.trim() ? description : null,
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
