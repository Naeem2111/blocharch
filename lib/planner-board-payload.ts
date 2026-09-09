export const PLANNER_BOARD_TASK_LIST_SELECT = {
  id: true,
  title: true,
  summary: true,
  sortOrder: true,
  assigneeId: true,
  dueAt: true,
  linkedFromTaskId: true,
  assignee: { select: { id: true, username: true } },
  labels: { include: { label: true } },
} as const;

export const PLANNER_BOARD_DETAIL_INCLUDE = {
  owner: { select: { id: true, username: true } },
  columns: {
    orderBy: { sortOrder: "asc" as const },
    include: {
      tasks: {
        orderBy: { sortOrder: "asc" as const },
        select: PLANNER_BOARD_TASK_LIST_SELECT,
      },
    },
  },
  labels: { orderBy: { name: "asc" as const } },
  members: {
    include: { user: { select: { id: true, username: true, role: true } } },
  },
} as const;

export function serializePlannerBoardDetail(
  board: {
    id: string;
    kind: string;
    athleteId: string | null;
    isSystem: boolean;
    opsProjectId: string | null;
    columns: Array<{ tasks: Array<Record<string, unknown>>; [key: string]: unknown }>;
    [key: string]: unknown;
  },
  access: { canEdit: boolean; canManageMembers: boolean }
) {
  return {
    ...board,
    kind: board.kind,
    athleteId: board.athleteId,
    isSystem: board.isSystem,
    opsProjectId: board.opsProjectId,
    columns: board.columns.map((col) => ({
      ...col,
      tasks: col.tasks.map((t) => ({
        ...t,
        description: null,
        customFields: null,
      })),
    })),
    editable: access.canEdit,
    canManageMembers: access.canManageMembers,
  };
}
