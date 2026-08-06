export type PlannerBoardGroup = "blocharch" | "personal";

export const PLANNER_BOARD_GROUPS: PlannerBoardGroup[] = ["blocharch", "personal"];

export const PLANNER_BOARD_GROUP_LABELS: Record<PlannerBoardGroup, string> = {
  blocharch: "Blocharch",
  personal: "Personal",
};

/** Outbox + project kanbans live under Blocharch. */
const BLOCHARCH_KINDS = new Set(["blocharch_outbox", "project"]);

export function plannerBoardGroup(kind?: string | null): PlannerBoardGroup {
  if (kind && BLOCHARCH_KINDS.has(kind)) return "blocharch";
  return "personal";
}

export function isPlannerBoardGroup(value: string | null): value is PlannerBoardGroup {
  return value === "blocharch" || value === "personal";
}

/** Accept legacy `group=projects` URLs as Blocharch. */
export function normalizePlannerBoardGroup(
  value: string | null
): PlannerBoardGroup | null {
  if (value === "projects") return "blocharch";
  if (isPlannerBoardGroup(value)) return value;
  return null;
}

export function defaultPlannerBoardGroup(
  boards: Array<{ kind?: string | null }>
): PlannerBoardGroup {
  for (const group of PLANNER_BOARD_GROUPS) {
    if (boards.some((b) => plannerBoardGroup(b.kind) === group)) return group;
  }
  return "blocharch";
}

export function filterBoardsByGroup<T extends { kind?: string | null }>(
  boards: T[],
  group: PlannerBoardGroup
): T[] {
  return boards.filter((b) => plannerBoardGroup(b.kind) === group);
}

export function groupsWithBoards(
  boards: Array<{ kind?: string | null }>
): PlannerBoardGroup[] {
  return PLANNER_BOARD_GROUPS.filter(
    (group) => filterBoardsByGroup(boards, group).length > 0
  );
}
