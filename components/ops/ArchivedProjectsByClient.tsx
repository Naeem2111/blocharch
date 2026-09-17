"use client";

import { AthleteAvatar } from "@/components/ops/AthleteAvatar";
import { ClientAvatar } from "@/components/ops/ClientAvatar";
import { ComplexityBadge } from "@/components/ops/ComplexityBadge";
import { asAvatarTextTone } from "@/lib/avatar-text-tone";
import {
  COMPLEXITY_LABELS,
  PROJECT_STATUS_LABELS,
} from "@/lib/ops-constants";
import { groupProjectsByClient } from "@/lib/ops-project-groups";

export type ArchivedProjectRow = {
  id: string;
  name: string;
  displayTitle?: string;
  stageLabel?: string;
  address: string | null;
  projectNumber: string;
  clientId: string;
  clientName: string;
  clientLogoUrl: string | null;
  clientLogoBgColor: string | null;
  clientLogoTextTone: string | null;
  assignedAthleteName: string | null;
  assignedAthleteCode: string | null;
  profilePhotoUrl: string | null;
  profilePhotoBgColor: string | null;
  profilePhotoTextTone: string | null;
  leadName: string | null;
  currentStatus: keyof typeof PROJECT_STATUS_LABELS;
  complexity: keyof typeof COMPLEXITY_LABELS;
  progressPercent: number | null;
  completedAt: string | null;
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const day = iso.slice(0, 10);
  const d = new Date(`${day}T12:00:00`);
  if (Number.isNaN(d.getTime())) return day;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function leadInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function LeadAssigned({ name }: { name: string | null }) {
  if (!name) {
    return <span className="text-xs text-slate-500">Lead assigned soon</span>;
  }
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-[11px] font-semibold text-slate-300">
        {leadInitials(name)}
      </span>
      <span className="min-w-0 text-sm text-slate-200">{name}</span>
    </span>
  );
}

export function ArchivedProjectsByClient({
  projects,
  showAssignedAthlete = true,
  onOpen,
  onReactivate,
  reactivatingId = null,
  emptyMessage = "No completed projects match these filters.",
  clientGroupLabel = "archived project",
}: {
  projects: ArchivedProjectRow[];
  showAssignedAthlete?: boolean;
  onOpen: (projectId: string) => void;
  onReactivate?: (project: { id: string; name: string; displayTitle?: string }) => void;
  reactivatingId?: string | null;
  emptyMessage?: string;
  clientGroupLabel?: string;
}) {
  const projectsByClient = groupProjectsByClient(projects, (p) => ({
    clientId: p.clientId,
    clientName: p.clientName,
    clientLogoUrl: p.clientLogoUrl,
    clientLogoBgColor: p.clientLogoBgColor,
    clientLogoTextTone: p.clientLogoTextTone,
  }));

  if (projectsByClient.length === 0) {
    return <p className="text-sm text-slate-500">{emptyMessage}</p>;
  }

  return (
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
                {group.projects.length} {clientGroupLabel}
                {group.projects.length === 1 ? "" : "s"}
              </p>
            </div>
          </div>
          <div className="overflow-x-auto rounded-xl ring-1 ring-white/[0.06]">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-white/[0.03] text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Project</th>
                  <th className="px-4 py-3 font-medium">Drawing pack / phase</th>
                  <th className="px-4 py-3 font-medium">Completed</th>
                  <th className="px-4 py-3 font-medium">Lead assigned</th>
                  <th className="px-4 py-3 font-medium">Complexity</th>
                  {showAssignedAthlete ? (
                    <th className="px-4 py-3 font-medium">Completed by</th>
                  ) : null}
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {group.projects.map((p) => (
                  <tr key={p.id} className="bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <p className="font-medium text-white">{p.displayTitle ?? p.name}</p>
                      {p.address ? <p className="text-xs text-slate-500">{p.address}</p> : null}
                    </td>
                    <td className="px-4 py-3 text-slate-300">{p.stageLabel ?? "—"}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-300">{formatDate(p.completedAt)}</td>
                    <td className="px-4 py-3">
                      <LeadAssigned name={p.leadName} />
                    </td>
                    <td className="px-4 py-3">
                      <ComplexityBadge value={p.complexity} label={COMPLEXITY_LABELS[p.complexity]} />
                    </td>
                    {showAssignedAthlete ? (
                      <td className="px-4 py-3 text-slate-300">
                        {p.assignedAthleteName ? (
                          <span className="inline-flex items-center gap-2">
                            <AthleteAvatar
                              name={p.assignedAthleteName}
                              photoUrl={p.profilePhotoUrl}
                              backgroundColor={p.profilePhotoBgColor}
                              textTone={asAvatarTextTone(p.profilePhotoTextTone)}
                              size={24}
                            />
                            <span>
                              {p.assignedAthleteName}
                              {p.assignedAthleteCode ? (
                                <span className="block text-xs text-slate-500">{p.assignedAthleteCode}</span>
                              ) : null}
                            </span>
                          </span>
                        ) : (
                          "Unassigned"
                        )}
                      </td>
                    ) : null}
                    <td className="px-4 py-3">
                      <div className="flex flex-col items-start gap-1.5">
                        <button
                          type="button"
                          onClick={() => onOpen(p.id)}
                          className="text-xs text-brand-300 hover:text-brand-200"
                        >
                          Open
                        </button>
                        {onReactivate ? (
                          <button
                            type="button"
                            disabled={reactivatingId === p.id}
                            onClick={() =>
                              onReactivate({
                                id: p.id,
                                name: p.name,
                                displayTitle: p.displayTitle,
                              })
                            }
                            className="text-xs text-brand-300 hover:text-brand-200 disabled:opacity-40"
                          >
                            {reactivatingId === p.id ? "Moving…" : "Bring back to active"}
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
