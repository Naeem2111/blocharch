import { Suspense } from "react";
import { PageHeader } from "@/components/PageHeader";
import { CompletedProjectsSwitcher } from "./CompletedProjectsSwitcher";

export default function CompletedProjectsPage() {
  return (
    <div>
      <PageHeader
        title="Completed projects"
        description="Finished UK client projects and private projects, each on its own tab."
      />
      <Suspense fallback={<p className="text-sm text-slate-500">Loading…</p>}>
        <CompletedProjectsSwitcher />
      </Suspense>
    </div>
  );
}
