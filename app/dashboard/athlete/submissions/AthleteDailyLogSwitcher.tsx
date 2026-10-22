"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { AthleteSetSwitcher } from "@/components/athlete/AthleteSetSwitcher";
import { AthletePrivateLogClient } from "../private/log/AthletePrivateLogClient";
import { AthleteSubmissionsClient } from "./AthleteSubmissionsClient";

export function AthleteDailyLogSwitcher() {
  const params = useSearchParams();
  const router = useRouter();
  const stream = params.get("stream") === "private" ? "private" : "uk";

  return (
    <>
      <AthleteSetSwitcher
        label="Work entries"
        value={stream}
        onChange={(next) => {
          router.replace(
            next === "private"
              ? "/dashboard/athlete/submissions?stream=private"
              : "/dashboard/athlete/submissions",
          );
        }}
      />
      {stream === "private" ? <AthletePrivateLogClient /> : <AthleteSubmissionsClient />}
    </>
  );
}
