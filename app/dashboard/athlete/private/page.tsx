import { PageHeader } from "@/components/PageHeader";
import { AthletePrivateProjectsClient } from "./AthletePrivateProjectsClient";

export default function AthletePrivateProjectsPage() {
  return (
    <>
      <PageHeader
        title="My private projects"
        badge="Private work"
        description="Projects outside Production Lane — local private clients."
        className="mb-8"
      />
      <AthletePrivateProjectsClient scope="active" />
    </>
  );
}
