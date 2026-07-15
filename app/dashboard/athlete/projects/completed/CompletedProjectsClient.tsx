"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArchiveProjectDetailPanel } from "@/components/ops/ArchiveProjectDetailPanel";
import {
  ArchivedProjectsByClient,
  type ArchivedProjectRow,
} from "@/components/ops/ArchivedProjectsByClient";
import { ClientAvatar } from "@/components/ops/ClientAvatar";
import { asAvatarTextTone } from "@/lib/avatar-text-tone";

export function CompletedProjectsClient() {
  const [projects, setProjects] = useState<ArchivedProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [clientFilterId, setClientFilterId] = useState("");
  const [detailProjectId, setDetailProjectId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch("/api/athlete/projects/completed");
    const j = await r.json();
    if (r.ok) setProjects(j.projects || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const clientOptions = useMemo(() => {
    const map = new Map<
      string,
      {
        id: string;
        name: string;
        logoUrl: string | null;
        logoBgColor: string | null;
        logoTextTone: string | null;
      }
    >();
    for (const p of projects) {
      if (!map.has(p.clientId)) {
        map.set(p.clientId, {
          id: p.clientId,
          name: p.clientName,
          logoUrl: p.clientLogoUrl,
          logoBgColor: p.clientLogoBgColor,
          logoTextTone: p.clientLogoTextTone,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [projects]);

  const filteredProjects = useMemo(() => {
    if (!clientFilterId) return projects;
    return projects.filter((p) => p.clientId === clientFilterId);
  }, [projects, clientFilterId]);

  const selectedFilterClient = clientOptions.find((c) => c.id === clientFilterId) ?? null;

  async function reactivate(project: { id: string; name: string; displayTitle?: string }) {
    const label = project.displayTitle ?? project.name;
    if (
      !window.confirm(
        `Move "${label}" back to My Projects? Progress will reset from 100% to 90% so you can keep logging daily work.`
      )
    ) {
      return;
    }
    setBusyId(project.id);
    setMsg("");
    try {
      const r = await fetch(`/api/athlete/projects/${encodeURIComponent(project.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentStatus: "in_progress" }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        window.alert((j as { error?: string }).error || "Could not reactivate project");
        return;
      }
      setMsg(`"${label}" is active again in My Projects.`);
      await load();
    } finally {
      setBusyId(null);
    }
  }

  if (loading && projects.length === 0) {
    return <p className="text-sm text-slate-500">Loading completed projects…</p>;
  }

  if (!loading && projects.length === 0 && !clientFilterId) {
    return (
      <p className="text-sm text-slate-500">
        No completed projects yet. When a project reaches 100% in the Daily Log, it appears here
        automatically.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4">
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
        {selectedFilterClient ? (
          <p className="flex items-center gap-2 pb-2 text-xs text-slate-400">
            <ClientAvatar
              name={selectedFilterClient.name}
              logoUrl={selectedFilterClient.logoUrl}
              backgroundColor={selectedFilterClient.logoBgColor}
              textTone={asAvatarTextTone(selectedFilterClient.logoTextTone)}
              size={22}
            />
            Filtering to {selectedFilterClient.name}
          </p>
        ) : null}
        {loading ? <p className="pb-2 text-xs text-slate-500">Refreshing…</p> : null}
      </div>

      {msg ? <p className="text-sm text-brand-300">{msg}</p> : null}

      <ArchivedProjectsByClient
        projects={filteredProjects}
        showAssignedAthlete={false}
        onOpen={setDetailProjectId}
        onReactivate={reactivate}
        reactivatingId={busyId}
        emptyMessage={
          clientFilterId
            ? "No completed projects for this client."
            : "No completed projects match these filters."
        }
        clientGroupLabel="completed project"
      />

      {detailProjectId ? (
        <ArchiveProjectDetailPanel
          projectId={detailProjectId}
          detailPath="/api/athlete/projects"
          showOpsEditHint={false}
          onClose={() => setDetailProjectId(null)}
        />
      ) : null}
    </div>
  );
}
