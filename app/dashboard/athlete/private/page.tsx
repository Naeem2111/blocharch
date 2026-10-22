import { PageHeader } from "@/components/PageHeader";
import { AthletePrivateProjectsClient } from "./AthletePrivateProjectsClient";

export default function AthletePrivateProjectsPage() {
  return (
    <>
      <PageHeader
        title="My projects"
        description="Private projects assigned to you."
        className="mb-8"
      />
      <AthletePrivateProjectsClient scope="active" />
    </>
  );
}
