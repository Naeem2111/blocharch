import { PageHeader } from "@/components/PageHeader";
import { ContentGeneratorClient } from "./ContentGeneratorClient";

export default function ContentGeneratorPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="BLOCHARCH Content Generator"
        badge="Master Artwork"
        description="Upload one architectural photograph, choose a colour treatment, then generate, refine, and download. The artwork rules stay in the generator."
      />
      <ContentGeneratorClient />
    </div>
  );
}
