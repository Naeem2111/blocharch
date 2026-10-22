import { PageHeader } from "@/components/PageHeader";
import { AthletePrivateProjectsClient } from "../AthletePrivateProjectsClient";

export default function AthletePrivateProjectsPage() {
  return (
    <>
      <PageHeader
        title="My projects"
        description="Private projects assigned to you, in the same tracker layout as your other projects."
        className="mb-8"
      />
      <AthletePrivateProjectsClient scope="active" />
    </>
  );
}
