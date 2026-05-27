import { PageHeader } from "@/components/PageHeader";

export default function CompletedProjectsPage() {
  return (
    <div>
      <PageHeader
        title="Completed projects"
        description="Finished client projects move here for history — separate from the Completed Kanban board for tasks."
      />
      <p className="text-sm text-slate-500">
        Coming soon — synced when a project is marked completed in ops.
      </p>
    </div>
  );
}
