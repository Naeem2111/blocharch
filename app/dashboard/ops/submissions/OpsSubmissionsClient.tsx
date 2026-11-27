"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AthleteAvatar } from "@/components/ops/AthleteAvatar";
import { ClientAvatar } from "@/components/ops/ClientAvatar";
import { asAvatarTextTone } from "@/lib/avatar-text-tone";
import { PROJECT_PHASE_LABELS } from "@/lib/ops-constants";
import { formatTaskTypesDisplay } from "@/lib/ops-daily-form";
import { useOpsCatalog } from "@/lib/use-ops-catalog";
import { catalogOptionLabel } from "@/lib/ops-catalog-types";

type LineItem = {
  projectName: string;
  clientName: string;
  clientLogoUrl: string | null;
  clientLogoBgColor: string | null;
  clientLogoTextTone: string | null;
  projectPhase: string;
  taskType: string;
  taskTypes?: string[];
  hoursWorked: number;
  completionPercent: number | null;
  blockerFlag: boolean;
  blockerNote: string | null;
  completedSummary: string | null;
  notes: string | null;
};

type Submission = {
  id: string;
  athleteName: string;
  athleteCode: string;
  profilePhotoUrl: string | null;
  profilePhotoBgColor: string | null;
  profilePhotoTextTone: string | null;
  submissionDate: string;
  totalHours: number;
  checkInRequested: boolean;
  checkInNeedsAction: boolean;
  dailyNote: string | null;
  lockedAt: string | null;
  lineItems: LineItem[];
};

type FilterClient = { id: string; name: string };
type FilterAthlete = { id: string; fullName: string; athleteCode: string };
type FilterProject = {
  id: string;
  name: string;
  clientId: string;
  projectNumber: string;
  completedAt: string | null;
};

function byLatestCompleted(a: FilterProject, b: FilterProject): number {
  if (a.completedAt && b.completedAt) {
    const byDate = b.completedAt.localeCompare(a.completedAt);
    if (byDate !== 0) return byDate;
  } else if (a.completedAt) {
    return -1;
  } else if (b.completedAt) {
    return 1;
  }
  return a.name.localeCompare(b.name);
}

const field = "select-console mt-1 block min-w-[12rem] rounded-md px-3 py-2 text-sm";

function taskTypeLabel(
  li: LineItem,
  workTypes: { value: string; label: string }[],
): string {
  return formatTaskTypesDisplay(li.taskType, li.taskTypes, workTypes);
}

export function OpsSubmissionsClient() {
  const { phases, workTypes } = useOpsCatalog();
  const [rows, setRows] = useState<Submission[]>([]);
  const [clients, setClients] = useState<FilterClient[]>([]);
  const [athletes, setAthletes] = useState<FilterAthlete[]>([]);
  const [projects, setProjects] = useState<FilterProject[]>([]);
  const [clientId, setClientId] = useState("");
  const [athleteId, setAthleteId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [pendingCheckIns, setPendingCheckIns] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(searchInput.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    void Promise.all([
      fetch("/api/ops/clients"),
      fetch("/api/ops/athletes"),
      fetch("/api/ops/projects?scope=all"),
    ]).then(async ([clientsRes, athletesRes, projectsRes]) => {
      const clientsJson = await clientsRes.json().catch(() => ({}));
      const athletesJson = await athletesRes.json().catch(() => ({}));
      const projectsJson = await projectsRes.json().catch(() => ({}));
      if (clientsRes.ok) {
        setClients(
          (clientsJson.clients || [])
            .map((client: { id: string; name: string }) => ({ id: client.id, name: client.name }))
            .sort((a: FilterClient, b: FilterClient) => a.name.localeCompare(b.name)),
        );
      }
      if (athletesRes.ok) {
        setAthletes(
          (athletesJson.athletes || [])
            .map((athlete: { id: string; fullName: string; athleteCode: string }) => ({
              id: athlete.id,
              fullName: athlete.fullName,
              athleteCode: athlete.athleteCode,
            }))
            .sort((a: FilterAthlete, b: FilterAthlete) => a.fullName.localeCompare(b.fullName)),
        );
      }
      if (projectsRes.ok) {
        setProjects(
          (projectsJson.projects || [])
            .map((project: { id: string; name: string; clientId: string; projectNumber?: string; completedAt?: string | null }) => ({
              id: project.id,
              name: project.name,
              clientId: project.clientId,
              projectNumber: project.projectNumber || "",
              completedAt: project.completedAt ?? null,
            }))
            .sort(byLatestCompleted),
        );
      }
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    const filtering = Boolean(clientId || athleteId || projectId || query);
    params.set("limit", filtering ? "500" : "200");
    if (clientId) params.set("clientId", clientId);
    if (athleteId) params.set("athleteId", athleteId);
    if (projectId) params.set("projectId", projectId);
    if (query) params.set("q", query);
    const [sr, br] = await Promise.all([
      fetch(`/api/ops/submissions?${params.toString()}`),
      fetch("/api/ops/sidebar-badges"),
    ]);
    const j = await sr.json();
    const bj = await br.json().catch(() => ({}));
    if (!sr.ok) {
      setError(j.error || "Failed to load");
      setLoading(false);
      setReady(true);
      return;
    }
    setRows(j.submissions || []);
    setPendingCheckIns(bj.checkIns ?? 0);
    setError("");
    setLoading(false);
    setReady(true);
  }, [athleteId, clientId, projectId, query]);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 60_000);
    return () => clearInterval(t);
  }, [load]);

  const projectOptions = useMemo(
    () => projects.filter((project) => !clientId || project.clientId === clientId),
    [projects, clientId],
  );
  const filtering = Boolean(clientId || athleteId || projectId || query);

  if (!ready && loading) return <p className="text-sm text-slate-500">Loading submissions…</p>;
  if (error && rows.length === 0) return <p className="text-sm text-red-400">{error}</p>;

  const actionCount = rows.filter((s) => s.checkInNeedsAction).length;

  return (
    <div className="space-y-4">
      {pendingCheckIns > 0 ? (
        <div
          className="ops-alert-banner animate-pulse rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 ring-1 ring-red-500/35"
          role="status"
        >
          <p className="text-sm font-semibold text-red-100">
            {pendingCheckIns} check-in request{pendingCheckIns === 1 ? "" : "s"} need action
          </p>
          <p className="mt-1 text-xs text-red-200/90">
            {actionCount > 0
              ? `${actionCount} submission${actionCount === 1 ? "" : "s"} below flagged in red.`
              : "Open Check-in requests to schedule or respond."}{" "}
            <Link href="/dashboard/ops/check-ins" className="font-medium underline hover:text-red-100">
              Go to Check-in requests →
            </Link>
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-[16rem] flex-1 text-xs text-slate-400">
          Search
          <input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Athlete, client, project, notes…"
            className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
          />
        </label>
        <label className="text-xs text-slate-400">
          Client
          <select
            value={clientId}
            onChange={(event) => {
              const next = event.target.value;
              setClientId(next);
              setProjectId((current) => {
                if (!next || !current) return current;
                const project = projects.find((item) => item.id === current);
                return project && project.clientId !== next ? "" : current;
              });
            }}
            className={field}
          >
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
          <select value={athleteId} onChange={(event) => setAthleteId(event.target.value)} className={field}>
            <option value="">All athletes</option>
            {athletes.map((athlete) => (
              <option key={athlete.id} value={athlete.id}>
                {athlete.fullName} ({athlete.athleteCode})
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-slate-400">
          Project
          <select value={projectId} onChange={(event) => setProjectId(event.target.value)} className={field}>
            <option value="">All projects</option>
            {projectOptions.map((project) => (
              <option key={project.id} value={project.id}>
                {project.projectNumber ? `${project.projectNumber} · ` : ""}
                {project.name}
              </option>
            ))}
          </select>
        </label>
        {filtering ? (
          <button
            type="button"
            onClick={() => {
              setClientId("");
              setAthleteId("");
              setProjectId("");
              setSearchInput("");
              setQuery("");
            }}
            className="rounded-lg border border-white/[0.1] px-3 py-2 text-sm text-slate-300"
          >
            Clear
          </button>
        ) : null}
      </div>
      <p className="text-sm text-slate-400">
        {loading
          ? "Loading…"
          : `${rows.length} submission${rows.length === 1 ? "" : "s"}${filtering ? (rows.length === 1 ? " matches" : " match") : ""}`}
      </p>
      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      {rows.length === 0 && !loading ? (
        <p className="text-sm text-slate-500">
          {filtering ? "No daily submissions match these filters." : "No daily submissions logged yet."}
        </p>
      ) : (
        rows.map((s) => (
          <article
            key={s.id}
            className={`rounded-xl p-5 ${
              s.checkInNeedsAction
                ? "ops-checkin-alert animate-pulse border border-red-500/40 bg-red-500/[0.06] ring-1 ring-red-500/35"
                : "card-tool"
            }`}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div className="flex items-center gap-3">
                <AthleteAvatar
                  name={s.athleteName}
                  photoUrl={s.profilePhotoUrl}
                  backgroundColor={s.profilePhotoBgColor}
                  textTone={asAvatarTextTone(s.profilePhotoTextTone)}
                  size={36}
                />
                <div>
                <h2 className="text-sm font-semibold text-white">
                  {s.athleteName}{" "}
                  <span className="font-normal text-slate-500">({s.athleteCode})</span>
                </h2>
                <p className="text-xs text-slate-500">{s.submissionDate}</p>
                </div>
              </div>
              <p className="text-sm font-medium tabular-nums text-brand-300">{s.totalHours.toFixed(2)}h total</p>
            </div>
            {s.checkInNeedsAction ? (
              <p className="ops-checkin-alert-text mt-2 text-xs font-semibold text-red-200">
                Check-in requested — action required in{" "}
                <Link href="/dashboard/ops/check-ins" className="underline hover:text-red-100">
                  Check-in requests
                </Link>
              </p>
            ) : s.checkInRequested ? (
              <p className="mt-2 text-xs text-slate-500">Check-in requested (scheduled)</p>
            ) : null}
            {s.dailyNote ? <p className="mt-2 text-sm text-slate-400">{s.dailyNote}</p> : null}
            <ul className="mt-4 space-y-3 border-t border-white/[0.06] pt-4">
              {s.lineItems.map((li, i) => {
                const types = li.taskTypes?.length ? li.taskTypes : [li.taskType];
                const hasOther = types.includes("other");
                return (
                <li key={i} className="text-sm">
                  <p className="flex flex-wrap items-center gap-2 font-medium text-slate-200">
                    <ClientAvatar
                      name={li.clientName}
                      logoUrl={li.clientLogoUrl}
                      backgroundColor={li.clientLogoBgColor}
                      textTone={asAvatarTextTone(li.clientLogoTextTone)}
                      size={22}
                    />
                    <span>{li.clientName}</span>
                    <span className="text-slate-500">—</span>
                    <span>{li.projectName}</span>
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {catalogOptionLabel(
                      li.projectPhase,
                      phases,
                      PROJECT_PHASE_LABELS[li.projectPhase as keyof typeof PROJECT_PHASE_LABELS],
                    )}{" "}
                    · {taskTypeLabel(li, workTypes)} · {li.hoursWorked}h
                    {li.completionPercent != null ? ` · ${li.completionPercent}% progress` : ""}
                  </p>
                  {hasOther && li.notes ? (
                    <p className="ops-other-note mt-1 text-xs text-brand-200/90">
                      Other: {li.notes}
                    </p>
                  ) : hasOther ? (
                    <p className="ops-warning-text mt-1 text-xs text-amber-300">Other task type — no explanation provided</p>
                  ) : null}
                  {li.completedSummary ? (
                    <p className="mt-1 text-xs text-slate-400">{li.completedSummary}</p>
                  ) : null}
                  {li.blockerFlag ? (
                    <p className="ops-blocker-text mt-1 text-xs text-red-300">
                      Blocker{li.blockerNote ? `: ${li.blockerNote}` : ""}
                    </p>
                  ) : null}
                </li>
                );
              })}
            </ul>
          </article>
        ))
      )}
    </div>
  );
}

