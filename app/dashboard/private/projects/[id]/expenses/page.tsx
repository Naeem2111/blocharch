import { PageHeader } from "@/components/PageHeader";
import { PrivateProjectExpensesClient } from "./PrivateProjectExpensesClient";

export default function PrivateProjectExpensesPage({
  params,
}: {
  params: { id: string };
}) {
  return (
    <>
      <PageHeader
        title="Project expenses"
        badge="Private"
        description="Disbursements and third-party costs for this project."
        className="mb-8"
      />
      <PrivateProjectExpensesClient projectId={params.id} />
    </>
  );
}
