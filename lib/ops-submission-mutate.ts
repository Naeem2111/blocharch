import type { OpsProjectPhase, OpsTaskType, OpsUrgencyStatus } from "@prisma/client";
import {
  isOpsProjectPhase,
  isOpsTaskType,
  isOpsUrgencyStatus,
} from "@/lib/ops-constants";
import { catalogIdFromValue, isCustomCatalogValue } from "@/lib/ops-catalog-types";

export type SubmissionLineItemInput = {
  clientId: string;
  projectId: string | null;
  isHousekeeping: boolean;
  projectPhase: OpsProjectPhase;
  customPhaseId: string | null;
  taskType: OpsTaskType;
  taskTypes: string[];
  hoursWorked: number;
  completionPercent?: number | null;
  urgencyStatus?: OpsUrgencyStatus;
  completedSummary?: string | null;
  notes?: string | null;
};

export function parseSubmissionLineItems(raw: unknown): SubmissionLineItemInput[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const items: SubmissionLineItemInput[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") return null;
    const o = row as Record<string, unknown>;
    const hoursWorked = Number(o.hoursWorked);
    if (!Number.isFinite(hoursWorked) || hoursWorked <= 0) return null;
    const clientId = String(o.clientId || "").trim();
    if (!clientId) return null;

    const isHousekeeping = Boolean(o.isHousekeeping);
    if (isHousekeeping) {
      const notes = o.notes ? String(o.notes).trim() : "";
      if (!notes) return null;
      items.push({
        clientId,
        projectId: null,
        isHousekeeping: true,
        projectPhase: "housekeeping_internal",
        customPhaseId: null,
        taskType: "admin_housekeeping",
        taskTypes: ["admin_housekeeping"],
        hoursWorked,
        completionPercent: null,
        urgencyStatus: "normal",
        completedSummary: null,
        notes,
      });
      continue;
    }

    const projectId = String(o.projectId || "").trim();
    if (!projectId) return null;
    const projectPhaseRaw = String(o.projectPhase || "");
    const customPhaseId = catalogIdFromValue(projectPhaseRaw);
    const projectPhase: OpsProjectPhase | "" = customPhaseId
      ? "custom"
      : isOpsProjectPhase(projectPhaseRaw) && projectPhaseRaw !== "custom"
        ? projectPhaseRaw
        : "";
    if (!projectPhase) return null;
    const rawTypes = Array.isArray(o.taskTypes)
      ? o.taskTypes.map((t) => String(t)).filter((t) => isOpsTaskType(t) || isCustomCatalogValue(t))
      : [];
    const taskType = (rawTypes.find((t) => isOpsTaskType(t)) as OpsTaskType | undefined)
      ?? (isOpsTaskType(String(o.taskType || "")) ? (String(o.taskType) as OpsTaskType) : rawTypes.length > 0 ? "other" : "");
    if (!isOpsTaskType(taskType)) return null;
    const taskTypes = rawTypes.length > 0 ? rawTypes : [taskType];
    const urgency = String(o.urgencyStatus || "normal");
    items.push({
      clientId,
      projectId,
      isHousekeeping: false,
      projectPhase,
      customPhaseId,
      taskType,
      taskTypes,
      hoursWorked,
      completionPercent: o.completionPercent != null ? Number(o.completionPercent) : null,
      urgencyStatus: isOpsUrgencyStatus(urgency) ? urgency : "normal",
      completedSummary: o.completedSummary ? String(o.completedSummary) : null,
      notes: o.notes ? String(o.notes) : null,
    });
  }
  return items;
}
