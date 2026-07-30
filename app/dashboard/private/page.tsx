import { PageHeader } from "@/components/PageHeader";
import { PrivateOverviewClient } from "./PrivateOverviewClient";

export default function PrivateOverviewPage() {
  return (
    <>
      <PageHeader
        title="Private projects"
        badge="Ops overview"
        description="The private-projects book — capacity, revenue, and what needs attention. Separate from Production Lane."
        className="mb-8"
      />
      <PrivateOverviewClient />
    </>
  );
}
