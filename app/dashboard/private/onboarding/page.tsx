import { PageHeader } from "@/components/PageHeader";
import { PrivateOnboardingClient } from "./PrivateOnboardingClient";

export default function PrivateOnboardingPage() {
  return (
    <>
      <PageHeader
        title="Onboarding"
        badge="Private"
        description="Where a new private client and their first project get created."
        className="mb-8"
      />
      <PrivateOnboardingClient />
    </>
  );
}
