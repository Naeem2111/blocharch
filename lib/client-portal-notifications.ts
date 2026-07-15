import type { PublicClientPortalProject } from "@/lib/public-client-portal";
import { daysUntilDueFromIso } from "@/lib/project-color-scale";

export type ClientPortalNotificationKind =
  | "deadline_approaching"
  | "ready_for_review"
  | "status_updated"
  | "project_scheduled"
  | "deadline_beaten";

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

function formatDuePhrase(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long" });
}

export function buildClientPortalNotifications(
  activeProjects: PublicClientPortalProject[],
  completedProjects: PublicClientPortalProject[]
): ClientPortalNotification[] {
  const items: ClientPortalNotification[] = [];

  for (const p of activeProjects) {
    const days = daysUntilDueFromIso(p.dueDate);
    if (days != null && days >= 0 && days <= 3) {
      items.push({
        id: `${p.id}-deadline`,
        kind: "deadline_approaching",
        title: `Deadline approaching — ${p.name}`,
        description: `${p.currentStageLabel} ${days === 0 ? "is due today" : days === 1 ? "is due tomorrow" : `is due in ${days} days`}${p.dueDate ? `, ${formatDuePhrase(p.dueDate)}` : ""}.`,
        timeLabel: days === 0 ? "Today" : days === 1 ? "Yesterday" : `${days} days ago`,
        projectId: p.id,
      });
    }

    if (p.currentStatus === "waiting_on_feedback") {
      items.push({
        id: `${p.id}-review`,
        kind: "ready_for_review",
        title: `Ready for review — ${p.name}`,
        description: `${p.currentStageLabel} is ready for your feedback.`,
        timeLabel: relativeLabelFromIso(p.dueDate, "Recently"),
        projectId: p.id,
      });
    }

    if (p.currentStatus === "not_started") {
      items.push({
        id: `${p.id}-scheduled`,
        kind: "project_scheduled",
        title: `Project scheduled — ${p.name}`,
        description: p.startDate
          ? `Work is scheduled from ${formatDuePhrase(p.startDate)}.`
          : "This project has been scheduled and will start soon.",
        timeLabel: relativeLabelFromIso(p.startDate, "Recently"),
        projectId: p.id,
      });
    }

    if (p.currentStatus === "in_progress" && days != null && days > 3) {
      items.push({
        id: `${p.id}-status`,
        kind: "status_updated",
        title: `Status updated — ${p.name}`,
        description: `${p.currentStageLabel} is now in progress (${p.progressPercent}% complete).`,
        timeLabel: relativeLabelFromIso(p.startDate, "Recently"),
        projectId: p.id,
      });
    }
  }

  for (const p of completedProjects) {
    if (p.deadlineBeatenDays != null && p.deadlineBeatenDays > 0) {
      items.push({
        id: `${p.id}-beaten`,
        kind: "deadline_beaten",
        title: `Deadline beaten — ${p.name}`,
        description: `Delivered ${p.deadlineBeatenDays} day${p.deadlineBeatenDays === 1 ? "" : "s"} ahead of schedule.`,
        timeLabel: relativeLabelFromIso(p.handoverDate, "Recently"),
        projectId: p.id,
      });
    }
  }

  const kindOrder: Record<ClientPortalNotificationKind, number> = {
    deadline_approaching: 0,
    ready_for_review: 1,
    status_updated: 2,
    project_scheduled: 3,
    deadline_beaten: 4,
  };

  return items.sort((a, b) => kindOrder[a.kind] - kindOrder[b.kind]);
}
