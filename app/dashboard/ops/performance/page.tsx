import { PageHeader } from "@/components/PageHeader";
import { AthletePerformanceClient } from "./AthletePerformanceClient";

export default function AthletePerformancePage() {
  return (
    <div>
      <PageHeader
        title="Athlete performance"
        description="Rank athletes on finished work, hours, deadlines, and daily logs. Opens on this month — empty the dates for all history. Pick a name to open that athlete's breakdown on this page."
      />
      <AthletePerformanceClient />
    </div>
  );
}
