import { PageHeader } from "@/components/PageHeader";
import { getSession } from "@/lib/auth";
import { canDeletePrivateProject } from "@/lib/private-access";
import { PrivateProjectsClient } from "../PrivateProjectsClient";

export default async function PrivateCompletedProjectsPage() {
  const session = await getSession();
  const canDelete = !!session && canDeletePrivateProject(session.user.role);

  return (
    <>
      <PageHeader
        title="Completed projects"
        badge="Private"
        description="Finished private projects — athletes, fee, and margin on record."
        className="mb-8"
      />
      <PrivateProjectsClient canDelete={canDelete} scope="completed" />
    </>
  );
}
