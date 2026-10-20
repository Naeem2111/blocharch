"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ClientAvatar } from "@/components/ops/ClientAvatar";
import { DueDateCalendar } from "@/components/ops/DueDateCalendar";
import { OpsProjectCardBody, OpsProjectCardFrame } from "@/components/ops/OpsProjectCard";
import { asAvatarTextTone } from "@/lib/avatar-text-tone";
import {
  COMPLEXITY_LABELS,
  PROJECT_STATUS_LABELS,
  projectStageSelectValue,
} from "@/lib/ops-constants";
import { catalogValueFromId } from "@/lib/ops-catalog-types";
import { useOpsCatalog } from "@/lib/use-ops-catalog";
import type { OpsProjectPhase } from "@prisma/client";
import { formatProjectFullTitle } from "@/lib/project-display";
import { clientMetaFromNestedClient, groupProjectsByClient } from "@/lib/ops-project-groups";

type ProjectClient = {
  id: string;
  name: string;
  logoUrl: string | null;
  logoBgColor: string | null;
  logoTextTone: string | null;
};

type AssignedAthlete = {
  athleteId: string;
  fullName: string;
  athleteCode: string;
  isPrimary: boolean;
};

type ProjectRow = {
  id: string;
  name: string;
  displayTitle?: string;
  projectNumber: string;
  address: string | null;
  complexity: keyof typeof COMPLEXITY_LABELS;
  currentStage: OpsProjectPhase;
  customStageId?: string | null;
  stageLabel?: string;
  currentStatus: keyof typeof PROJECT_STATUS_LABELS;
  startDate: string | null;
  dueDate: string | null;
  dueAt?: string | null;
  progressPercent: number | null;
  notes: string | null;
  laneNumber?: number | null;
  hoursLogged?: number;
  quotedHours?: number | null;
  assignedAthletes?: AssignedAthlete[];
  assignedAthleteId?: string | null;
  assignedAthleteName?: string | null;
  athleteCode?: string | null;
  client: ProjectClient;
};

export function AthleteProjectsClient() {
  const { phases } = useOpsCatalog();
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ currentStage: "", currentStatus: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [calendarMonth, setCalendarMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [clientFilterId, setClientFilterId] = useState("");

  const load = useCallback(async () => {
    const r = await fetch("/api/athlete/projects");
    const j = await r.json();
    if (r.ok) setProjects(j.projects || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const clientOptions = useMemo(() => {
    const map = new Map<string, ProjectClient>();
    for (const p of projects) {
      if (!map.has(p.client.id)) map.set(p.client.id, p.client);
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [projects]);

  const filteredProjects = useMemo(() => {
    if (!clientFilterId) return projects;
    return projects.filter((p) => p.client.id === clientFilterId);
  }, [projects, clientFilterId]);

  const calendarProjects = useMemo(
    () =>
      filteredProjects
        .filter((p) => p.dueDate)
        .map((p) => ({
          id: p.id,
          name: p.displayTitle ?? formatProjectFullTitle(p.name, p.currentStage),
          clientName: p.client.name,
          clientLogoUrl: p.client.logoUrl,
          clientLogoBgColor: p.client.logoBgColor,
          clientLogoTextTone: p.client.logoTextTone,
          dueDate: p.dueDate!,
          dueAt: p.dueAt,
          progressPercent: p.progressPercent ?? 0,
          assignedAthleteName: p.assignedAthleteName ?? null,
        })),
    [filteredProjects]
  );

  const projectsByClient = useMemo(
    () => groupProjectsByClient(filteredProjects, (p) => clientMetaFromNestedClient(p.client)),
    [filteredProjects]
  );

  const selectedFilterClient = clientOptions.find((c) => c.id === clientFilterId) ?? null;

  function startEdit(p: ProjectRow) {
    setEditingId(p.id);
    setForm({
      currentStage: p.customStageId ? catalogValueFromId(p.customStageId) : p.currentStage,
      currentStatus: p.currentStatus,
      notes: p.notes ?? "",
    });
    setError("");
    setMsg("");
  }

  async function saveEdit(projectId: string) {
    setSaving(true);
    setError("");
    setMsg("");
    const r = await fetch(`/api/athlete/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const j = await r.json();
    setSaving(false);
    if (!r.ok) {
      setError(j.error || "Could not save");
      return;
    }
    setEditingId(null);
    setMsg("Project updated.");
    void load();
  }

  if (loading) return <p className="text-sm text-slate-500">Loading projects…</p>;

  return (
    <div className="space-y-6">
      <div className="card-tool rounded-xl p-5 md:p-6">
        <h2 className="text-base font-semibold text-white">Due date calendar</h2>
        <p className="mt-1.5 text-sm text-slate-500">
          Active projects with due dates — browse by month. Respects the client filter below.
        </p>
        <div className="mt-5">
          <label className="mb-4 block text-xs text-slate-400">
            Calendar month
            <input
              type="month"
              value={calendarMonth}
              onChange={(e) => setCalendarMonth(e.target.value)}
              className="mt-1 block rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
            />
          </label>
          <DueDateCalendar month={calendarMonth} projects={calendarProjects} />
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap items-end gap-4">
          <p className="pb-2 text-sm text-slate-400">
            {filteredProjects.length} project{filteredProjects.length === 1 ? "" : "s"}
            {clientFilterId
              ? ` for ${selectedFilterClient?.name ?? "client"}`
              : clientOptions.length > 0
                ? ` · ${projectsByClient.length} client${projectsByClient.length === 1 ? "" : "s"}`
                : ""}
          </p>
          {clientOptions.length > 0 ? (
            <label className="text-xs text-slate-400">
              Client / firm
              <select
                value={clientFilterId}
                onChange={(e) => setClientFilterId(e.target.value)}
                className="select-console mt-1 block min-w-[14rem] rounded-md px-3 py-2 text-sm"
              >
                <option value="">All clients</option>
                {clientOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {selectedFilterClient ? (
            <p className="flex items-center gap-2 pb-2 text-xs text-slate-400">
              <ClientAvatar
                name={selectedFilterClient.name}
                logoUrl={selectedFilterClient.logoUrl}
                backgroundColor={selectedFilterClient.logoBgColor}
                textTone={asAvatarTextTone(selectedFilterClient.logoTextTone)}
                size={22}
              />
              Showing {selectedFilterClient.name} only
            </p>
          ) : null}
        </div>
        {msg ? <p className="text-sm text-brand-300">{msg}</p> : null}
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        <div className="space-y-8">
          {projectsByClient.map((group) => (
            <section key={group.clientId} className="space-y-3">
              <div className="flex flex-wrap items-center gap-3 border-b border-white/[0.06] pb-2">
                <ClientAvatar
                  name={group.clientName}
                  logoUrl={group.clientLogoUrl}
                  backgroundColor={group.clientLogoBgColor}
                  textTone={asAvatarTextTone(group.clientLogoTextTone)}
                  size={36}
                />
                <div>
                  <h2 className="text-sm font-semibold text-white">{group.clientName}</h2>
                  <p className="text-xs text-slate-500">
                    {group.projects.length} project{group.projects.length === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
              <div className="space-y-3">
                {group.projects.map((p) => (
                  <OpsProjectCardFrame key={p.id} dueDate={p.dueDate} dueAt={p.dueAt}>
                    {editingId === p.id ? (
                      <div className="grid gap-3 md:grid-cols-2">
                        <label className="text-xs text-slate-400">
                          Stage
                          <select
                            value={
                              form.currentStage.startsWith("custom:")
                                ? form.currentStage
                                : projectStageSelectValue(form.currentStage as OpsProjectPhase)
                            }
                            onChange={(e) => setForm((f) => ({ ...f, currentStage: e.target.value }))}
                            className="select-console mt-1 block w-full rounded-md px-3 py-2 text-sm"
                          >
                            {phases.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="text-xs text-slate-400">
                          Status
                          <select
                            value={form.currentStatus}
                            onChange={(e) => setForm((f) => ({ ...f, currentStatus: e.target.value }))}
                            className="select-console mt-1 block w-full rounded-md px-3 py-2 text-sm"
                          >
                            {Object.entries(PROJECT_STATUS_LABELS).map(([k, label]) => (
                              <option key={k} value={k}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="text-xs text-slate-400 md:col-span-2">
                          Notes
                          <textarea
                            value={form.notes}
                            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                            rows={3}
                            className="mt-1 block w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
                          />
                        </label>
                        <div className="flex gap-2 md:col-span-2">
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => void saveEdit(p.id)}
                            className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-brand-500 disabled:opacity-50"
                          >
                            {saving ? "Saving…" : "Save"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="rounded-lg px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <OpsProjectCardBody project={p} onEdit={() => startEdit(p)} />
                        {p.notes ? (
                          <p className="mt-3 pl-1 text-sm text-slate-400">
                            <span className="text-slate-500">Notes: </span>
                            {p.notes}
                          </p>
                        ) : null}
                      </>
                    )}
                  </OpsProjectCardFrame>
                ))}
              </div>
            </section>
          ))}
          {filteredProjects.length === 0 ? (
            <p className="text-sm text-slate-500">
              {clientFilterId
                ? "No projects for this client."
                : "No projects assigned yet. Ask your admin to assign projects to you."}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
