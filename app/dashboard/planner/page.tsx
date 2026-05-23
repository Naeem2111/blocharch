import { PageHeader } from "@/components/PageHeader";
import { ThemeToggle } from "@/components/ThemeToggle";
import { PlannerClient } from "./PlannerClient";

export default function PlannerPage() {
  return (
    <div className="mx-auto max-w-[min(100vw-2rem,90rem)]">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title="Project planner"
          description="Kanban for personal and team work: colour-coded columns, labels, assignments, architect lead links, team access, and calendar export. Managers can open every team board."
        />
        <ThemeToggle compact />
      </div>
      <PlannerClient />
    </div>
  );
}
