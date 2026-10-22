import { PageHeader } from "@/components/PageHeader";
import { OpsCatalogClient } from "./OpsCatalogClient";

export default function OpsCatalogPage() {
  return (
    <>
      <PageHeader
        title="Phases & work types"
        description="UK client phases and work types, and the private-project set, are edited on separate tabs."
        className="mb-8"
      />
      <OpsCatalogClient />
    </>
  );
}
