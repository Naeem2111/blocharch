import { PageHeader } from "@/components/PageHeader";
import { ProjectLinksPageClient } from "./ProjectLinksPageClient";

export default function OpsProjectLinksPage({
  searchParams,
}: {
  searchParams: { clientId?: string };
}) {
  return (
    <>
      <PageHeader
        title="Project links"
        description="Add a dedicated Zoom link, or any other link, to a client’s project. Links show on their portal under that project."
        className="mb-8"
      />
      <ProjectLinksPageClient initialClientId={searchParams.clientId ?? ""} />
    </>
  );
}
