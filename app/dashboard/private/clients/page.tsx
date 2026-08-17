import { PageHeader } from "@/components/PageHeader";
import { PrivateClientsClient } from "./PrivateClientsClient";

export default function PrivateClientsPage() {
  return (
    <>
      <PageHeader
        title="Clients"
        badge="Private"
        description="Private residential clients — each has a separate portal link. Production Lane clients live under Ops."
        className="mb-8"
      />
      <PrivateClientsClient />
    </>
  );
}
