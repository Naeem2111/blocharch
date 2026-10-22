"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { AthletePrivateLogClient } from "../private/log/AthletePrivateLogClient";
import { AthleteSubmissionsClient } from "./AthleteSubmissionsClient";

type Stream = "uk" | "private";

const CHOICES: Array<{
  id: Stream;
  title: string;
  detail: string;
  className: string;
  titleClassName: string;
  detailClassName: string;
}> = [
  {
    id: "uk",
    title: "UK clients",
    detail: "Project work and client housekeeping.",
    className:
      "border-blue-400/50 bg-blue-500/15 hover:border-blue-300 hover:bg-blue-500/25 aria-checked:border-blue-300 aria-checked:bg-blue-500/30 aria-checked:ring-2 aria-checked:ring-blue-400",
    titleClassName: "text-blue-50",
    detailClassName: "text-blue-100/80",
  },
  {
    id: "private",
    title: "Private projects",
    detail: "Design phases and work types for private projects.",
    className:
      "border-amber-300/55 bg-amber-400/15 hover:border-amber-200 hover:bg-amber-400/25 aria-checked:border-amber-200 aria-checked:bg-amber-400/30 aria-checked:ring-2 aria-checked:ring-amber-300",
    titleClassName: "text-amber-50",
    detailClassName: "text-amber-100/80",
  },
];

export function AthleteDailyLogSwitcher() {
  const params = useSearchParams();
  const router = useRouter();
  const raw = params.get("stream");
  const selected: Stream | null = raw === "uk" || raw === "private" ? raw : null;

  function choose(next: Stream) {
    router.replace(
      next === "private" ? "/dashboard/athlete/submissions?stream=private" : "/dashboard/athlete/submissions?stream=uk",
    );
  }

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2" role="radiogroup" aria-label="Work entries">
        {CHOICES.map((choice) => (
          <button
            key={choice.id}
            type="button"
            role="radio"
            aria-checked={selected === choice.id}
            onClick={() => choose(choice.id)}
            className={`flex min-h-[9.5rem] flex-col items-start justify-center rounded-2xl border p-6 text-left shadow-xl shadow-black/25 transition duration-150 hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 ${choice.className}`}
          >
            <span className={`block text-2xl font-semibold tracking-tight ${choice.titleClassName}`}>
              {choice.title}
            </span>
            <span className={`mt-2 block text-base leading-snug ${choice.detailClassName}`}>{choice.detail}</span>
          </button>
        ))}
      </div>
      {selected === "uk" ? <AthleteSubmissionsClient /> : null}
      {selected === "private" ? <AthletePrivateLogClient /> : null}
    </div>
  );
}
