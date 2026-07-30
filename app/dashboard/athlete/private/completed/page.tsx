import { PageHeader } from "@/components/PageHeader";
import { AthletePrivateProjectsClient } from "../AthletePrivateProjectsClient";

export default function AthletePrivateCompletedPage() {
  return (
    <>
      <PageHeader
        title="Completed private projects"
        badge="Private work"
        description="Your private delivery record."
        className="mb-8"
      />
      <AthletePrivateProjectsClient scope="completed" />
    </>
  );
}
