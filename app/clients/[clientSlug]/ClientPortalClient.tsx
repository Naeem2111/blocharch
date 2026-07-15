"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ClientPortalBrandMark } from "@/components/client-portal/ClientPortalBrandMark";
import { ClientAvatar } from "@/components/ops/ClientAvatar";
import { AthleteAvatar } from "@/components/ops/AthleteAvatar";
import { MiniMonthCalendar } from "@/components/MiniMonthCalendar";
import { ProjectProgressBar } from "@/components/ProjectProgressBar";
import { asAvatarTextTone } from "@/lib/avatar-text-tone";
import { clientPortalPath } from "@/lib/client-slug";
import {
	buildClientPortalNotifications,
	type ClientPortalNotification,
	type ClientPortalNotificationKind,
} from "@/lib/client-portal-notifications";
import {
	daysUntilDueFromIso,
	projectDueColor,
} from "@/lib/project-color-scale";
import { clientPortalProjectBeatDeadline } from "@/lib/client-portal-projects";
import { PublicThemeToggle } from "@/components/client-portal/PublicThemeToggle";
import type {
	PublicClientPortalData,
	PublicClientPortalProject,
} from "@/lib/public-client-portal";

type Tab = "tracker" | "completed" | "notifications";

function formatShortDate(iso: string | null): string {
	if (!iso) return "";
	const d = new Date(`${iso}T12:00:00`);
	if (Number.isNaN(d.getTime())) return iso;
	return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function formatDateRange(
	start: string | null,
	due: string | null,
): string | null {
	if (start && due)
		return `${formatShortDate(start)} – ${formatShortDate(due)}`;
	if (due) return `Due ${formatShortDate(due)}`;
	if (start) return `From ${formatShortDate(start)}`;
	return null;
}

function leadInitials(name: string): string {
	return name
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((w) => w[0]?.toUpperCase() ?? "")
		.join("");
}

const NOTIFICATION_ICON: Record<
	ClientPortalNotificationKind,
	{ glyph: string; bg: string; color: string }
> = {
	deadline_beaten: { glyph: "★", bg: "rgba(234,179,8,0.15)", color: "#facc15" },
};

function ProjectCard({ project }: { project: PublicClientPortalProject }) {
	const accent = projectDueColor(daysUntilDueFromIso(project.dueDate));
	const dateRange = formatDateRange(project.startDate, project.dueDate);
	const metaParts = [
		project.currentStageLabel,
		`Lane ${project.laneNumber}`,
		dateRange,
	].filter(Boolean);

	return (
		<article className="client-portal-card relative rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 sm:p-5">
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0 flex-1">
					<h3 className="text-base font-semibold text-white sm:text-[17px]">
						{project.name}
					</h3>
					{project.address ? (
						<p className="mt-0.5 text-xs text-slate-500">{project.address}</p>
					) : null}
				</div>
				<span
					className="client-portal-status-badge inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide"
					style={{
						backgroundColor: `${project.statusBadge.color}22`,
						color: project.statusBadge.color,
						borderColor: `${project.statusBadge.color}44`,
					}}
				>
					<span
						className="h-1.5 w-1.5 rounded-full"
						style={{ backgroundColor: project.statusBadge.color }}
					/>
					{project.statusBadge.label}
				</span>
			</div>

			<p className="mt-2.5 text-xs text-slate-400">{metaParts.join(" · ")}</p>

			<div className="mt-4">
				<ProjectProgressBar percent={project.progressPercent} />
			</div>

			<div className="mt-4 flex flex-wrap items-center justify-between gap-3">
				{project.leadName ? (
					<div className="flex items-center gap-2.5">
						{project.leadPhotoUrl ? (
							<AthleteAvatar
								name={project.leadName}
								photoUrl={project.leadPhotoUrl}
								backgroundColor={project.leadPhotoBgColor}
								textTone={asAvatarTextTone(project.leadPhotoTextTone)}
								size={32}
							/>
						) : (
							<span className="client-portal-lead-avatar inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.08] text-[11px] font-semibold text-slate-300">
								{leadInitials(project.leadName)}
							</span>
						)}
						<span className="text-sm text-slate-300">{project.leadName}</span>
					</div>
				) : (
					<span className="text-xs text-slate-500">Lead assigned soon</span>
				)}
				{project.assignedAthleteName ? (
					<span className="text-[11px] font-medium text-slate-500">
						Athlete assigned
					</span>
				) : null}
			</div>
			<span
				className="pointer-events-none absolute bottom-0 left-0 top-0 w-[3px] rounded-l-xl"
				style={{ backgroundColor: accent }}
				aria-hidden
			/>
		</article>
	);
}

function CompletedRow({ project }: { project: PublicClientPortalProject }) {
	const outcome =
		project.deadlineBeatenDays != null && project.deadlineBeatenDays > 0
			? {
					label: `${project.deadlineBeatenDays} day${project.deadlineBeatenDays === 1 ? "" : "s"} early`,
					early: true,
				}
			: project.handoverDate
				? { label: "On time", early: false }
				: null;

	return (
		<article className="client-portal-card client-portal-completed-row relative grid gap-4 rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_auto_auto_auto_auto] sm:items-center sm:gap-3">
			<div className="min-w-0">
				<p className="font-semibold text-white">{project.name}</p>
				{project.address ? (
					<p className="mt-0.5 truncate text-xs text-slate-500">
						{project.address}
					</p>
				) : null}
				<div className="mt-2.5 max-w-[220px]">
					<ProjectProgressBar percent={100} />
				</div>
			</div>

			<div className="flex items-center gap-2.5">
				{project.leadName ? (
					<>
						<span className="client-portal-lead-avatar inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-[11px] font-semibold text-slate-300">
							{leadInitials(project.leadName)}
						</span>
						<div className="min-w-0">
							<p className="truncate text-sm text-slate-200">{project.leadName}</p>
							<p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
								Lane lead
							</p>
						</div>
					</>
				) : (
					<span className="text-xs text-slate-600">—</span>
				)}
			</div>

			<span className="client-portal-lane-pill w-fit rounded-md border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
				Lane {project.laneNumber}
			</span>

			<div className="text-sm text-slate-300">
				{project.dueDate ? formatShortDate(project.dueDate) : "—"}
			</div>

			<div className="text-sm font-medium text-emerald-400 client-portal-accent-emerald">
				{project.handoverDate ? formatShortDate(project.handoverDate) : "—"}
			</div>

			{outcome ? (
				<span
					className={`client-portal-outcome-badge inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase ${
						outcome.early
							? "bg-emerald-500/15 text-emerald-300"
							: "border border-sky-500/30 bg-sky-500/10 text-sky-300"
					}`}
				>
					{outcome.early ? `▲ ${outcome.label}` : outcome.label}
				</span>
			) : (
				<span className="text-xs text-slate-600">—</span>
			)}

			<span
				className="pointer-events-none absolute bottom-0 left-0 top-0 w-[3px] rounded-l-xl bg-emerald-500"
				aria-hidden
			/>
		</article>
	);
}

function NotificationRow({
	notification,
	unread,
}: {
	notification: ClientPortalNotification;
	unread: boolean;
}) {
	const icon = NOTIFICATION_ICON[notification.kind];
	return (
		<div className="client-portal-notification flex gap-4 border-b border-white/[0.06] py-4 last:border-b-0">
			<span
				className="client-portal-notification-icon flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm"
				style={{ backgroundColor: icon.bg, color: icon.color }}
			>
				{icon.glyph}
			</span>
			<div className="min-w-0 flex-1">
				<p className="font-semibold text-white">{notification.title}</p>
				<p className="mt-0.5 text-sm text-slate-500">{notification.description}</p>
			</div>
			<div className="flex shrink-0 items-start gap-2 pt-0.5">
				<span className="text-xs text-slate-500">{notification.timeLabel}</span>
				{unread ? (
					<span
						className="client-portal-unread-dot mt-1.5 h-2 w-2 rounded-full bg-brand-400"
						aria-label="Unread"
					/>
				) : (
					<span className="h-2 w-2" aria-hidden />
				)}
			</div>
		</div>
	);
}

export function ClientPortalClient({
	data,
	slug,
	initialTab = "tracker",
}: {
	data: PublicClientPortalData;
	slug: string;
	initialTab?: Tab;
}) {
	const [tab, setTab] = useState<Tab>(initialTab);
	const [calendarMonth, setCalendarMonth] = useState(() =>
		new Date().toISOString().slice(0, 7),
	);
	const [completedLaneFilter, setCompletedLaneFilter] = useState<number | "all">(
		"all",
	);
	const [readNotificationIds, setReadNotificationIds] = useState<Set<string>>(
		() => new Set(),
	);

	const notifications = useMemo(
		() =>
			buildClientPortalNotifications(
				data.activeProjects,
				data.completedProjects,
			),
		[data.activeProjects, data.completedProjects],
	);

	const unreadCount = notifications.filter(
		(n) => !readNotificationIds.has(n.id),
	).length;

	const calendarProjects =
		tab === "tracker" ? data.activeProjects : data.completedProjects;

	const dueMarks = useMemo(
		() =>
			calendarProjects
				.filter((p) => p.dueDate)
				.map((p) => ({
					date: p.dueDate!,
					label: `${p.name} due`,
					color: projectDueColor(daysUntilDueFromIso(p.dueDate)),
				})),
		[calendarProjects],
	);

	const completedFiltered = useMemo(() => {
		if (completedLaneFilter === "all") return data.completedProjects;
		return data.completedProjects.filter(
			(p) => p.laneNumber === completedLaneFilter,
		);
	}, [data.completedProjects, completedLaneFilter]);

	const laneCounts = useMemo(() => {
		const counts = new Map<number, number>();
		for (const p of data.completedProjects) {
			counts.set(p.laneNumber, (counts.get(p.laneNumber) ?? 0) + 1);
		}
		return counts;
	}, [data.completedProjects]);

	const beatenSummary = useMemo(() => {
		const total = data.completedProjects.length;
		if (total === 0) return null;
		const beaten = data.completedProjects.filter((p) =>
			clientPortalProjectBeatDeadline(p),
		).length;
		const pct = Math.round((beaten / total) * 100);
		return { beaten, total, pct };
	}, [data.completedProjects]);

	const navItems: { id: Tab; label: string; badge?: number }[] = [
		{ id: "tracker", label: "Project tracker" },
		{ id: "completed", label: "Completed projects" },
		{
			id: "notifications",
			label: "Notifications",
			badge: unreadCount > 0 ? unreadCount : undefined,
		},
	];

	const headerSubtitle =
		tab === "tracker"
			? "Live view of active project status and deadlines."
			: tab === "completed"
				? "Completed projects · full delivery record"
				: "Beat deadline updates across your projects";

	return (
		<div className="flex min-h-screen">
			<aside className="client-portal-sidebar sticky top-0 hidden h-screen w-56 shrink-0 flex-col overflow-hidden border-r border-white/[0.06] bg-[var(--bg-sidebar)] lg:flex">
				<div className="client-portal-sidebar-scroll flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain px-4 pb-4 pt-8">
					<ClientPortalBrandMark />
					<p className="mt-6 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
						Your account
					</p>
					<nav className="mt-3 space-y-1">
						{navItems.map((item) => (
							<button
								key={item.id}
								type="button"
								onClick={() => setTab(item.id)}
								className={`client-portal-nav flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm ${
									tab === item.id
										? "client-portal-nav-active bg-white/[0.08] text-white"
										: "text-slate-400 hover:bg-white/[0.04]"
								}`}
							>
								<span>{item.label}</span>
								{item.badge != null ? (
									<span className="client-portal-nav-badge rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
										{item.badge}
									</span>
								) : null}
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
								<h1 className="text-xl font-semibold text-white sm:text-2xl">
									{data.client.name}
								</h1>
								<p className="mt-0.5 text-sm text-slate-400">{headerSubtitle}</p>
							</div>
						</div>
						<div className="flex flex-wrap items-center gap-2">
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
								onClick={() => setTab(item.id)}
								className={`client-portal-nav inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs ${
									tab === item.id
										? "client-portal-nav-active bg-white/10 text-white"
										: "text-slate-500"
								}`}
							>
								{item.label}
								{item.badge != null ? (
									<span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[9px] font-bold text-white">
										{item.badge}
									</span>
								) : null}
							</button>
						))}
					</div>
				</header>

				<main className="flex-1 px-4 py-6 sm:px-8">
					{tab === "tracker" ? (
						<div className="grid gap-6 xl:grid-cols-[minmax(0,280px)_1fr]">
							<section>
								<h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
									Project due dates
								</h2>
								<div className="client-portal-card mt-3 rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
									<MiniMonthCalendar
										month={calendarMonth}
										marks={dueMarks}
										onSelectDate={(date) => setCalendarMonth(date.slice(0, 7))}
									/>
									<div className="mt-4 flex flex-wrap gap-x-3 gap-y-1.5 text-[10px] text-slate-500">
										<span className="inline-flex items-center gap-1.5">
											<span className="h-2 w-2 rounded-full bg-red-500" />
											Overdue
										</span>
										<span className="inline-flex items-center gap-1.5">
											<span className="h-2 w-2 rounded-full bg-orange-500" />
											1–3 days
										</span>
										<span className="inline-flex items-center gap-1.5">
											<span className="h-2 w-2 rounded-full bg-yellow-400" />
											4–7 days
										</span>
										<span className="inline-flex items-center gap-1.5">
											<span className="h-2 w-2 rounded-full bg-sky-500" />
											8–14 days
										</span>
										<span className="inline-flex items-center gap-1.5">
											<span className="h-2 w-2 rounded-full bg-emerald-500" />
											14+ days
										</span>
									</div>
								</div>
							</section>

							<section>
								<div className="flex items-center justify-between gap-3">
									<h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
										Active projects
									</h2>
									<span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
										{data.activeProjects.length} active
									</span>
								</div>
								{data.activeProjects.length === 0 ? (
									<p className="mt-3 text-sm text-slate-500">
										No active projects right now.
									</p>
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

					{tab === "completed" ? (
						<section className="space-y-5">
							<div>
								<h2 className="text-2xl font-semibold text-white">
									Completed projects
								</h2>
								{beatenSummary ? (
									<p className="mt-1 text-sm text-emerald-400 client-portal-accent-emerald">
										Beaten deadlines {beatenSummary.beaten} of{" "}
										{beatenSummary.total} · {beatenSummary.pct}% delivered on
										or ahead of deadline
									</p>
								) : (
									<p className="mt-1 text-sm text-slate-500">
										No completed projects yet.
									</p>
								)}
							</div>

							{data.completedProjects.length > 0 ? (
								<>
									<div className="flex flex-wrap gap-2">
										<button
											type="button"
											onClick={() => setCompletedLaneFilter("all")}
											className={`client-portal-lane-tab rounded-full border px-3 py-1.5 text-xs font-medium ${
												completedLaneFilter === "all"
													? "client-portal-lane-tab-active border-white/[0.2] bg-white/[0.06] text-white"
													: "border-transparent text-slate-500 hover:text-slate-300"
											}`}
										>
											All lanes {data.completedProjects.length}
										</button>
										{Array.from(
											{ length: data.client.activeLaneCount },
											(_, i) => i + 1,
										).map((lane) => {
											const count = laneCounts.get(lane) ?? 0;
											if (count === 0) return null;
											return (
												<button
													key={lane}
													type="button"
													onClick={() => setCompletedLaneFilter(lane)}
													className={`client-portal-lane-tab rounded-full border px-3 py-1.5 text-xs font-medium ${
														completedLaneFilter === lane
															? "client-portal-lane-tab-active border-white/[0.2] bg-white/[0.06] text-white"
															: "border-transparent text-slate-500 hover:text-slate-300"
													}`}
												>
													Lane {lane} {count}
												</button>
											);
										})}
									</div>

									<div className="client-portal-completed-table hidden gap-3 px-4 text-[10px] font-semibold uppercase tracking-wider text-slate-500 sm:grid sm:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_auto_auto_auto_auto]">
										<span>Project</span>
										<span>Lead</span>
										<span>Lane</span>
										<span>Due</span>
										<span>Handover</span>
										<span>Outcome</span>
									</div>

									<div className="space-y-3">
										{completedFiltered.map((project) => (
											<CompletedRow key={project.id} project={project} />
										))}
									</div>
								</>
							) : null}
						</section>
					) : null}

					{tab === "notifications" ? (
						<section>
							<div className="flex items-center justify-between gap-3">
								<h2 className="text-2xl font-semibold text-white">
									Notifications
								</h2>
								{unreadCount > 0 ? (
									<button
										type="button"
										onClick={() =>
											setReadNotificationIds(
												new Set(notifications.map((n) => n.id)),
											)
										}
										className="text-sm font-medium text-brand-300 hover:text-brand-200"
									>
										Mark all read
									</button>
								) : null}
							</div>
							<div className="client-portal-card mt-4 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 sm:px-5">
								{notifications.length === 0 ? (
									<p className="py-8 text-center text-sm text-slate-500">
										No beaten deadlines yet.
									</p>
								) : (
									notifications.map((n) => (
										<NotificationRow
											key={n.id}
											notification={n}
											unread={!readNotificationIds.has(n.id)}
										/>
									))
								)}
							</div>
						</section>
					) : null}
				</main>

				<footer className="client-portal-footer border-t border-white/[0.06] px-4 py-4 text-center text-[11px] text-slate-500 sm:px-8">
					Powered by Blocharch ·{" "}
					<Link
						href={clientPortalPath(slug)}
						className="text-slate-500 hover:text-slate-400"
					>
						Client portal
					</Link>
				</footer>
			</div>
		</div>
	);
}
