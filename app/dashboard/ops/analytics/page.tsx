import { PageHeader } from "@/components/PageHeader";
import { AnalyticsClient } from "./AnalyticsClient";

export default function OpsAnalyticsPage() {
  return (
    <>
      <PageHeader
        title="Analytics"
        description="Hours breakdown and profitability across athletes and clients."
        className="mb-8"
      />
      <AnalyticsClient />
    </>
  );
}
