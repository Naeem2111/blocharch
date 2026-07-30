import { PageHeader } from "@/components/PageHeader";
import { PrivateProjectDetailClient } from "./PrivateProjectDetailClient";

export default function PrivateProjectDetailPage({
  params,
}: {
  params: { id: string };
}) {
  return (
    <>
      <PageHeader
        title="Project record"
        badge="Private"
        description="Duration-weighted progress. Stage 8 is honest about what done means."
        className="mb-8"
      />
      <PrivateProjectDetailClient projectId={params.id} />
    </>
  );
}
