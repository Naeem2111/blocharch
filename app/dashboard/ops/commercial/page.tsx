import { PageHeader } from "@/components/PageHeader";
import { PlaceholderCard } from "@/components/ops/PlaceholderCard";

export default function OpsCommercialPage() {
  return (
    <>
      <PageHeader
        title="Commercial dashboard"
        description="Revenue (GBP), athlete cost (ZAR), profit, margin — calculated automatically from submissions and lane settings."
        className="mb-8"
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <PlaceholderCard
          title="Monthly commercial ledger"
          description="Per-athlete, per-client financial backbone with locked reporting exchange rates."
        />
        <PlaceholderCard
          title="Exchange rates"
          description="Live GBP/ZAR reference display and locked monthly reporting rate for historical accuracy."
        />
      </div>
    </>
  );
}
