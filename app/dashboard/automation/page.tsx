import { PageHeader } from "@/components/PageHeader";
import { AutomationClient } from "./AutomationClient";

export default function AutomationPage() {
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Lead nurturing"
        description="Pipeline stages, ratings, templates, and workflow triggers aligned with your n8n outreach."
      />
      <AutomationClient />
    </div>
  );
}
