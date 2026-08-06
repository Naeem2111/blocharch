/** System boards hidden from planner UI (legacy or retired). */
const HIDDEN_PLANNER_BOARD_KINDS = new Set(["blocharch_inbox", "my_tasks"]);

export function isPlannerBoardHiddenFromUi(kind?: string | null): boolean {
  return !!kind && HIDDEN_PLANNER_BOARD_KINDS.has(kind);
}

export function filterVisiblePlannerBoards<T extends { kind?: string | null }>(boards: T[]): T[] {
  return boards.filter((b) => !isPlannerBoardHiddenFromUi(b.kind));
}
