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

      <ArchivedProjectsByClient
        projects={filteredProjects}
        showAssignedAthlete={false}
        onOpen={setDetailProjectId}
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
