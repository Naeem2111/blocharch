import { PageHeader } from "@/components/PageHeader";
import { PrivateProjectsClient } from "./PrivateProjectsClient";

export default function PrivateProjectsPage() {
  return (
    <>
      <PageHeader
        title="Projects"
        badge="Private"
        description="Every running private project — progress as a duration-weighted bar."
        className="mb-8"
      />
      <PrivateProjectsClient />
    </>
  );
}
