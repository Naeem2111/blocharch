import { PageHeader } from "@/components/PageHeader";
import { OpsCatalogClient } from "./OpsCatalogClient";

export default function OpsCatalogPage() {
  return (
    <>
      <PageHeader
        title="Phases & work types"
        description="Add and rename project phases / packages and daily-log work types used across Athlete operations."
        className="mb-8"
      />
      <OpsCatalogClient />
    </>
  );
}
