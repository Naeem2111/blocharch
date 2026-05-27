import { PageHeader } from "@/components/PageHeader";
import { AthleteBookCallClient } from "./AthleteBookCallClient";

export default function BookCallPage() {
  return (
    <div>
      <PageHeader
        title="Book a call"
        description="Request a check-in slot from Jethro’s calendar — project, reason, preferred time, and notes."
      />
      <AthleteBookCallClient />
    </div>
  );
}
