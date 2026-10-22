import { PageHeader } from "@/components/PageHeader";
import { AthletePrivateProjectsClient } from "../AthletePrivateProjectsClient";

export default function AthletePrivateArchivesPage() {
  return (
    <>
      <PageHeader
        title="Completed projects"
        description="Finished private projects assigned to you."
        className="mb-8"
      />
      <AthletePrivateProjectsClient scope="completed" />
    </>
  );
}
