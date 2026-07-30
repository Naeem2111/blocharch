import { PageHeader } from "@/components/PageHeader";
import { AthletePrivateLogClient } from "./AthletePrivateLogClient";

export default function AthletePrivateLogPage() {
  return (
    <>
      <PageHeader
        title="Daily log"
        badge="Private work"
        description="Hours here feed the private-projects book only — never Production Lane billing."
        className="mb-8"
      />
      <AthletePrivateLogClient />
    </>
  );
}
