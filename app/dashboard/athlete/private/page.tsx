import { PageHeader } from "@/components/PageHeader";
import { AthletePrivateLogClient } from "./log/AthletePrivateLogClient";

export default function AthletePrivateLogPage() {
  return (
    <>
      <PageHeader
        title="Daily log"
        description="Submit one log per day. Each entry follows that project's design workflow — phase, hours, and what was completed."
        className="mb-8"
      />
      <AthletePrivateLogClient />
    </>
  );
}
