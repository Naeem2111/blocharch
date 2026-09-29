import { PageHeader } from "@/components/PageHeader";
import { AthletePrivateProjectsClient } from "../AthletePrivateProjectsClient";

export default function AthletePrivateArchivesPage() {
  return (
    <>
      <PageHeader
        title="Private archives"
        badge="Private work"
        description="Your completed private projects — separate from ops archives."
        className="mb-8"
      />
      <AthletePrivateProjectsClient scope="completed" />
    </>
  );
}
