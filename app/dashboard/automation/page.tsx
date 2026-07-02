import { PageHeader } from "@/components/PageHeader";
import { AutomationClient } from "./AutomationClient";

export default function AutomationPage() {
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Lead nurturing"
        description="Manual outreach tracking — log emails, follow-ups, and replies per practice. Follow-up reminders appear in Marketing notifications."
      />
      <AutomationClient />
    </div>
  );
}
