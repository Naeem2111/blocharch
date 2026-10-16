import type { OpsProjectPhase, OpsTaskType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  OPS_PROJECT_STAGE_OPTIONS,
  PROJECT_PHASE_LABELS,
  TASK_TYPE_LABELS,
  isOpsProjectPhase,
  isOpsTaskType,
} from "@/lib/ops-constants";
import {
  catalogIdFromValue,
  catalogValueFromId,
  isCustomCatalogValue,
  type OpsCatalogOption,
} from "@/lib/ops-catalog-types";

export type { OpsCatalogKind, OpsCatalogOption } from "@/lib/ops-catalog-types";
export {
  OPS_CUSTOM_PREFIX,
  catalogIdFromValue,
  catalogValueFromId,
  isCustomCatalogValue,
  linePhaseSelectValue,
  catalogOptionLabel,
} from "@/lib/ops-catalog-types";

export function isCatalogWorkTypeValue(value: string): boolean {
  return isOpsTaskType(value) || isCustomCatalogValue(value);
}

/** Stored sort values at or above this mean the staff list was reordered. */
const CATALOG_ORDER_BASE = 1000;

function optionSortKey(storedSort: number | null | undefined, defaultKey: number): number {
  if (storedSort != null && storedSort >= CATALOG_ORDER_BASE) return storedSort;
  return defaultKey;
}

function sortCatalogOptions(
  items: { option: OpsCatalogOption; sort: number }[],
): OpsCatalogOption[] {
  return items.sort((a, b) => a.sort - b.sort || a.option.label.localeCompare(b.option.label)).map((item) => item.option);
}

export async function listOpsPhaseOptions(): Promise<OpsCatalogOption[]> {
  const rows = await prisma.opsCatalogPhase.findMany({
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    select: { id: true, label: true, builtInKey: true, hidden: true, sortOrder: true },
  });

  const hiddenBuiltIns = new Set(
    rows.filter((r) => r.builtInKey && r.hidden).map((r) => r.builtInKey as string),
  );

  const builtIns = OPS_PROJECT_STAGE_OPTIONS.filter((opt) => !hiddenBuiltIns.has(opt.value)).map(
    (opt, index) => {
      const override = rows.find((r) => r.builtInKey === opt.value && !r.hidden);
      return {
        sort: optionSortKey(override?.sortOrder, index),
        option: {
          id: override?.id ?? null,
          value: opt.value,
          label: override?.label ?? opt.label,
          builtInKey: opt.value,
          isBuiltIn: true,
        } satisfies OpsCatalogOption,
      };
    },
  );

  const customs = rows
    .filter((r) => !r.builtInKey && !r.hidden)
    .map((row, index) => ({
      sort: optionSortKey(row.sortOrder, CATALOG_ORDER_BASE + index),
      option: {
        id: row.id,
        value: catalogValueFromId(row.id),
        label: row.label,
        builtInKey: null,
        isBuiltIn: false,
      } satisfies OpsCatalogOption,
    }));

  return sortCatalogOptions([...builtIns, ...customs]);
}

export async function listOpsWorkTypeOptions(): Promise<OpsCatalogOption[]> {
  const rows = await prisma.opsCatalogWorkType.findMany({
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    select: { id: true, label: true, builtInKey: true, hidden: true, sortOrder: true },
  });

  const hiddenBuiltIns = new Set(
    rows.filter((r) => r.builtInKey && r.hidden).map((r) => r.builtInKey as string),
  );

  const builtIns = Object.entries(TASK_TYPE_LABELS)
    .filter(([value]) => !hiddenBuiltIns.has(value))
    .map(([value, label], index) => {
      const override = rows.find((r) => r.builtInKey === value && !r.hidden);
      return {
        sort: optionSortKey(override?.sortOrder, index),
        option: {
          id: override?.id ?? null,
          value,
          label: override?.label ?? label,
          builtInKey: value,
          isBuiltIn: true,
        } satisfies OpsCatalogOption,
      };
    });

  const customs = rows
    .filter((r) => !r.builtInKey && !r.hidden)
    .map((row, index) => ({
      sort: optionSortKey(row.sortOrder, CATALOG_ORDER_BASE + index),
      option: {
        id: row.id,
        value: catalogValueFromId(row.id),
        label: row.label,
        builtInKey: null,
        isBuiltIn: false,
      } satisfies OpsCatalogOption,
    }));

  return sortCatalogOptions([...builtIns, ...customs]);
}

export async function reorderOpsCatalog(kind: "phase" | "work_type", values: string[]): Promise<string | null> {
  const current = kind === "phase" ? await listOpsPhaseOptions() : await listOpsWorkTypeOptions();
  if (values.length !== current.length || new Set(values).size !== values.length) {
    return "Reorder the full list";
  }
  const allowed = new Set(current.map((option) => option.value));
  if (values.some((value) => !allowed.has(value))) return "Unknown catalog item";

  const writes = values.map((value, index) => {
    const sortOrder = CATALOG_ORDER_BASE + index;
    if (kind === "phase") {
      if (isCustomCatalogValue(value)) {
        const id = catalogIdFromValue(value);
        if (!id) return null;
        return prisma.opsCatalogPhase.update({ where: { id }, data: { sortOrder } });
      }
      if (!isOpsProjectPhase(value) || value === "custom") return null;
      const label = OPS_PROJECT_STAGE_OPTIONS.find((opt) => opt.value === value)?.label ?? PROJECT_PHASE_LABELS[value];
      return prisma.opsCatalogPhase.upsert({
        where: { builtInKey: value },
        create: { label, builtInKey: value, sortOrder },
        update: { sortOrder },
      });
    }
    if (isCustomCatalogValue(value)) {
      const id = catalogIdFromValue(value);
      if (!id) return null;
      return prisma.opsCatalogWorkType.update({ where: { id }, data: { sortOrder } });
    }
    if (!isOpsTaskType(value)) return null;
    return prisma.opsCatalogWorkType.upsert({
      where: { builtInKey: value },
      create: { label: TASK_TYPE_LABELS[value], builtInKey: value, sortOrder },
      update: { sortOrder },
    });
  });

  if (writes.some((write) => write == null)) return "Unknown catalog item";
  await prisma.$transaction(writes.filter((write): write is NonNullable<typeof write> => write != null));
  return null;
}

export async function listOpsCatalog(): Promise<{
  phases: OpsCatalogOption[];
  workTypes: OpsCatalogOption[];
}> {
  const [phases, workTypes] = await Promise.all([listOpsPhaseOptions(), listOpsWorkTypeOptions()]);
  return { phases, workTypes };
}

export function workTypeLabelFromOptions(value: string, options: OpsCatalogOption[]): string {
  return options.find((o) => o.value === value)?.label ?? TASK_TYPE_LABELS[value as OpsTaskType] ?? value;
}

export function phaseLabelFromOptions(
  value: string,
  options: OpsCatalogOption[],
  customLabel?: string | null,
): string {
  if (customLabel) return customLabel;
  const match = options.find((o) => o.value === value);
  if (match) return match.label;
  if (isOpsProjectPhase(value)) return PROJECT_PHASE_LABELS[value];
  return value;
}

export async function resolveOpsStageInput(raw: string): Promise<
  | { ok: true; currentStage: OpsProjectPhase; customStageId: string | null }
  | { ok: false; error: string }
> {
  const value = String(raw || "").trim();
  if (!value) {
    return { ok: true, currentStage: "survey_conversion", customStageId: null };
  }
  const customId = catalogIdFromValue(value);
  if (customId) {
    const row = await prisma.opsCatalogPhase.findFirst({
      where: { id: customId, builtInKey: null, hidden: false },
      select: { id: true },
    });
    if (!row) return { ok: false, error: "Unknown project phase / package" };
    return { ok: true, currentStage: "custom", customStageId: row.id };
  }
  if (!isOpsProjectPhase(value) || value === "custom") {
    return { ok: false, error: "Invalid stage" };
  }
  const hidden = await prisma.opsCatalogPhase.findFirst({
    where: { builtInKey: value, hidden: true },
    select: { id: true },
  });
  if (hidden) return { ok: false, error: "That phase / package is no longer available" };
  return { ok: true, currentStage: value, customStageId: null };
}

export async function resolveOpsLinePhaseInput(raw: string): Promise<
  | { ok: true; projectPhase: OpsProjectPhase; customPhaseId: string | null }
  | { ok: false; error: string }
> {
  return resolveOpsStageInput(raw).then((resolved) => {
    if (!resolved.ok) return resolved;
    return {
      ok: true as const,
      projectPhase: resolved.currentStage,
      customPhaseId: resolved.customStageId,
    };
  });
}

export async function assertCustomWorkTypeIds(values: string[]): Promise<string | null> {
  const ids = values.map(catalogIdFromValue).filter((id): id is string => Boolean(id));
  if (ids.length > 0) {
    const found = await prisma.opsCatalogWorkType.findMany({
      where: { id: { in: ids }, builtInKey: null, hidden: false },
      select: { id: true },
    });
    if (found.length !== ids.length) return "Unknown work type";
  }

  const builtIns = values.filter((v): v is OpsTaskType => isOpsTaskType(v));
  if (builtIns.length > 0) {
    const hidden = await prisma.opsCatalogWorkType.findMany({
      where: { builtInKey: { in: builtIns }, hidden: true },
      select: { builtInKey: true },
    });
    if (hidden.length > 0) return "Unknown work type";
  }

  return null;
}

export function stageSelectValue(stage: OpsProjectPhase, customStageId?: string | null): string {
  if (stage === "custom" && customStageId) return catalogValueFromId(customStageId);
  if (stage === "existing_drawings") return "survey_conversion";
  return stage;
}

/** Pipeline expected stage is a built-in package only (no custom FK on pipeline rows). */
export function parsePipelineExpectedStage(raw: string): OpsProjectPhase | null {
  const value = String(raw || "").trim();
  if (!value) return null;
  if (!isOpsProjectPhase(value) || value === "custom") return null;
  return value;
}
