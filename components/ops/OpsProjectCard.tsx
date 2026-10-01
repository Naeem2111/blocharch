import type { ReactNode } from "react";
import type { OpsProjectPhase } from "@prisma/client";
import { ClientPortalAthleteMark } from "@/components/client-portal/ClientPortalAthleteMark";
import { ProjectProgressBar } from "@/components/ProjectProgressBar";
import {
  COMPLEXITY_LABELS,
  displayProjectStageLabel,
  PROJECT_STATUS_LABELS,
} from "@/lib/ops-constants";
import { formatHoursCompact } from "@/lib/ops-project-hours";
import { daysUntilDueFromIso, projectDueColor } from "@/lib/project-color-scale";
import { formatProjectFullTitle } from "@/lib/project-display";
import { computeProjectTimeline } from "@/lib/project-timeline";

export type OpsProjectCardAthlete = {
  athleteId: string;
  fullName: string;
  athleteCode: string;
  isPrimary: boolean;
};

export type OpsProjectCardProject = {
  id: string;
  name: string;
  displayTitle?: string;
  address: string | null;
  complexity: keyof typeof COMPLEXITY_LABELS;
  currentStage: OpsProjectPhase;
  stageLabel?: string;
  currentStatus: keyof typeof PROJECT_STATUS_LABELS;
  startDate: string | null;
  dueDate: string | null;
  dueAt?: string | null;
  progressPercent: number | null;
  laneNumber?: number | null;
  hoursLogged?: number;
  quotedHours?: number | null;
  assignedAthletes?: OpsProjectCardAthlete[];
  assignedAthleteId?: string | null;
  assignedAthleteName?: string | null;
  athleteCode?: string | null;
};

export function OpsProjectCardFrame({
  dueDate,
  dueAt,
  children,
}: {
  dueDate: string | null;
  dueAt?: string | null;
  children: ReactNode;
}) {
  const accent = projectDueColor(daysUntilDueFromIso(dueAt ?? dueDate));
  return (
    <article className="client-portal-card relative overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
      <span
        className="pointer-events-none absolute bottom-0 left-0 top-0 w-[3px] rounded-l-xl"
        style={{ backgroundColor: accent }}
        aria-hidden
      />
      {children}
    </article>
  );
}

function assignedAthleteRows(p: OpsProjectCardProject): OpsProjectCardAthlete[] {
  if (p.assignedAthletes && p.assignedAthletes.length > 0) return p.assignedAthletes;
  if (p.assignedAthleteName && p.assignedAthleteId) {
    return [
      {
        athleteId: p.assignedAthleteId,
        fullName: p.assignedAthleteName,
        athleteCode: p.athleteCode ?? "",
        isPrimary: true,
      },
    ];
  }
  return [];
}

function formatAssignedAthletes(p: OpsProjectCardProject) {
  const rows = assignedAthleteRows(p);
  if (rows.length === 0) return "Unassigned";
  return rows.map((a) => (a.isPrimary ? `${a.fullName} (primary)` : a.fullName)).join(", ");
}

function athleteInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const day = iso.slice(0, 10);
  const d = new Date(`${day}T12:00:00`);
  if (Number.isNaN(d.getTime())) return day;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function LanePill({ n }: { n: number }) {
  return (
    <span className="client-portal-lane-pill rounded border border-white/[0.1] bg-white/[0.04] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
      Lane {n}
    </span>
  );
}

function statusBadgeColor(status: string): string {
  if (status === "completed" || status === "handed_over") return "#22c55e";
  if (status === "waiting_on_feedback" || status === "zoom_required") return "#eab308";
  if (status === "blocked") return "#ef4444";
  if (status === "not_started") return "#94a3b8";
  return "#38bdf8";
}

function OpsStatusBadge({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide"
      style={{
        backgroundColor: `${color}22`,
        color,
        borderColor: `${color}44`,
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

function ProjectHoursCorner({
  hoursLogged,
  quotedHours,
}: {
  hoursLogged: number;
  quotedHours: number | null | undefined;
}) {
  const logged = formatHoursCompact(hoursLogged);
  const quoted = quotedHours != null && quotedHours > 0 ? formatHoursCompact(quotedHours) : null;
  const over = quoted != null && hoursLogged > Number(quotedHours);
  return (
    <div className="shrink-0 text-right">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        Hours to date / total
      </p>
      <p className={`mt-0.5 text-sm font-semibold tabular-nums ${over ? "text-amber-300" : "text-white"}`}>
        {quoted ? `${logged} / ${quoted}h` : `${logged}h`}
      </p>
    </div>
  );
}

export function OpsProjectCardBody({
  project,
  onEdit,
}: {
  project: OpsProjectCardProject;
  onEdit?: () => void;
}) {
  const timeline = computeProjectTimeline({
    startDate: project.startDate,
    dueDate: project.dueDate,
  });
  const accent = projectDueColor(daysUntilDueFromIso(project.dueAt ?? project.dueDate));
  const athletes = assignedAthleteRows(project);

  return (
    <div className="pl-1">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-semibold text-white">
            {project.displayTitle ?? formatProjectFullTitle(project.name, project.currentStage)}
          </h2>
          {project.address ? <p className="mt-0.5 text-xs text-slate-500">{project.address}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <OpsStatusBadge
            label={PROJECT_STATUS_LABELS[project.currentStatus]}
            color={statusBadgeColor(project.currentStatus)}
          />
          <span className="rounded-md bg-white/[0.06] px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            {COMPLEXITY_LABELS[project.complexity]}
          </span>
          {onEdit ? (
            <button
              type="button"
              onClick={onEdit}
              className="text-xs font-medium text-brand-300 hover:text-brand-200"
            >
              Edit
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 items-center gap-2 sm:grid-cols-[1fr_auto_1fr]">
        <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-slate-400">
          <span>
            Stage{" "}
            <span className="text-slate-300">
              {project.stageLabel ?? displayProjectStageLabel(project.currentStage)}
            </span>
          </span>
          {project.laneNumber != null ? (
            <>
              <span className="text-slate-600">·</span>
              <LanePill n={project.laneNumber} />
            </>
          ) : null}
          {timeline.daysActive != null ? (
            <>
              <span className="text-slate-600">·</span>
              <span>{timeline.daysActive} days active</span>
            </>
          ) : null}
        </div>
        <p className="text-center text-xs tabular-nums text-slate-400">
          {project.startDate || project.dueDate || project.dueAt ? (
            <>
              {project.startDate ? formatShortDate(project.startDate) : "TBC"}
              {" — "}
              <span className="font-semibold" style={{ color: accent }}>
                {project.dueDate || project.dueAt ? formatShortDate(project.dueAt ?? project.dueDate) : "TBC"}
              </span>
            </>
          ) : (
            <span className="text-slate-500">Dates to be confirmed</span>
          )}
        </p>
        <span className="hidden sm:block" aria-hidden />
      </div>

      <div className="mt-3 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <ProjectProgressBar percent={project.progressPercent ?? 0} showLabel={false} />
        </div>
        <span className="shrink-0 text-xs tabular-nums text-slate-400">{project.progressPercent ?? 0}%</span>
      </div>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        {athletes.length === 0 ? (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
            Athlete to be assigned
          </span>
        ) : (
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-300">
              <ClientPortalAthleteMark />
              Athlete assigned
            </span>
            <div className="mt-1.5 flex min-w-0 items-center gap-2">
              <div className="flex shrink-0 -space-x-1.5">
                {athletes.slice(0, 4).map((a, i) => (
                  <span
                    key={a.athleteId}
                    title={a.fullName}
                    className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold ring-2 ring-[#0f131a] ${
                      a.isPrimary || i === 0 ? "bg-sky-500/25 text-sky-200" : "bg-white/[0.08] text-slate-300"
                    }`}
                  >
                    {athleteInitials(a.fullName)}
                  </span>
                ))}
              </div>
              <p className="min-w-0 truncate text-xs text-slate-400">{formatAssignedAthletes(project)}</p>
            </div>
          </div>
        )}
        <ProjectHoursCorner hoursLogged={project.hoursLogged ?? 0} quotedHours={project.quotedHours} />
      </div>
    </div>
  );
}
