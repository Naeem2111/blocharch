import { PageHeader } from "@/components/PageHeader";
import { OpsPipelineClient } from "./OpsPipelineClient";

export default function OpsPipelinePage() {
  return (
    <>
      <PageHeader
        title="Project pipeline"
        description="Upcoming work from client meetings — visible on the client portal for resourcing. Promote items to live projects when ready."
        className="mb-8"
      />
      <OpsPipelineClient />
    </>
  );
}
