import { PageHeader } from "@/components/PageHeader";
import { getSession } from "@/lib/auth";
import { canDeletePrivateProject } from "@/lib/private-access";
import { PrivateProjectEditClient } from "./PrivateProjectEditClient";

export default async function PrivateProjectEditPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getSession();
  const canDelete = !!session && canDeletePrivateProject(session.user.role);

  return (
    <>
      <PageHeader
        title="Edit project"
        badge="Private"
        description="Update client, project, progress, athlete, and phase details."
        className="mb-8"
      />
      <PrivateProjectEditClient projectId={params.id} canDelete={canDelete} />
    </>
  );
}
