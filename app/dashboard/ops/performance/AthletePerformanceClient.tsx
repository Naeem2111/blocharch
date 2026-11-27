"use client";

import { useEffect, useMemo, useState } from "react";
import type { OpsProjectComplexity, OpsProjectPhase } from "@prisma/client";
import { AthleteAvatar } from "@/components/ops/AthleteAvatar";
import { asAvatarTextTone } from "@/lib/avatar-text-tone";
import { COMPLEXITY_LABELS, OPS_PROJECT_STAGE_OPTIONS } from "@/lib/ops-constants";

type Bucket = {
  label: string;
  count: number;
  averageHours: number | null;
  averageTurnaroundDays: number | null;
  allocatedHours: number | null;
  actualHours: number;
  hoursSaved: number;
  hoursExceeded: number;
};

type DeadlineRow = {
  projectId: string;
  name: string;
  clientName: string;
  stageLabel: string;
  complexityLabel: string;
  outcome: "met" | "beaten" | "missed" | "hold";
  hoursDelta: number | null;
  completedOn: string | null;
  dueOn: string | null;
};

type PointsBreakdown = {
  beaten: number;
  met: number;
  saved: number;
  early: number;
  onTime: number;
  missed: number;
  exceeded: number;
  backlog: number;
  outstanding: number;
};

type AthleteRow = {
  athleteId: string;
  athleteName: string;
  athleteCode: string;
  profilePhotoUrl: string | null;
  profilePhotoBgColor: string | null;
  profilePhotoTextTone: string | null;
  rank: number;
  points: number;
  projectsCompleted: number;
  hoursWorked: number;
  hoursSaved: number;
  hoursExceeded: number;
  allocatedHours: number | null;
  actualHours: number;
  averageTurnaroundDays: number | null;
  deadlinesMet: number;
  deadlinesBeaten: number;
  deadlinesMissed: number;
  hoursBeaten: number;
  hoursOverdue: number;
  averageHoursBeaten: number | null;
  deadlineSuccessRate: number | null;
  holds: number;
  logsOnTime: number;
  logsBacklogged: number;
  outstandingDays: number;
  daysBacklogged: number;
  logCompliance: number | null;
  streak: number;
  pointsBreakdown: PointsBreakdown;
  stages: Bucket[];
  complexities: Bucket[];
  deadlines: DeadlineRow[];
  deadlinesTruncated: boolean;
};

type Report = {
  filters: { scopedLogs: boolean };
  rules: {
    deadlineBeaten: number;
    deadlineMet: number;
    perHourSaved: number;
    perDayEarly: number;
    earlyCapPerProject: number;
    onTimeLog: number;
    deadlineMissed: number;
    perHourExceeded: number;
    perBacklogDay: number;
    perOutstandingDay: number;
  };
  athletes: AthleteRow[];
};

function isoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

const DEFAULT_TO = isoDate(new Date());
const DEFAULT_FROM = `${DEFAULT_TO.slice(0, 8)}01`;

const field = "select-console mt-1 block min-w-[11rem] rounded-md px-3 py-2 text-sm";
const dateField =
  "mt-1 block rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white";

function num(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function hours(value: number | null | undefined): string {
  const text = num(value);
  return text === "—" ? text : `${text}h`;
}

function signedHours(value: number): string {
  if (value > 0) return `+${num(value)}h`;
  if (value < 0) return `−${num(Math.abs(value))}h`;
  return "0h";
}

function percent(value: number | null): string {
  const text = num(value);
  return text === "—" ? text : `${text}%`;
}

function pointsText(value: number): string {
  if (value > 0) return `+${value}`;
  return String(value);
}

const OUTCOME_LABEL: Record<DeadlineRow["outcome"], string> = {
  beaten: "Beaten",
  met: "Met",
  missed: "Missed",
  hold: "On hold",
};

function BucketTable({ rows }: { rows: Bucket[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-slate-500">No finished projects in this view.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="text-[11px] uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-3 py-2 font-medium">Group</th>
            <th className="px-3 py-2 font-medium">Projects</th>
            <th className="px-3 py-2 font-medium">Avg hours</th>
            <th className="px-3 py-2 font-medium">Avg turnaround</th>
            <th className="px-3 py-2 font-medium">Allocated</th>
            <th className="px-3 py-2 font-medium">Actual</th>
            <th className="px-3 py-2 font-medium">Saved</th>
            <th className="px-3 py-2 font-medium">Exceeded</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-t border-white/[0.06]">
              <td className="px-3 py-2 text-slate-200">{row.label}</td>
              <td className="px-3 py-2 text-slate-300">{row.count}</td>
              <td className="px-3 py-2 text-slate-300">{hours(row.averageHours)}</td>
              <td className="px-3 py-2 text-slate-300">
                {row.averageTurnaroundDays == null ? "—" : `${num(row.averageTurnaroundDays)}d`}
              </td>
              <td className="px-3 py-2 text-slate-300">{hours(row.allocatedHours)}</td>
              <td className="px-3 py-2 text-slate-300">{hours(row.actualHours)}</td>
              <td className="px-3 py-2 text-slate-300">{hours(row.hoursSaved)}</td>
              <td className="px-3 py-2 text-slate-300">{hours(row.hoursExceeded)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3">
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-white">{value}</p>
    </div>
  );
}

export function AthletePerformanceClient() {
  const [clientId, setClientId] = useState("");
  const [stage, setStage] = useState("");
  const [complexity, setComplexity] = useState("");
  const [from, setFrom] = useState(DEFAULT_FROM);
  const [to, setTo] = useState(DEFAULT_TO);
  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/ops/clients")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((json) => {
        const list = (json.clients || []) as Array<{ id: string; name: string }>;
        setClients([...list].sort((a, b) => a.name.localeCompare(b.name)));
      })
      .catch(() => setClients([]));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (clientId) params.set("clientId", clientId);
    if (stage) params.set("stage", stage);
    if (complexity) params.set("complexity", complexity);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const query = params.toString();
    setLoading(true);
    setError("");
    fetch(`/api/ops/performance${query ? `?${query}` : ""}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Could not load athlete performance");
        return res.json() as Promise<Report>;
      })
      .then((json) => {
        setReport(json);
        setSelectedId((current) =>
          json.athletes.some((athlete) => athlete.athleteId === current)
            ? current
            : json.athletes[0]?.athleteId ?? ""
        );
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Could not load athlete performance");
      })
      .finally(() => setLoading(false));
  }, [clientId, stage, complexity, from, to]);

  const selected = useMemo(
    () => report?.athletes.find((athlete) => athlete.athleteId === selectedId) ?? null,
    [report, selectedId]
  );
  const filtering = Boolean(
    clientId || stage || complexity || from !== DEFAULT_FROM || to !== DEFAULT_TO
  );

  function choose(athleteId: string) {
    setSelectedId(athleteId);
    document.getElementById("athlete-breakdown")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="mt-6 space-y-8">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-slate-400">
          Client
          <select value={clientId} onChange={(event) => setClientId(event.target.value)} className={field}>
            <option value="">All clients</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-slate-400">
          Athlete
          <select
            value={selectedId}
            onChange={(event) => choose(event.target.value)}
            className={field}
          >
            {report?.athletes.length ? null : <option value="">No athletes</option>}
            {report?.athletes.map((athlete) => (
              <option key={athlete.athleteId} value={athlete.athleteId}>
                {athlete.athleteName} ({athlete.athleteCode})
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-slate-400">
          Project stage
          <select value={stage} onChange={(event) => setStage(event.target.value)} className={field}>
            <option value="">All stages</option>
            {OPS_PROJECT_STAGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value as OpsProjectPhase}>
                {option.label}
              </option>
            ))}
            <option value="custom">Custom package</option>
          </select>
        </label>
        <label className="text-xs text-slate-400">
          Complexity
          <select
            value={complexity}
            onChange={(event) => setComplexity(event.target.value)}
            className={field}
          >
            <option value="">All complexities</option>
            {(Object.keys(COMPLEXITY_LABELS) as OpsProjectComplexity[]).map((key) => (
              <option key={key} value={key}>
                {COMPLEXITY_LABELS[key]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-slate-400">
          From
          <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className={dateField} />
        </label>
        <label className="text-xs text-slate-400">
          To
          <input type="date" value={to} onChange={(event) => setTo(event.target.value)} className={dateField} />
        </label>
        {filtering ? (
          <button
            type="button"
            onClick={() => {
              setClientId("");
              setStage("");
              setComplexity("");
              setFrom(DEFAULT_FROM);
              setTo(DEFAULT_TO);
            }}
            className="rounded-lg border border-white/[0.1] px-3 py-2 text-sm text-slate-300"
          >
            Clear
          </button>
        ) : null}
      </div>

      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      {loading ? <p className="text-sm text-slate-400">{report ? "Updating…" : "Loading performance…"}</p> : null}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Leaderboard</h2>
        <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-white/[0.03] text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2 font-medium">Rank</th>
                <th className="px-3 py-2 font-medium">Athlete</th>
                <th className="px-3 py-2 font-medium">Projects</th>
                <th className="px-3 py-2 font-medium">Hours</th>
                <th className="px-3 py-2 font-medium">Saved</th>
                <th className="px-3 py-2 font-medium">Met</th>
                <th className="px-3 py-2 font-medium">Beaten</th>
                <th className="px-3 py-2 font-medium">Missed</th>
                <th className="px-3 py-2 font-medium">Early</th>
                <th className="px-3 py-2 font-medium">Log %</th>
                <th className="px-3 py-2 font-medium">Points</th>
              </tr>
            </thead>
            <tbody>
              {report?.athletes.map((athlete) => {
                const active = athlete.athleteId === selectedId;
                return (
                  <tr
                    key={athlete.athleteId}
                    className={`cursor-pointer border-t border-white/[0.06] ${active ? "bg-white/[0.06]" : "hover:bg-white/[0.03]"}`}
                    onClick={() => choose(athlete.athleteId)}
                  >
                    <td className="px-3 py-2 text-slate-400">{athlete.rank}</td>
                    <td className="px-3 py-2">
                      <span className="flex items-center gap-2">
                        <AthleteAvatar
                          name={athlete.athleteName}
                          photoUrl={athlete.profilePhotoUrl}
                          backgroundColor={athlete.profilePhotoBgColor}
                          textTone={asAvatarTextTone(athlete.profilePhotoTextTone)}
                          size={28}
                        />
                        <span>
                          <span className="block text-slate-100">{athlete.athleteName}</span>
                          <span className="block text-[11px] text-slate-500">{athlete.athleteCode}</span>
                        </span>
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-300">{athlete.projectsCompleted}</td>
                    <td className="px-3 py-2 text-slate-300">{hours(athlete.hoursWorked)}</td>
                    <td className="px-3 py-2 text-slate-300">
                      {signedHours(athlete.hoursSaved - athlete.hoursExceeded)}
                    </td>
                    <td className="px-3 py-2 text-slate-300">{athlete.deadlinesMet}</td>
                    <td className="px-3 py-2 text-slate-300">{athlete.deadlinesBeaten}</td>
                    <td className="px-3 py-2 text-slate-300">{athlete.deadlinesMissed}</td>
                    <td className="px-3 py-2 text-slate-300">{hours(athlete.hoursBeaten)}</td>
                    <td className="px-3 py-2 text-slate-300">{percent(athlete.logCompliance)}</td>
                    <td className="px-3 py-2 font-medium text-white">{athlete.points}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {report && report.athletes.length === 0 ? (
            <p className="px-3 py-6 text-sm text-slate-500">No athletes match these filters.</p>
          ) : null}
        </div>
      </section>

      {selected && report ? (
        <div id="athlete-breakdown" className="space-y-8">
          <div className="flex flex-wrap items-center gap-3">
            <AthleteAvatar
              name={selected.athleteName}
              photoUrl={selected.profilePhotoUrl}
              backgroundColor={selected.profilePhotoBgColor}
              textTone={asAvatarTextTone(selected.profilePhotoTextTone)}
              size={40}
            />
            <div>
              <h2 className="text-lg font-semibold text-white">{selected.athleteName}</h2>
              <p className="text-sm text-slate-400">
                Rank {selected.rank} · {selected.athleteCode} · {selected.points} points
              </p>
            </div>
          </div>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
              Project experience and efficiency
            </h3>
            <p className="max-w-3xl text-sm text-slate-400">
              Each finished project counts as one stage. Hours in the leaderboard are the hours this athlete logged in the date range. Allocated against actual uses the full hours logged on each finished project they own.
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Projects finished" value={String(selected.projectsCompleted)} />
              <Stat label="Hours worked" value={hours(selected.hoursWorked)} />
              <Stat label="Allocated" value={hours(selected.allocatedHours)} />
              <Stat label="Actual on those jobs" value={hours(selected.actualHours)} />
              <Stat label="Hours saved" value={hours(selected.hoursSaved)} />
              <Stat label="Hours exceeded" value={hours(selected.hoursExceeded)} />
              <Stat
                label="Avg turnaround"
                value={selected.averageTurnaroundDays == null ? "—" : `${num(selected.averageTurnaroundDays)} days`}
              />
            </div>
            <h4 className="pt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">By stage</h4>
            <BucketTable rows={selected.stages} />
            <h4 className="pt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">By complexity</h4>
            <BucketTable rows={selected.complexities} />
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Deadline performance</h3>
            <p className="max-w-3xl text-sm text-slate-400">
              Scores use the current athlete deadline, including any extension saved on the project. Waiting on feedback and blocked projects stay off the missed list while that status lasts.
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Met" value={String(selected.deadlinesMet)} />
              <Stat label="Beaten" value={String(selected.deadlinesBeaten)} />
              <Stat label="Missed" value={String(selected.deadlinesMissed)} />
              <Stat label="Success rate" value={percent(selected.deadlineSuccessRate)} />
              <Stat label="Hours early" value={hours(selected.hoursBeaten)} />
              <Stat label="Average early" value={hours(selected.averageHoursBeaten)} />
              <Stat label="Hours overdue" value={hours(selected.hoursOverdue)} />
              <Stat label="On hold" value={String(selected.holds)} />
            </div>
            {selected.deadlines.length > 0 ? (
              <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
                <table className="min-w-full text-left text-sm">
                  <thead className="text-[11px] uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-2 font-medium">Project</th>
                      <th className="px-3 py-2 font-medium">Stage</th>
                      <th className="px-3 py-2 font-medium">Complexity</th>
                      <th className="px-3 py-2 font-medium">Result</th>
                      <th className="px-3 py-2 font-medium">Hours</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.deadlines.map((deadline) => (
                      <tr key={`${deadline.projectId}-${deadline.outcome}`} className="border-t border-white/[0.06]">
                        <td className="px-3 py-2">
                          <span className="block text-slate-200">{deadline.name}</span>
                          <span className="block text-[11px] text-slate-500">{deadline.clientName}</span>
                        </td>
                        <td className="px-3 py-2 text-slate-300">{deadline.stageLabel}</td>
                        <td className="px-3 py-2 text-slate-400">{deadline.complexityLabel}</td>
                        <td className="px-3 py-2 text-slate-300">{OUTCOME_LABEL[deadline.outcome]}</td>
                        <td className="px-3 py-2 text-slate-300">
                          {deadline.hoursDelta == null
                            ? "—"
                            : deadline.hoursDelta > 0
                              ? `${num(deadline.hoursDelta)}h early`
                              : deadline.hoursDelta < 0
                                ? `${num(Math.abs(deadline.hoursDelta))}h over`
                                : "On the day"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {selected.deadlinesTruncated ? (
                  <p className="px-3 py-2 text-xs text-slate-500">Showing the latest 40 deadline results.</p>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No deadline results in this view.</p>
            )}
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Daily log performance</h3>
            <p className="max-w-3xl text-sm text-slate-400">
              A log is on time when it is submitted on the calendar day it records, in South Africa time. Later submissions count as backlogged by the number of days between those two dates. Weekends are skipped.
              {report.filters.scopedLogs
                ? " This filtered view only counts logs that include the selected work, so days with no log are left out."
                : " Weekdays with no log count as outstanding. The console has no leave calendar, so an approved day off still counts as outstanding."}
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="On time" value={String(selected.logsOnTime)} />
              <Stat label="Backlogged" value={String(selected.logsBacklogged)} />
              <Stat label="Days backlogged" value={String(selected.daysBacklogged)} />
              <Stat label="Outstanding days" value={String(selected.outstandingDays)} />
              <Stat label="Compliance" value={percent(selected.logCompliance)} />
              <Stat label="Current streak" value={`${selected.streak} days`} />
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Performance points</h3>
            <p className="max-w-3xl text-sm text-slate-400">
              Beating a deadline is {report.rules.deadlineBeaten} points, meeting one is {report.rules.deadlineMet}, and each hour saved is {report.rules.perHourSaved}. Each full day early adds {report.rules.perDayEarly} point, up to {report.rules.earlyCapPerProject} on a project. An on-time log is {report.rules.onTimeLog}. A missed deadline is {report.rules.deadlineMissed}, each hour over the quote is {report.rules.perHourExceeded}, and each backlogged or outstanding day is {report.rules.perBacklogDay}.
            </p>
            <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {(
                [
                  ["Deadlines beaten", selected.pointsBreakdown.beaten],
                  ["Deadlines met", selected.pointsBreakdown.met],
                  ["Hours saved", selected.pointsBreakdown.saved],
                  ["Days early", selected.pointsBreakdown.early],
                  ["Logs on time", selected.pointsBreakdown.onTime],
                  ["Deadlines missed", selected.pointsBreakdown.missed],
                  ["Hours exceeded", selected.pointsBreakdown.exceeded],
                  ["Days backlogged", selected.pointsBreakdown.backlog],
                  ["Days outstanding", selected.pointsBreakdown.outstanding],
                ] as Array<[string, number]>
              ).map(([label, value]) => (
                <div key={label} className="flex items-center justify-between rounded-lg border border-white/[0.06] px-3 py-2">
                  <dt className="text-sm text-slate-400">{label}</dt>
                  <dd className={`text-sm font-medium ${value > 0 ? "text-emerald-300" : value < 0 ? "text-red-300" : "text-slate-400"}`}>
                    {pointsText(value)}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      ) : null}
    </div>
  );
}
