import { PageHeader } from "@/components/PageHeader";
import { PlaceholderCard } from "@/components/ops/PlaceholderCard";

export default function OpsAnalyticsPage() {
  return (
    <>
      <PageHeader
        title="Analytics"
        description="Hours by athlete, client, phase, and task type — plus profitability and due-date risk."
        className="mb-8"
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <PlaceholderCard title="Hours breakdown" description="Filterable charts by client, athlete, project, phase, and task type." />
        <PlaceholderCard title="Profitability" description="Revenue vs cost by client, athlete, and lane." />
        <PlaceholderCard title="Due date risk" description="Projects due in 7 / 48 / 24 hours and overdue flags." />
      </div>
    </>
  );
}
