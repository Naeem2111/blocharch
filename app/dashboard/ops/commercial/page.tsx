import { PageHeader } from "@/components/PageHeader";
import { CommercialClient } from "./CommercialClient";

export default function OpsCommercialPage() {
  return (
    <>
      <PageHeader
        title="Commercial dashboard"
        description="Revenue (GBP), athlete cost (ZAR), profit, margin — calculated automatically from submissions and lane settings."
        className="mb-8"
      />
      <CommercialClient />
    </>
  );
}
