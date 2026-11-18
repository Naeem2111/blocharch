import { Suspense } from "react";
import { TalentPoolClient } from "./TalentPoolClient";

export default function TalentPoolPage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">Loading talent pool…</p>}>
      <TalentPoolClient />
    </Suspense>
  );
}
