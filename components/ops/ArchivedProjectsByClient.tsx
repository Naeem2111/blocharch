"use client";

import { AthleteAvatar } from "@/components/ops/AthleteAvatar";
import { ClientAvatar } from "@/components/ops/ClientAvatar";
import { asAvatarTextTone } from "@/lib/avatar-text-tone";
import {
  COMPLEXITY_LABELS,
  PROJECT_PHASE_LABELS,
  PROJECT_STATUS_LABELS,
} from "@/lib/ops-constants";
import { groupProjectsByClient } from "@/lib/ops-project-groups";

export type ArchivedProjectRow = {
  id: string;
  name: string;
  displayTitle?: string;
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
  currentStatus: keyof typeof PROJECT_STATUS_LABELS;
  complexity: keyof typeof COMPLEXITY_LABELS;
  progressPercent: number | null;
  handoverDate: string | null;
  completedAt: string | null;
  deadlineBeatenDays: number | null;
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return iso.slice(0, 10);
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
                  {showAssignedAthlete ? (
                    <th className="px-4 py-3 font-medium">Completed by</th>
                  ) : null}
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Completed</th>
                  <th className="px-4 py-3 font-medium">Handover</th>
                  <th className="px-4 py-3 font-medium">Progress</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {group.projects.map((p) => (
                  <tr key={p.id} className="bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <p className="font-medium text-white">{p.displayTitle ?? p.name}</p>
                      <p className="text-xs text-slate-500">
                        {p.projectNumber}
                        {p.address ? ` · ${p.address}` : ""} · {COMPLEXITY_LABELS[p.complexity]}
                      </p>
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
                    <td className="px-4 py-3 text-slate-300">
                      {PROJECT_STATUS_LABELS[p.currentStatus]}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {formatDate(p.completedAt ?? p.handoverDate)}
                      {p.deadlineBeatenDays != null && p.deadlineBeatenDays > 0 ? (
                        <span className="block text-xs text-brand-300">
                          {p.deadlineBeatenDays} day{p.deadlineBeatenDays === 1 ? "" : "s"} early
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-slate-300">{formatDate(p.handoverDate)}</td>
                    <td className="px-4 py-3 text-slate-300">{p.progressPercent ?? "—"}%</td>
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
                            className="text-xs text-slate-500 hover:text-slate-300 disabled:opacity-40"
                          >
                            {reactivatingId === p.id ? "Moving…" : "Still in progress"}
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
