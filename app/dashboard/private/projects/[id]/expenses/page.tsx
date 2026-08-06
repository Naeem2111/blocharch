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
        description="Third-party costs and athlete payments for this project."
        className="mb-8"
      />
      <PrivateProjectExpensesClient projectId={params.id} />
    </>
  );
}
