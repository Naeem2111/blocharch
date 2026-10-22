import { Suspense } from "react";
import { PageHeader } from "@/components/PageHeader";
import { AthleteDailyLogSwitcher } from "./AthleteDailyLogSwitcher";

export default function AthleteSubmissionsPage() {
  return (
    <>
      <PageHeader
        title="Daily log"
        description="One log per day. Switch work entries between UK clients and private projects — each set keeps its own hours."
        className="mb-8"
      />
      <Suspense fallback={<p className="text-sm text-slate-500">Loading…</p>}>
        <AthleteDailyLogSwitcher />
      </Suspense>
    </>
  );
}
