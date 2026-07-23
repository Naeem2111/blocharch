export type PlannerBoardGroup = "blocharch" | "projects" | "personal";

export const PLANNER_BOARD_GROUPS: PlannerBoardGroup[] = [
  "blocharch",
  "projects",
  "personal",
];

export const PLANNER_BOARD_GROUP_LABELS: Record<PlannerBoardGroup, string> = {
  blocharch: "Blocharch",
  projects: "Projects",
  personal: "Personal",
};

const BLOCHARCH_KINDS = new Set(["blocharch_inbox", "blocharch_outbox", "my_tasks"]);

export function plannerBoardGroup(kind?: string | null): PlannerBoardGroup {
  if (kind === "project") return "projects";
  if (kind && BLOCHARCH_KINDS.has(kind)) return "blocharch";
  return "personal";
}

export function isPlannerBoardGroup(value: string | null): value is PlannerBoardGroup {
  return value === "blocharch" || value === "projects" || value === "personal";
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
