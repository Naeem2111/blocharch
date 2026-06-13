/** Standard Blocharch kanban labels (Jethro workflow) — seeded on every athlete/project board. */
export const DEFAULT_BOARD_LABELS = [
  { name: "Plans", color: "#3b82f6" },
  { name: "Elevations", color: "#0ea5e9" },
  { name: "Sections", color: "#06b6d4" },
  { name: "Coordination / Markups", color: "#8b5cf6" },
  { name: "Review / QA", color: "#f59e0b" },
  { name: "Rendering", color: "#ec4899" },
  { name: "Client", color: "#22c55e" },
  { name: "Urgent", color: "#ef4444" },
] as const;
