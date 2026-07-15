import type { PublicClientPortalProject } from "@/lib/public-client-portal";
import {
  clientPortalDeadlineBeatDescription,
  clientPortalProjectBeatDeadline,
} from "@/lib/client-portal-projects";

export type ClientPortalNotificationKind = "deadline_beaten";

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

export function buildClientPortalNotifications(
  _activeProjects: PublicClientPortalProject[],
  completedProjects: PublicClientPortalProject[]
): ClientPortalNotification[] {
  const beaten = completedProjects
    .filter((p) => clientPortalProjectBeatDeadline(p))
    .sort((a, b) => {
      const aTime = a.handoverDate
        ? new Date(`${a.handoverDate}T12:00:00`).getTime()
        : 0;
      const bTime = b.handoverDate
        ? new Date(`${b.handoverDate}T12:00:00`).getTime()
        : 0;
      return bTime - aTime;
    });

  return beaten.map((p) => {
    const copy = clientPortalDeadlineBeatDescription(p);
    return {
      id: `${p.id}-beaten`,
      kind: "deadline_beaten",
      title: copy.title,
      description: copy.description,
      timeLabel: relativeLabelFromIso(p.handoverDate, "Recently"),
      projectId: p.id,
    };
  });
}
