"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ClientPortalBrandMark } from "@/components/client-portal/ClientPortalBrandMark";
import { ClientPortalAthleteMark } from "@/components/client-portal/ClientPortalAthleteMark";
import { ClientAvatar } from "@/components/ops/ClientAvatar";
import { MiniMonthCalendar } from "@/components/MiniMonthCalendar";
import { ProjectProgressBar } from "@/components/ProjectProgressBar";
import { asAvatarTextTone } from "@/lib/avatar-text-tone";
import { clientPortalPath } from "@/lib/client-slug";
import {
	buildClientPortalNotifications,
	laneHoursCaption,
	type ClientPortalNotification,
	type ClientPortalNotificationKind,
} from "@/lib/client-portal-notifications";
import { formatPortalHours } from "@/lib/client-portal-hours";
import { daysUntilDueFromIso, projectDueColor } from "@/lib/project-color-scale";
import { PublicThemeToggle } from "@/components/client-portal/PublicThemeToggle";
import type {
	PublicClientPortalData,
	PublicClientPortalPipelineProject,
	PublicClientPortalProject,
} from "@/lib/public-client-portal";

type PortalPage = "overview" | "tracker" | "pipeline" | "completed";

const PIPELINE_PURPLE = "#a855f7";

function formatDateOnly(iso: string | null): string {
	if (!iso) return "—";
	const day = iso.slice(0, 10);
	const d = new Date(`${day}T12:00:00`);
	if (Number.isNaN(d.getTime())) return iso;
	return d.toLocaleDateString("en-GB", {
		day: "numeric",
		month: "short",
		year: "numeric",
	});
}

function formatShortDate(iso: string | null): string {
	if (!iso) return "";
	const d = new Date(`${iso}T12:00:00`);
	if (Number.isNaN(d.getTime())) return iso;
	return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function dueAccent(project: PublicClientPortalProject): string {
	return projectDueColor(daysUntilDueFromIso(project.dueDate ?? project.dueAt));
}

function leadInitials(name: string): string {
	return name
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((w) => w[0]?.toUpperCase() ?? "")
		.join("");
}

function StatusBadge({
	label,
	color,
}: {
	label: string;
	color: string;
}) {
	return (
		<span
			className="client-portal-status-badge inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide"
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

function LanePill({ n }: { n: number }) {
	return (
		<span className="client-portal-lane-pill rounded border border-white/[0.1] bg-white/[0.04] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
			Lane {n}
		</span>
	);
}

function LeadBlock({
	name,
	showLabel = true,
}: {
	name: string | null;
	showLabel?: boolean;
}) {
	if (!name) {
		return <span className="text-xs text-slate-500">Lead assigned soon</span>;
	}
	return (
		<div className="flex min-w-0 items-center gap-2.5">
			<span className="client-portal-lead-avatar inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-[11px] font-semibold text-slate-300">
				{leadInitials(name)}
			</span>
			<div className="min-w-0">
				{showLabel ? (
					<p className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">Your lead</p>
				) : null}
				<p className="truncate text-sm text-slate-200">{name}</p>
			</div>
		</div>
	);
}

const COMPLEXITY_TONE: Record<string, { background: string; border: string; color: string }> = {
	high: { background: "rgba(139, 92, 246, 0.22)", border: "rgba(167, 139, 250, 0.55)", color: "#ddd6fe" },
	medium: { background: "rgba(245, 158, 11, 0.2)", border: "rgba(251, 191, 36, 0.55)", color: "#fbbf24" },
	low: { background: "rgba(148, 163, 184, 0.16)", border: "rgba(148, 163, 184, 0.45)", color: "#cbd5e1" },
};

function ComplexityBadge({ value, label }: { value: string; label: string }) {
	const tone = COMPLEXITY_TONE[value] ?? COMPLEXITY_TONE.low;
	return (
		<span
			className="inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold"
			style={{ backgroundColor: tone.background, borderColor: tone.border, color: tone.color }}
		>
			{label}
		</span>
	);
}

function DateRange({
	start,
	end,
	endColor,
}: {
	start: string | null;
	end: string | null;
	endColor?: string;
}) {
	if (!start && !end) {
		return <span className="text-xs text-slate-500">Dates to be confirmed</span>;
	}
	return (
		<p className="text-center text-xs tabular-nums text-slate-400">
			{start ? formatShortDate(start) : "TBC"}
			{" → "}
			<span className="font-semibold" style={end && endColor ? { color: endColor } : undefined}>
				{end ? formatShortDate(end) : "TBC"}
			</span>
		</p>
	);
}

function AthleteAssigned({ assigned }: { assigned: boolean }) {
	if (assigned) {
		return (
			<span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
				<ClientPortalAthleteMark />
				Athlete assigned
			</span>
		);
	}
	return <span className="text-[11px] font-medium text-slate-500">Athlete to be assigned</span>;
}

function ProjectCard({
	project,
	compact = false,
}: {
	project: PublicClientPortalProject;
	compact?: boolean;
}) {
	const accent = dueAccent(project);
	return (
		<article className="client-portal-card relative overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
			<span
				className="pointer-events-none absolute bottom-0 left-0 top-0 w-[3px] rounded-l-xl"
				style={{ backgroundColor: accent }}
				aria-hidden
			/>
			<div className="flex items-start justify-between gap-3 pl-1">
				<div className="min-w-0">
					<h3 className="font-semibold text-white">{project.name}</h3>
					{project.address ? <p className="mt-0.5 text-xs text-slate-500">{project.address}</p> : null}
				</div>
				<StatusBadge label={project.statusBadge.label} color={project.statusBadge.color} />
			</div>
			<div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2 pl-1">
				<div className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-slate-400">
					<span>
						Stage <span className="text-slate-300">{project.currentStageLabel}</span>
					</span>
					<span className="text-slate-600">·</span>
					<LanePill n={project.laneNumber} />
				</div>
				<DateRange start={project.startDate} end={project.dueDate} endColor={accent} />
				<span aria-hidden />
			</div>
			{!compact ? (
				<div className="mt-3 flex items-center gap-3 pl-1">
					<div className="min-w-0 flex-1">
						<ProjectProgressBar percent={project.progressPercent} showLabel={false} />
					</div>
					<span className="shrink-0 text-xs tabular-nums text-slate-400">{project.progressPercent}%</span>
				</div>
			) : null}
			<div className="mt-4 flex flex-wrap items-center justify-between gap-3 pl-1">
				<LeadBlock name={project.leadName} />
				<AthleteAssigned assigned={!!project.assignedAthleteName} />
			</div>
		</article>
	);
}

function PipelineCard({ project }: { project: PublicClientPortalPipelineProject }) {
	return (
		<article className="client-portal-card relative overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
			<span
				className="pointer-events-none absolute bottom-0 left-0 top-0 w-[3px] rounded-l-xl"
				style={{ backgroundColor: PIPELINE_PURPLE }}
				aria-hidden
			/>
			<div className="flex items-start justify-between gap-3 pl-1">
				<div className="min-w-0">
					<h3 className="font-semibold text-white">{project.name}</h3>
					{project.address ? <p className="mt-0.5 text-xs text-slate-500">{project.address}</p> : null}
				</div>
				<StatusBadge label="Planned" color={PIPELINE_PURPLE} />
			</div>
			<div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2 pl-1">
				<div className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-slate-400">
					{project.expectedStageLabel ? (
						<span>
							Stage <span className="text-slate-300">{project.expectedStageLabel}</span>
						</span>
					) : (
						<span>Stage to be confirmed</span>
					)}
				</div>
				<DateRange start={project.targetStartDate} end={project.targetDueDate} endColor={PIPELINE_PURPLE} />
				<span aria-hidden />
			</div>
			<div className="mt-4 flex flex-wrap items-center justify-between gap-3 pl-1">
				<span className="text-xs text-slate-500">Lead assigned soon</span>
				<AthleteAssigned assigned={false} />
			</div>
		</article>
	);
}

function CompletedPreviewCard({ project }: { project: PublicClientPortalProject }) {
	return (
		<article className="client-portal-card relative overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0">
					<h3 className="font-semibold text-white">{project.name}</h3>
					{project.address ? <p className="mt-0.5 text-xs text-slate-500">{project.address}</p> : null}
					<p className="mt-2 text-xs text-slate-400">
						Stage <span className="text-slate-300">{project.currentStageLabel}</span>
						<span className="mx-2 text-slate-600">·</span>
						<LanePill n={project.laneNumber} />
					</p>
				</div>
				<div className="flex flex-col items-end gap-2">
					<span className="text-xs tabular-nums text-slate-400">{formatDateOnly(project.completedAt)}</span>
					<StatusBadge label="Completed" color="#22c55e" />
				</div>
			</div>
			<div className="mt-4 flex flex-wrap items-center justify-between gap-3">
				<LeadBlock name={project.leadName} />
				<ComplexityBadge value={project.complexity} label={project.complexityLabel} />
			</div>
		</article>
	);
}

function SectionLink({
	label,
	onClick,
}: {
	label: string;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className="text-sm font-medium text-brand-300 hover:text-brand-200"
		>
			{label} →
		</button>
	);
}

const NOTIFICATION_ICON: Record<
	ClientPortalNotificationKind,
	{ glyph: string; bg: string; color: string }
> = {
	deadline_beaten: { glyph: "★", bg: "rgba(234,179,8,0.15)", color: "#facc15" },
	hours_warning: { glyph: "!", bg: "rgba(245,158,11,0.18)", color: "#fbbf24" },
	hours_cap: { glyph: "!", bg: "rgba(239,68,68,0.18)", color: "#f87171" },
	overtime: { glyph: "£", bg: "rgba(6,182,212,0.15)", color: "#22d3ee" },
};

function NotificationRow({
	notification,
	unread,
	onOvertime,
}: {
	notification: ClientPortalNotification;
	unread: boolean;
	onOvertime?: () => void;
}) {
	const icon = NOTIFICATION_ICON[notification.kind];
	return (
		<div className="client-portal-notification flex gap-3 border-b border-white/[0.06] py-3 last:border-b-0">
			<span
				className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold"
				style={{ backgroundColor: icon.bg, color: icon.color }}
			>
				{icon.glyph}
			</span>
			<div className="min-w-0 flex-1">
				<p className="text-sm font-semibold text-white">{notification.title}</p>
				<p className="mt-0.5 text-xs leading-snug text-slate-400">{notification.description}</p>
				{notification.action === "overtime" && onOvertime ? (
					<button
						type="button"
						onClick={onOvertime}
						className="mt-1.5 text-xs font-medium text-brand-300 hover:text-brand-200"
					>
						View overtime breakdown →
					</button>
				) : null}
			</div>
			<div className="flex shrink-0 flex-col items-end gap-1 pt-0.5">
				<span className="text-[11px] text-slate-500">{notification.timeLabel}</span>
				{unread ? <span className="h-2 w-2 rounded-full bg-red-500" aria-label="Unread" /> : null}
			</div>
		</div>
	);
}

export function ClientPortalClient({
	data,
	slug,
	initialPage = "overview",
}: {
	data: PublicClientPortalData;
	slug: string;
	initialPage?: PortalPage;
}) {
	const [page, setPage] = useState<PortalPage>(initialPage);
	const [calendarMonth, setCalendarMonth] = useState(() => new Date().toISOString().slice(0, 7));
	const [readNotificationIds, setReadNotificationIds] = useState<Set<string>>(() => new Set());
	const [bellOpen, setBellOpen] = useState(false);
	const [overtimeOpen, setOvertimeOpen] = useState(data.hours.overtimeHours > 0);
	const bellRef = useRef<HTMLDivElement>(null);

	const notifications = useMemo(
		() => buildClientPortalNotifications(data.activeProjects, data.completedProjects, data.hours),
		[data.activeProjects, data.completedProjects, data.hours],
	);
	const unreadCount = notifications.filter((n) => !readNotificationIds.has(n.id)).length;
	const laneCaptions = useMemo(() => laneHoursCaption(data.hours), [data.hours]);

	useEffect(() => {
		if (!bellOpen) return;
		function onDoc(e: MouseEvent) {
			if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false);
		}
		function onKey(e: KeyboardEvent) {
			if (e.key === "Escape") setBellOpen(false);
		}
		document.addEventListener("mousedown", onDoc);
		document.addEventListener("keydown", onKey);
		return () => {
			document.removeEventListener("mousedown", onDoc);
			document.removeEventListener("keydown", onKey);
		};
	}, [bellOpen]);

	const trackerMarks = useMemo(
		() =>
			data.activeProjects
				.filter((p) => p.dueDate)
				.map((p) => ({
					date: p.dueDate!,
					label: `${p.name} due`,
					color: dueAccent(p),
				})),
		[data.activeProjects],
	);

	const pipelineMarks = useMemo(
		() =>
			data.pipelineProjects
				.filter((p) => p.targetDueDate)
				.map((p) => ({
					date: p.targetDueDate!,
					label: `${p.name} target`,
					color: PIPELINE_PURPLE,
				})),
		[data.pipelineProjects],
	);

	const calendarMarks = page === "pipeline" ? pipelineMarks : trackerMarks;
	const upcoming =
		page === "pipeline"
			? data.pipelineProjects
					.filter((p) => p.targetDueDate)
					.map((p) => ({
						id: p.id,
						date: p.targetDueDate!,
						name: p.name,
						color: PIPELINE_PURPLE,
					}))
			: data.activeProjects
					.filter((p) => p.dueDate)
					.map((p) => ({
						id: p.id,
						date: p.dueDate!,
						name: p.name,
						color: dueAccent(p),
					}));
	upcoming.sort((a, b) => a.date.localeCompare(b.date));

	const maxAverage = Math.max(1, ...data.phaseAverages.map((p) => p.averageHours));
	const navItems: { id: PortalPage; label: string }[] = [
		{ id: "overview", label: "Ops Overview" },
		{ id: "tracker", label: "Project Tracker" },
		{ id: "pipeline", label: "Pipeline Tracker" },
		{ id: "completed", label: "Completed Projects" },
	];

	function go(next: PortalPage) {
		setPage(next);
		setBellOpen(false);
	}

	function openOvertime() {
		setPage("overview");
		setBellOpen(false);
		setOvertimeOpen(true);
		requestAnimationFrame(() => {
			document.getElementById("portal-overtime")?.scrollIntoView({ behavior: "smooth", block: "start" });
		});
	}

	const calendarPanel = (
		<section>
			<h2 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Project due dates</h2>
			<div className="client-portal-card mt-3 rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
				<MiniMonthCalendar
					size="lg"
					markStyle="fill"
					month={calendarMonth}
					marks={calendarMarks}
					onMonthChange={setCalendarMonth}
					onSelectDate={(date) => setCalendarMonth(date.slice(0, 7))}
				/>
				<p className="mt-4 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Upcoming deadlines</p>
				<ul className="mt-3 space-y-2">
					{upcoming.length === 0 ? (
						<li className="text-xs text-slate-500">No dates in this view.</li>
					) : (
						upcoming.map((item) => (
							<li key={item.id} className="flex items-center gap-2 text-xs">
								<span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: item.color }} />
								<span className="w-14 shrink-0 tabular-nums text-slate-400">{formatShortDate(item.date)}</span>
								<span className="min-w-0 truncate text-slate-300">{item.name}</span>
							</li>
						))
					)}
				</ul>
			</div>
		</section>
	);

	const overtimePanel = (
		<section id="portal-overtime" className="client-portal-card rounded-xl border border-white/[0.08] bg-white/[0.03] p-5">
			<div className="flex items-start justify-between gap-3">
				<div>
					<p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Overtime this month</p>
					{data.hours.overtimeHours > 0 ? (
						<p className="mt-2 text-3xl font-semibold tabular-nums text-cyan-300">
							£{data.hours.overtimeCostGbp.toLocaleString("en-GB")}
						</p>
					) : (
						<p className="mt-2 text-lg font-semibold text-white">No overtime this month</p>
					)}
				</div>
				{data.hours.overtimeHours > 0 ? (
					<div className="text-right">
						<p className="text-2xl font-semibold tabular-nums text-white">{formatPortalHours(data.hours.overtimeHours)}h</p>
						<p className="text-[11px] text-slate-500">at £{data.hours.overtimeRateGbp}/hour</p>
					</div>
				) : (
					<p className="text-[11px] text-slate-500">£{data.hours.overtimeRateGbp}/hour after 160h per lane</p>
				)}
			</div>
			{laneCaptions.length > 0 ? (
				<ul className="mt-4 space-y-1.5 text-xs text-slate-400">
					{laneCaptions.map((row) => (
						<li key={row.label} className="flex items-center gap-2">
							<span
								className="h-2 w-2 rounded-full"
								style={{ backgroundColor: row.tone === "cap" ? "#f87171" : "#c084fc" }}
							/>
							{row.label}
						</li>
					))}
				</ul>
			) : null}
			{data.hours.overtimeEntries.length > 0 ? (
				<div className="mt-4 border-t border-white/[0.06] pt-3">
					<button
						type="button"
						onClick={() => setOvertimeOpen((v) => !v)}
						className="flex w-full items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500"
					>
						Breakdown
						<span>{overtimeOpen ? "▴" : "▾"}</span>
					</button>
					{overtimeOpen ? (
						<ul className="mt-3 space-y-2">
							{data.hours.overtimeEntries.map((entry) => (
								<li key={entry.id} className="flex items-start justify-between gap-3 text-xs">
									<div className="min-w-0">
										<p className="text-slate-400">{formatShortDate(entry.date)}</p>
										<p className="truncate font-medium text-slate-200">{entry.projectName}</p>
										<p className="text-slate-500">{entry.taskLabel}</p>
									</div>
									<div className="shrink-0 text-right tabular-nums">
										<p className="text-slate-200">{formatPortalHours(entry.hours)}h</p>
										<p className="text-slate-500">£{entry.costGbp.toLocaleString("en-GB")}</p>
									</div>
								</li>
							))}
						</ul>
					) : null}
				</div>
			) : null}
		</section>
	);

	return (
		<div className="flex min-h-screen">
			<aside className="client-portal-sidebar sticky top-0 hidden h-screen w-56 shrink-0 flex-col overflow-hidden border-r border-white/[0.06] bg-[var(--bg-sidebar)] lg:flex">
				<div className="client-portal-sidebar-scroll flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain px-4 pb-4 pt-8">
					<ClientPortalBrandMark />
					<p className="mt-6 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Your account</p>
					<nav className="mt-3 space-y-1">
						{navItems.map((item) => (
							<button
								key={item.id}
								type="button"
								onClick={() => setPage(item.id)}
								className={`client-portal-nav flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm ${
									page === item.id
										? "client-portal-nav-active bg-white/[0.08] text-white"
										: "text-slate-400 hover:bg-white/[0.04]"
								}`}
							>
								{item.label}
							</button>
						))}
					</nav>
				</div>
				<div className="shrink-0 border-t border-white/[0.06] px-4 py-4">
					<PublicThemeToggle />
				</div>
			</aside>

			<div className="client-portal-main flex min-w-0 flex-1 flex-col">
				<header className="client-portal-header border-b border-white/[0.06] px-4 py-5 sm:px-8">
					<div className="flex flex-wrap items-start justify-between gap-4">
						<div className="flex min-w-0 items-start gap-4">
							<ClientAvatar
								name={data.client.name}
								logoUrl={data.client.logoUrl}
								backgroundColor={data.client.logoBgColor}
								textTone={asAvatarTextTone(data.client.logoTextTone)}
								size={48}
							/>
							<div>
								<h1 className="text-xl font-semibold text-white sm:text-2xl">{data.client.name}</h1>
								<p className="mt-0.5 text-sm text-slate-400">Live view of active project status and deadlines.</p>
							</div>
						</div>
						<div className="flex flex-wrap items-center gap-2">
							<div className="relative" ref={bellRef}>
								<button
									type="button"
									aria-label="Notifications"
									onClick={() => setBellOpen((v) => !v)}
									className="relative rounded-lg border border-white/[0.1] bg-white/[0.04] px-2.5 py-1.5 text-slate-300 hover:bg-white/[0.08]"
								>
									<span aria-hidden>🔔</span>
									{unreadCount > 0 ? (
										<span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
											{unreadCount}
										</span>
									) : null}
								</button>
								{bellOpen ? (
									<div className="absolute right-0 z-30 mt-2 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-white/[0.1] bg-[#0b1220] shadow-2xl">
										<div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
											<div className="flex items-center gap-2">
												<p className="text-sm font-semibold text-white">Notifications</p>
												{unreadCount > 0 ? (
													<span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-bold text-red-300">
														{unreadCount} new
													</span>
												) : null}
											</div>
											<button type="button" onClick={() => setBellOpen(false)} className="text-slate-500 hover:text-white">
												×
											</button>
										</div>
										<div className="max-h-80 overflow-y-auto px-4">
											{notifications.length === 0 ? (
												<p className="py-8 text-center text-sm text-slate-500">No notifications yet.</p>
											) : (
												notifications.map((n) => (
													<NotificationRow
														key={n.id}
														notification={n}
														unread={!readNotificationIds.has(n.id)}
														onOvertime={openOvertime}
													/>
												))
											)}
										</div>
										{unreadCount > 0 ? (
											<div className="border-t border-white/[0.06] p-3">
												<button
													type="button"
													onClick={() => setReadNotificationIds(new Set(notifications.map((n) => n.id)))}
													className="w-full rounded-lg border border-white/[0.1] py-2 text-xs font-semibold text-slate-300 hover:bg-white/[0.04]"
												>
													Mark all as read
												</button>
											</div>
										) : null}
									</div>
								) : null}
							</div>
							<span className="client-portal-badge rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-300">
								Active lanes {data.client.activeLaneCount}
							</span>
							<span className="client-portal-badge client-portal-badge-brand rounded-lg border border-brand-500/40 bg-brand-500/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-brand-200">
								Client view
							</span>
							<div className="lg:hidden">
								<PublicThemeToggle />
							</div>
						</div>
					</div>
					<div className="mt-4 flex flex-wrap gap-2 lg:hidden">
						{navItems.map((item) => (
							<button
								key={item.id}
								type="button"
								onClick={() => setPage(item.id)}
								className={`client-portal-nav inline-flex items-center rounded-lg px-3 py-1.5 text-xs ${
									page === item.id ? "client-portal-nav-active bg-white/10 text-white" : "text-slate-500"
								}`}
							>
								{item.label}
							</button>
						))}
					</div>
				</header>

				<main className="flex-1 px-4 py-6 sm:px-8">
					{page === "overview" ? (
						<div className="grid gap-6 xl:grid-cols-[minmax(0,280px)_minmax(0,1fr)_minmax(0,300px)]">
							{calendarPanel}
							<div className="space-y-6">
								<section>
									<div className="flex items-center justify-between gap-3">
										<h2 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
											Active projects · {data.activeProjects.length}
										</h2>
									</div>
									{data.activeProjects.length === 0 ? (
										<p className="mt-3 text-sm text-slate-500">No active projects right now.</p>
									) : (
										<div className="mt-3 space-y-3">
											{data.activeProjects.map((project) => (
												<ProjectCard key={project.id} project={project} />
											))}
										</div>
									)}
									<div className="mt-3 flex justify-end">
										<SectionLink label="Project Tracker" onClick={() => go("tracker")} />
									</div>
								</section>
								<section>
									<h2 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
										Pipeline · {data.pipelineProjects.length}
									</h2>
									{data.pipelineProjects.length === 0 ? (
										<p className="mt-3 text-sm text-slate-500">No upcoming pipeline projects right now.</p>
									) : (
										<div className="mt-3 space-y-3">
											{data.pipelineProjects.map((project) => (
												<PipelineCard key={project.id} project={project} />
											))}
										</div>
									)}
									<div className="mt-3 flex justify-end">
										<SectionLink label="Pipeline Tracker" onClick={() => go("pipeline")} />
									</div>
								</section>
								<section>
									<h2 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
										Completed projects · {data.completedProjects.length} records
									</h2>
									{data.completedProjects.length === 0 ? (
										<p className="mt-3 text-sm text-slate-500">No completed packs yet.</p>
									) : (
										<div className="mt-3 space-y-3">
											{data.completedProjects.slice(0, 3).map((project) => (
												<CompletedPreviewCard key={project.id} project={project} />
											))}
										</div>
									)}
									<div className="mt-3 flex justify-end">
										<SectionLink label="Completed Projects" onClick={() => go("completed")} />
									</div>
								</section>
							</div>
							<div className="space-y-4">
								<section className="client-portal-card rounded-xl border border-white/[0.08] bg-white/[0.03] p-5">
									<p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Completed packs</p>
									<p className="mt-2 text-4xl font-semibold tabular-nums text-white">{data.completedProjects.length}</p>
									<p className="mt-1 text-xs text-slate-500">All-time for this firm</p>
								</section>
								<section className="client-portal-card rounded-xl border border-white/[0.08] bg-white/[0.03] p-5">
									<p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Average hours by phase</p>
									{data.phaseAverages.length === 0 ? (
										<p className="mt-3 text-sm text-slate-500">No completed-pack history to average yet.</p>
									) : (
										<ul className="mt-4 space-y-3">
											{data.phaseAverages.map((row) => (
												<li key={row.phase}>
													<div className="flex items-center justify-between gap-2 text-xs">
														<span className="text-slate-300">{row.label}</span>
														<span className="tabular-nums text-slate-200">{formatPortalHours(row.averageHours)}h</span>
													</div>
													<div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
														<div
															className="h-full rounded-full bg-cyan-400"
															style={{ width: `${Math.max(6, (row.averageHours / maxAverage) * 100)}%` }}
														/>
													</div>
													<p className="mt-1 text-[10px] text-slate-500">
														{row.packCount === 1 ? "1 pack" : `${row.packCount} packs`}
													</p>
												</li>
											))}
										</ul>
									)}
								</section>
								{overtimePanel}
							</div>
						</div>
					) : null}

					{page === "tracker" ? (
						<div className="grid gap-6 xl:grid-cols-[minmax(0,280px)_1fr]">
							{calendarPanel}
							<section>
								<h2 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
									Active projects · {data.activeProjects.length}
								</h2>
								{data.activeProjects.length === 0 ? (
									<p className="mt-3 text-sm text-slate-500">No active projects right now.</p>
								) : (
									<div className="mt-3 space-y-3">
										{data.activeProjects.map((project) => (
											<ProjectCard key={project.id} project={project} />
										))}
									</div>
								)}
							</section>
						</div>
					) : null}

					{page === "pipeline" ? (
						<div className="grid gap-6 xl:grid-cols-[minmax(0,280px)_1fr]">
							{calendarPanel}
							<section>
								<div className="flex flex-wrap items-end justify-between gap-2">
									<h2 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
										Upcoming pipeline · {data.pipelineProjects.length}
									</h2>
									<p className="text-xs text-slate-500">Planned dates · Subject to confirmation</p>
								</div>
								{data.pipelineProjects.length === 0 ? (
									<p className="mt-3 text-sm text-slate-500">No upcoming pipeline projects right now.</p>
								) : (
									<div className="mt-3 space-y-3">
										{data.pipelineProjects.map((project) => (
											<PipelineCard key={project.id} project={project} />
										))}
									</div>
								)}
							</section>
						</div>
					) : null}

					{page === "completed" ? (
						<section>
							<h2 className="text-2xl font-semibold text-white">Completed Projects</h2>
							<p className="mt-1 text-sm text-slate-500">
								{data.completedProjects.length === 1
									? "1 completed pack"
									: `${data.completedProjects.length} completed packs`}
							</p>
							{data.completedProjects.length > 0 ? (
								<div className="client-portal-card mt-5 overflow-x-auto rounded-xl ring-1 ring-white/[0.06]">
									<table className="client-portal-completed-table w-full min-w-[44rem] text-left text-sm">
										<thead className="bg-white/[0.03] text-[10px] uppercase tracking-wider text-slate-500">
											<tr>
												<th className="px-4 py-3 font-semibold">Project</th>
												<th className="px-4 py-3 font-semibold">Drawing pack / phase</th>
												<th className="px-4 py-3 font-semibold">Completed date</th>
												<th className="px-4 py-3 font-semibold">Your lead</th>
												<th className="px-4 py-3 font-semibold">Complexity</th>
											</tr>
										</thead>
										<tbody>
											{data.completedProjects.map((project) => (
												<tr key={project.id} className="client-portal-completed-row border-b border-white/[0.06] last:border-b-0">
													<td className="px-4 py-4">
														<p className="font-semibold text-white">{project.name}</p>
														{project.address ? <p className="mt-0.5 text-xs text-slate-500">{project.address}</p> : null}
													</td>
													<td className="px-4 py-4 text-slate-300">{project.currentStageLabel}</td>
													<td className="px-4 py-4 whitespace-nowrap text-slate-300">{formatDateOnly(project.completedAt)}</td>
													<td className="px-4 py-4" style={{ overflow: "visible" }}>
														<LeadBlock name={project.leadName} showLabel={false} />
													</td>
													<td className="px-4 py-4" style={{ overflow: "visible" }}>
														<ComplexityBadge value={project.complexity} label={project.complexityLabel} />
													</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
							) : (
								<p className="mt-6 text-sm text-slate-500">No completed packs yet.</p>
							)}
						</section>
					) : null}
				</main>

				<footer className="client-portal-footer border-t border-white/[0.06] px-4 py-4 text-center text-[11px] text-slate-500 sm:px-8">
					Powered by Blocharch ·{" "}
					<Link href={clientPortalPath(slug)} className="text-slate-500 hover:text-slate-400">
						Client portal
					</Link>
				</footer>
			</div>
		</div>
	);
}
