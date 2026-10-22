"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { AthleteSetSwitcher } from "@/components/athlete/AthleteSetSwitcher";
import { AthletePrivateProjectsClient } from "../../private/AthletePrivateProjectsClient";
import { CompletedProjectsClient } from "./CompletedProjectsClient";

export function CompletedProjectsSwitcher() {
  const params = useSearchParams();
  const router = useRouter();
  const set = params.get("set") === "private" ? "private" : "uk";

  return (
    <>
      <AthleteSetSwitcher
        label="Completed projects"
        value={set}
        onChange={(next) => {
          router.replace(
            next === "private"
              ? "/dashboard/athlete/projects/completed?set=private"
              : "/dashboard/athlete/projects/completed",
          );
        }}
      />
      {set === "private" ? (
        <AthletePrivateProjectsClient scope="completed" />
      ) : (
        <CompletedProjectsClient />
      )}
    </>
  );
}
