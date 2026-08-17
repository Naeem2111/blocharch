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
        description="Every running private project — progress as a duration-weighted bar."
        className="mb-8"
      />
      <PrivateProjectsClient canDelete={canDelete} />
    </>
  );
}
