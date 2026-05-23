import { PageHeader } from "@/components/PageHeader";
import { PlaceholderCard } from "@/components/ops/PlaceholderCard";

export default function OpsHomePage() {
  return (
    <>
      <PageHeader
        title="Athlete operations"
        badge="Admin"
        description="Production tracking, commercial reporting, and project operations — Blocharch’s internal OS for athletes, clients, and lanes."
        className="mb-8"
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <PlaceholderCard
          title="Active athletes"
          description="Count of athletes currently active and logging work."
        />
        <PlaceholderCard
          title="Active projects"
          description="Live projects across all clients and assigned athletes."
        />
        <PlaceholderCard
          title="Open blockers"
          description="Blockers flagged in daily submissions requiring admin attention."
        />
        <PlaceholderCard
          title="Check-in requests"
          description="Athletes who have requested a check-in or Zoom call."
        />
        <PlaceholderCard
          title="Monthly revenue (GBP)"
          description="Total lane revenue and overtime billing for the current month."
        />
        <PlaceholderCard
          title="Gross margin"
          description="Revenue vs athlete cost using the locked reporting exchange rate."
        />
      </div>
    </>
  );
}
