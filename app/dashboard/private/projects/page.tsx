import { PageHeader } from "@/components/PageHeader";
import { getSession } from "@/lib/auth";
import { canDeletePrivateProject } from "@/lib/private-access";
import { PrivateProjectsClient } from "./PrivateProjectsClient";

export default async function PrivateProjectsPage() {
  const session = await getSession();
  const canDelete = !!session && canDeletePrivateProject(session.user.role);

  return (
    <>
      <PageHeader
        title="Projects"
        badge="Private"
        description="Active private projects — progress as a duration-weighted bar. Completed work is on the Completed tab."
        className="mb-8"
      />
      <PrivateProjectsClient canDelete={canDelete} />
    </>
  );
}
