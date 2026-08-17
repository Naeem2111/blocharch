import { PageHeader } from "@/components/PageHeader";
import { getSession } from "@/lib/auth";
import { canDeletePrivateProject } from "@/lib/private-access";
import { PrivateProjectDetailClient } from "./PrivateProjectDetailClient";

export default async function PrivateProjectDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getSession();
  const canDelete = !!session && canDeletePrivateProject(session.user.role);

  return (
    <>
      <PageHeader
        title="Project record"
        badge="Private"
        description="Duration-weighted progress. Phase 8 is honest about what done means."
        className="mb-8"
      />
      <PrivateProjectDetailClient projectId={params.id} canDelete={canDelete} />
    </>
  );
}
