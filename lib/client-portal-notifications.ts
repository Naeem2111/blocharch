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
  if (hours.includedHours <= 0) return items;

  if (hours.hoursRemaining > 0 && hours.hoursRemaining <= 10) {
    items.push({
      id: `hours-warning-${hours.monthLabel}`,
      kind: "hours_warning",
      title: `${hours.hoursRemaining} hour${hours.hoursRemaining === 1 ? "" : "s"} remaining this month`,
      description: `${hours.hoursUsed}h of ${hours.includedHours} included hours used in ${hours.monthLabel}.`,
      timeLabel: "This month",
      projectId: "hours",
    });
  }

  if (hours.hoursUsed >= hours.includedHours) {
    items.push({
      id: `hours-cap-${hours.monthLabel}`,
      kind: "hours_cap",
      title: `${hours.includedHours} included hours reached`,
      description: `Included hours for ${hours.monthLabel} are used. Further time is overtime at £${hours.overtimeRateGbp}/hr.`,
      timeLabel: "This month",
      projectId: "hours",
    });
  }

  if (hours.overtimeHours > 0) {
    items.push({
      id: `overtime-${hours.monthLabel}`,
      kind: "overtime",
      title: `${hours.overtimeHours} overtime hour${hours.overtimeHours === 1 ? "" : "s"} this month`,
      description: `Billed at £${hours.overtimeRateGbp}/hr · £${hours.overtimeCostGbp.toLocaleString("en-GB")} estimated.`,
      timeLabel: "This month",
      projectId: "hours",
    });
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
