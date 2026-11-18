"use client";

import { useEffect, useMemo, useState } from "react";
import { parseClientDeliverables, type ClientPortalDeliverable } from "@/lib/client-portal-deliverables";

type ClientOption = {
  id: string;
  name: string;
};

type ProjectRow = {
  id: string;
  clientId: string;
  name: string;
  address: string | null;
  currentStatus: string;
  completedAt: string | null;
  clientDeliverables: unknown;
};

type Draft = {
  links: ClientPortalDeliverable[];
  saving: boolean;
  message: string;
  error: string;
};

function isCompleted(status: string): boolean {
  return status === "completed" || status === "handed_over";
}

export function ProjectLinksPageClient({ initialClientId = "" }: { initialClientId?: string }) {
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [clientId, setClientId] = useState(initialClientId);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void Promise.all([
      fetch("/api/ops/clients").then((response) => response.json()),
      fetch("/api/ops/projects?scope=all").then((response) => response.json()),
    ])
      .then(([clientsPayload, projectsPayload]) => {
        const clientRows = (clientsPayload.clients ?? []) as ClientOption[];
        const projectRows = (projectsPayload.projects ?? []) as ProjectRow[];
        setClients(clientRows);
        setProjects(projectRows);
        setClientId((current) => {
          if (current && clientRows.some((client) => client.id === current)) return current;
          return clientRows[0]?.id ?? "";
        });
        setDrafts(
          Object.fromEntries(
            projectRows.map((project) => [
              project.id,
              {
                links: parseClientDeliverables(project.clientDeliverables),
                saving: false,
                message: "",
                error: "",
              },
            ]),
          ),
        );
        if (!clientsPayload.clients) setError(clientsPayload.error || "Could not load clients.");
        else if (!projectsPayload.projects) setError(projectsPayload.error || "Could not load projects.");
      })
      .catch(() => setError("Could not load projects."))
      .finally(() => setLoading(false));
  }, []);

  const visibleProjects = useMemo(() => {
    return projects
      .filter((project) => project.clientId === clientId)
      .sort((a, b) => {
        const aDone = isCompleted(a.currentStatus);
        const bDone = isCompleted(b.currentStatus);
        if (aDone !== bDone) return aDone ? 1 : -1;
        if (aDone && bDone) {
          const aTime = a.completedAt ? new Date(a.completedAt).getTime() : 0;
          const bTime = b.completedAt ? new Date(b.completedAt).getTime() : 0;
          if (aTime !== bTime) return bTime - aTime;
        }
        return a.name.localeCompare(b.name);
      });
  }, [projects, clientId]);

  function updateDraft(projectId: string, patch: Partial<Draft>) {
    setDrafts((current) => ({
      ...current,
      [projectId]: { ...current[projectId]!, ...patch },
    }));
  }

  async function save(projectId: string) {
    const draft = drafts[projectId];
    if (!draft) return;
    updateDraft(projectId, { saving: true, message: "", error: "" });
    const links = draft.links
      .map((link) => {
        const url = link.url?.trim() || null;
        const label = link.label.trim() || (url ? "Zoom" : "");
        return { label, url };
      })
      .filter((link) => link.label);
    const response = await fetch(`/api/ops/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientDeliverables: links }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      updateDraft(projectId, { saving: false, error: payload.error || "Could not save links." });
      return;
    }
    updateDraft(projectId, { saving: false, links, message: "Saved." });
  }

  return (
    <div className="max-w-3xl space-y-4">
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      <label className="block text-xs text-slate-400">
        Client
        <select
          value={clientId}
          onChange={(event) => setClientId(event.target.value)}
          disabled={loading || clients.length === 0}
          className="select-console mt-1 block w-full max-w-md rounded-md px-3 py-2 text-sm"
        >
          {clients.length === 0 ? <option value="">No clients yet</option> : null}
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </select>
      </label>
      {loading ? <p className="text-sm text-slate-500">Loading projects…</p> : null}
      {!loading && visibleProjects.length === 0 ? (
        <p className="text-sm text-slate-500">This client has no projects yet.</p>
      ) : null}
      {visibleProjects.map((project) => {
        const draft = drafts[project.id] ?? { links: [], saving: false, message: "", error: "" };
        return (
          <section key={project.id} className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
            <h2 className="font-semibold text-white">{project.name}</h2>
            {project.address ? <p className="mt-0.5 text-xs text-slate-500">{project.address}</p> : null}
            <ul className="mt-3 space-y-2">
              {draft.links.map((link, index) => (
                <li key={index} className="flex flex-wrap gap-2">
                  <input
                    value={link.label}
                    onChange={(event) => {
                      const next = [...draft.links];
                      next[index] = { ...next[index]!, label: event.target.value };
                      updateDraft(project.id, { links: next, message: "" });
                    }}
                    placeholder="Dedicated Zoom link"
                    className="min-w-[10rem] flex-1 rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
                  />
                  <input
                    value={link.url ?? ""}
                    onChange={(event) => {
                      const next = [...draft.links];
                      next[index] = { ...next[index]!, url: event.target.value || null };
                      updateDraft(project.id, { links: next, message: "" });
                    }}
                    placeholder="https://zoom.us/…"
                    className="min-w-[12rem] flex-[2] rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      updateDraft(project.id, {
                        links: draft.links.filter((_, item) => item !== index),
                        message: "",
                      })
                    }
                    className="text-xs text-red-400 hover:underline"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  updateDraft(project.id, {
                    links: [...draft.links, { label: "", url: null }],
                    message: "",
                  })
                }
                className="text-xs font-medium text-brand-300 hover:text-brand-200"
              >
                + Add link
              </button>
              <button
                type="button"
                onClick={() => void save(project.id)}
                disabled={draft.saving}
                className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-slate-950 disabled:opacity-60"
              >
                {draft.saving ? "Saving…" : "Save"}
              </button>
              {draft.message ? <span className="text-xs text-emerald-300">{draft.message}</span> : null}
              {draft.error ? <span className="text-xs text-red-300">{draft.error}</span> : null}
            </div>
          </section>
        );
      })}
    </div>
  );
}
