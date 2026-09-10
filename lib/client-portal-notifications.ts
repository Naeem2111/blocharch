import type { PublicClientPortalProject } from "@/lib/public-client-portal";
import type { ClientPortalHours } from "@/lib/client-portal-hours";
import {
  clientPortalDeadlineBeatDescription,
  clientPortalProjectBeatDeadline,
} from "@/lib/client-portal-projects";

export type ClientPortalNotificationKind =
  | "deadline_beaten"
  | "hours_warning"
  | "hours_cap"
  | "overtime";

export type ClientPortalNotification = {
  id: string;
  kind: ClientPortalNotificationKind;
  title: string;
  description: string;
  timeLabel: string;
  projectId: string;
  action?: "overtime";
};

function relativeLabelFromIso(iso: string | null, fallback = "Recently"): string {
  if (!iso) return fallback;
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return fallback;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((today.getTime() - day.getTime()) / 86400000);
  if (diffDays < 0) return "Upcoming";
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 14) return "1 week ago";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function buildHoursNotifications(hours: ClientPortalHours): ClientPortalNotification[] {
  const items: ClientPortalNotification[] = [];
  const rate = hours.overtimeRateGbp;

  for (const lane of hours.lanes) {
    if (lane.allowanceReached) {
      items.push({
        id: `hours-cap-${hours.monthLabel}-${lane.laneNumber}`,
        kind: "hours_cap",
        title: `${lane.laneLabel} · Allowance reached`,
        description: `Your included allowance has been reached. Additional time is now logged at £${rate}/hour.`,
        timeLabel: "This month",
        projectId: `lane-${lane.laneNumber}`,
        action: "overtime",
      });
      continue;
    }
    if (lane.warning) {
      const remaining = lane.hoursRemaining;
      items.push({
        id: `hours-warning-${hours.monthLabel}-${lane.laneNumber}`,
        kind: "hours_warning",
        title: `${lane.laneLabel} · ${remaining} hour${remaining === 1 ? "" : "s"} remaining`,
        description: `You have ${remaining} included hour${remaining === 1 ? "" : "s"} remaining this month. Additional time is billed at £${rate}/hour once your allowance is reached.`,
        timeLabel: "This month",
        projectId: `lane-${lane.laneNumber}`,
      });
    }
  }

  return items;
}

export function buildClientPortalNotifications(
  _activeProjects: PublicClientPortalProject[],
  completedProjects: PublicClientPortalProject[],
  hours?: ClientPortalHours
): ClientPortalNotification[] {
  const beaten = completedProjects
    .filter((p) => clientPortalProjectBeatDeadline(p))
    .sort((a, b) => {
      const aTime = a.completedAt ? new Date(a.completedAt).getTime() : 0;
      const bTime = b.completedAt ? new Date(b.completedAt).getTime() : 0;
      return bTime - aTime;
    });

  const deadlineItems = beaten.map((p) => {
    const copy = clientPortalDeadlineBeatDescription(p);
    const completedDay = p.completedAt ? p.completedAt.slice(0, 10) : null;
    return {
      id: `${p.id}-beaten`,
      kind: "deadline_beaten" as const,
      title: copy.title,
      description: copy.description,
      timeLabel: relativeLabelFromIso(completedDay, "Recently"),
      projectId: p.id,
    };
  });

  return [...(hours ? buildHoursNotifications(hours) : []), ...deadlineItems];
}

export function laneHoursCaption(
  hours: ClientPortalHours
): { label: string; tone: "cap" | "warn" }[] {
  return hours.lanes
    .filter((lane) => lane.allowanceReached || lane.warning)
    .map((lane) =>
      lane.allowanceReached
        ? { label: `${lane.laneLabel} · allowance reached`, tone: "cap" as const }
        : { label: `${lane.laneLabel} · ${lane.hoursRemaining}h remaining`, tone: "warn" as const }
    );
}

