import { PageHeader } from "@/components/PageHeader";
import { OpsClientsClient } from "./OpsClientsClient";

export default function OpsClientsPage() {
  return (
    <>
      <PageHeader
        title="Client manager"
        description="Create clients, set pricing tiers, lane costs, overtime rates, and active lane counts."
        className="mb-8"
      />
      <OpsClientsClient />
    </>
  );
}
