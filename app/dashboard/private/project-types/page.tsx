import { PageHeader } from "@/components/PageHeader";
import { PrivateProjectTypesClient } from "./PrivateProjectTypesClient";

export default function PrivateProjectTypesPage() {
  return (
    <div>
      <PageHeader
        title="Project types"
        description="Manage the project type list used in onboarding and project records."
      />
      <PrivateProjectTypesClient />
    </div>
  );
}
