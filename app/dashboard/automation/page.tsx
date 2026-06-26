import { PageHeader } from "@/components/PageHeader";
import { AutomationClient } from "./AutomationClient";

export default function AutomationPage() {
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Lead nurturing"
        description="Pipeline stages, ratings, software, and notes — saved per practice in the database."
      />
      <AutomationClient />
    </div>
  );
}
