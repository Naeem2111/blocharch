import type { PublicClientPortalPipelineProject, PublicClientPortalProject } from "@/lib/public-client-portal";
import type { ClientMeetingNote } from "@/lib/client-meeting-notes";
import type { ClientPortalHours } from "@/lib/client-portal-hours";
import {
  clientPortalDeadlineBeatDescription,
  clientPortalProjectBeatDeadline,
} from "@/lib/client-portal-projects";

export type ClientPortalNotificationKind =
  | "deadline_beaten"
  | "project_completed"
  | "pipeline_added"
  | "hours_warning"
  | "hours_cap"
  | "overtime"
  | "meeting_note";

export type ClientPortalNotification = {
  id: string;
  kind: ClientPortalNotificationKind;
  title: string;
  description: string;
  timeLabel: string;
  /** When the event happened. The bell sorts by this, newest first. */
  occurredAt: string;
  projectId: string;
  action?: "overtime" | "meeting_note" | "pipeline" | "completed";
};

const RECENT_MS = 14 * 24 * 60 * 60 * 1000;

function isRecent(iso: string | null | undefined, windowMs = RECENT_MS): boolean {
  if (!iso) return false;
  const time = new Date(iso).getTime();
  return Number.isFinite(time) && Date.now() - time <= windowMs && time <= Date.now() + 60_000;
}

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
        occurredAt: lane.allowanceReachedAt ?? new Date().toISOString(),
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
        occurredAt: lane.warningAt ?? new Date().toISOString(),
        projectId: `lane-${lane.laneNumber}`,
      });
    }
  }

  return items;
}

function meetingNoteTimeLabel(iso: string): string {
  const created = new Date(iso);
  if (Number.isNaN(created.getTime())) return "Recently";
  const diffMs = Date.now() - created.getTime();
  if (diffMs >= 0 && diffMs < 60 * 60 * 1000) return "Just now";
  return relativeLabelFromIso(iso.slice(0, 10));
}

function buildPipelineNotifications(
  pipeline: PublicClientPortalPipelineProject[]
): ClientPortalNotification[] {
  return pipeline
    .filter((project) => isRecent(project.createdAt))
    .map((project) => ({
      id: `pipeline-${project.id}`,
      kind: "pipeline_added" as const,
      title: "New pipeline added",
      description: project.name,
      timeLabel: meetingNoteTimeLabel(project.createdAt!),
      occurredAt: project.createdAt!,
      projectId: project.id,
      action: "pipeline" as const,
    }));
}

function buildCompletedNotifications(
  completedProjects: PublicClientPortalProject[]
): ClientPortalNotification[] {
  return completedProjects
    .filter((project) => isRecent(project.completedAt))
    .map((project) => ({
      id: `${project.id}-completed`,
      kind: "project_completed" as const,
      title: "Project completed",
      description: project.name,
      timeLabel: meetingNoteTimeLabel(project.completedAt!),
      occurredAt: project.completedAt!,
      projectId: project.id,
      action: "completed" as const,
    }));
}

function buildMeetingNoteNotifications(notes: ClientMeetingNote[]): ClientPortalNotification[] {
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  return notes
    .filter((note) => !note.discussedAt && new Date(note.createdAt).getTime() >= weekAgo)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((note) => ({
      id: `meeting-note-${note.id}`,
      kind: "meeting_note" as const,
      title: "New meeting note",
      description: note.title,
      timeLabel: meetingNoteTimeLabel(note.createdAt),
      occurredAt: note.createdAt,
      projectId: note.id,
      action: "meeting_note" as const,
    }));
}

export function buildClientPortalNotifications(
  _activeProjects: PublicClientPortalProject[],
  completedProjects: PublicClientPortalProject[],
  hours?: ClientPortalHours,
  meetingNotes: ClientMeetingNote[] = [],
  pipelineProjects: PublicClientPortalPipelineProject[] = []
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
      occurredAt: p.completedAt ?? "",
      projectId: p.id,
      action: "completed" as const,
    };
  });

  const items = [
    ...buildMeetingNoteNotifications(meetingNotes),
    ...buildPipelineNotifications(pipelineProjects),
    ...buildCompletedNotifications(completedProjects),
    ...(hours ? buildHoursNotifications(hours) : []),
    ...deadlineItems,
  ];
  return items.sort((a, b) => {
    const aTime = a.occurredAt ? new Date(a.occurredAt).getTime() : 0;
    const bTime = b.occurredAt ? new Date(b.occurredAt).getTime() : 0;
    if (aTime !== bTime) return bTime - aTime;
    return a.id.localeCompare(b.id);
  });
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

