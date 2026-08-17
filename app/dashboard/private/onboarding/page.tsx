import { PageHeader } from "@/components/PageHeader";
import { PrivateOnboardingClient } from "./PrivateOnboardingClient";

export default function PrivateOnboardingPage({
  searchParams,
}: {
  searchParams: { clientId?: string };
}) {
  return (
    <>
      <PageHeader
        title="Onboarding"
        badge="Private"
        description="Open a new private project — attach it to an existing client, or create both together."
        className="mb-8"
      />
      <PrivateOnboardingClient initialClientId={searchParams.clientId ?? ""} />
    </>
  );
}
