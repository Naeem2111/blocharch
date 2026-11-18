import { Suspense } from "react";
import { TalentProfileClient } from "./TalentProfileClient";

export default function TalentProfilePage({ params }: { params: { id: string } }) {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">Loading profile…</p>}>
      <TalentProfileClient id={params.id} />
    </Suspense>
  );
}
