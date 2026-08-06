import { PageHeader } from "@/components/PageHeader";
import { PrivateProjectEditClient } from "./PrivateProjectEditClient";

export default function PrivateProjectEditPage({
  params,
}: {
  params: { id: string };
}) {
  return (
    <>
      <PageHeader
        title="Edit project"
        badge="Private"
        description="Update client, project, progress, athlete, and stage details."
        className="mb-8"
      />
      <PrivateProjectEditClient projectId={params.id} />
    </>
  );
}
