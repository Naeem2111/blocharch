import { PageHeader } from "@/components/PageHeader";
import { PrivateCommercialClient } from "./PrivateCommercialClient";

export default function PrivateCommercialPage() {
  return (
    <>
      <PageHeader
        title="Commercial & analytics"
        badge="Private"
        description="Fixed fee per project. Separate from Athlete operations’ lane billing."
        className="mb-8"
      />
      <PrivateCommercialClient />
    </>
  );
}
