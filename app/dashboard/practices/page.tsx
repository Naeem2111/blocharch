import { PageHeader } from "@/components/PageHeader";
import { PracticesClient } from "./PracticesClient";

export default function PracticesPage() {
  return (
    <div className="mx-auto max-w-[min(100%,90rem)]">
      <PageHeader
        title="Practices"
        description="Search and browse architect practices from the directory. Toggle columns to focus the table."
      />
      <PracticesClient />
    </div>
  );
}
