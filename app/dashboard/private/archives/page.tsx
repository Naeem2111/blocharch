import { PageHeader } from "@/components/PageHeader";
import { getSession } from "@/lib/auth";
import { canDeletePrivateProject } from "@/lib/private-access";
import { PrivateProjectsClient } from "../projects/PrivateProjectsClient";

export default async function PrivateArchivesPage() {
  const session = await getSession();
  const canDelete = !!session && canDeletePrivateProject(session.user.role);

  return (
    <>
      <PageHeader
        title="Project archives"
        badge="Private"
        description="Completed private projects — separate from ops archives. Bring one back to active if work resumes."
        className="mb-8"
      />
      <PrivateProjectsClient canDelete={canDelete} scope="completed" />
    </>
  );
}
