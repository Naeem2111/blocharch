import { PageHeader } from "@/components/PageHeader";
import { OpsCatalogClient } from "./OpsCatalogClient";

export default function OpsCatalogPage() {
  return (
    <>
      <PageHeader
        title="Phases & work types"
        description="Add, rename, and reorder project phases / packages and daily-log work types. The daily log uses this order."
        className="mb-8"
      />
      <OpsCatalogClient />
    </>
  );
}
