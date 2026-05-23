import { PageHeader } from "@/components/PageHeader";
import { OpsOverviewClient } from "./OpsOverviewClient";

export default function OpsHomePage() {
  return (
    <>
      <PageHeader
        title="Athlete operations"
        badge="Admin"
        description="Production tracking, commercial reporting, and project operations — Blocharch’s internal OS for athletes, clients, and lanes."
        className="mb-8"
      />
      <OpsOverviewClient />
    </>
  );
}
