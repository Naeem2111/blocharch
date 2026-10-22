import { prisma } from "@/lib/prisma";
import {
  catalogIdFromValue,
  catalogValueFromId,
  isCustomCatalogValue,
  type OpsCatalogOption,
} from "@/lib/ops-catalog-types";

/** Stored sort values at or above this mean the staff list was reordered. */
const CATALOG_ORDER_BASE = 1000;

export const PRIVATE_CATALOG_PHASES = [
  { key: "site_measure_up", label: "Site Measure-Up / Survey" },
  { key: "existing_drawings", label: "Existing / As-Built Drawings" },
  { key: "concept_design", label: "Concept Design" },
  { key: "design_review", label: "Design Review & Refinement" },
  { key: "design_development", label: "Design Development (Proposed Drawings)" },
  { key: "council_submission_docs", label: "Council Submission & Documentation" },
] as const;

export const PRIVATE_CATALOG_WORK_TYPES = [
  { key: "plans", label: "Plans" },
  { key: "sections", label: "Sections" },
  { key: "elevations", label: "Elevations" },
  { key: "joinery_drawings", label: "Joinery Drawings" },
  { key: "bathroom_drawings", label: "Bathroom Drawings" },
  { key: "bathroom_joinery", label: "Bathroom Joinery" },
  { key: "construction_detailing", label: "Construction Detailing" },
  { key: "window_door_schedules", label: "Window / Door Schedules" },
  { key: "area_schedules", label: "Area Schedules" },
  { key: "drainage", label: "Drainage" },
  { key: "setting_out", label: "Setting Out & Organisation Drawings" },
  { key: "electrical_drawings", label: "Electrical Drawings" },
  { key: "modelling_3d", label: "3D Modelling" },
  { key: "rendering", label: "Rendering" },
  { key: "coordination_markups", label: "Coordination / Markups" },
  { key: "review_qa", label: "Review / QA" },
  { key: "amendments", label: "Amendments" },
  { key: "admin_housekeeping", label: "Admin / Housekeeping" },
  { key: "other", label: "Other" },
] as const;

const PHASE_KEYS = new Set<string>(PRIVATE_CATALOG_PHASES.map((item) => item.key));
const WORK_TYPE_KEYS = new Set<string>(PRIVATE_CATALOG_WORK_TYPES.map((item) => item.key));

function optionSortKey(storedSort: number | null | undefined, defaultKey: number): number {
  if (storedSort != null && storedSort >= CATALOG_ORDER_BASE) return storedSort;
  return defaultKey;
}

function sortOptions(items: { option: OpsCatalogOption; sort: number }[]): OpsCatalogOption[] {
  return items
    .sort((a, b) => a.sort - b.sort || a.option.label.localeCompare(b.option.label))
    .map((item) => item.option);
}

async function ensurePrivateCatalog() {
  const [phaseCount, workTypeCount] = await Promise.all([
    prisma.privateCatalogPhase.count(),
    prisma.privateCatalogWorkType.count(),
  ]);
  if (phaseCount === 0) {
    await prisma.privateCatalogPhase.createMany({
      data: PRIVATE_CATALOG_PHASES.map((item, index) => ({
        label: item.label,
        builtInKey: item.key,
        sortOrder: index,
      })),
      skipDuplicates: true,
    });
  }
  if (workTypeCount === 0) {
    await prisma.privateCatalogWorkType.createMany({
      data: PRIVATE_CATALOG_WORK_TYPES.map((item, index) => ({
        label: item.label,
        builtInKey: item.key,
        sortOrder: index,
      })),
      skipDuplicates: true,
    });
  }
}

export function isPrivateCatalogPhaseKey(value: string): boolean {
  return PHASE_KEYS.has(value);
}

export function isPrivateCatalogWorkTypeKey(value: string): boolean {
  return WORK_TYPE_KEYS.has(value);
}

export async function listPrivatePhaseOptions(): Promise<OpsCatalogOption[]> {
  await ensurePrivateCatalog();
  const rows = await prisma.privateCatalogPhase.findMany({
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
  });
  const hiddenBuiltIns = new Set(rows.filter((row) => row.builtInKey && row.hidden).map((row) => row.builtInKey as string));
  const builtIns = PRIVATE_CATALOG_PHASES.filter((item) => !hiddenBuiltIns.has(item.key)).map((item, index) => {
    const override = rows.find((row) => row.builtInKey === item.key && !row.hidden);
    return {
      sort: optionSortKey(override?.sortOrder, index),
      option: {
        id: override?.id ?? null,
        value: item.key,
        label: override?.label ?? item.label,
        builtInKey: item.key,
        isBuiltIn: true,
      } satisfies OpsCatalogOption,
    };
  });
  const customs = rows
    .filter((row) => !row.builtInKey && !row.hidden)
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
  return sortOptions([...builtIns, ...customs]);
}

export async function listPrivateWorkTypeOptions(): Promise<OpsCatalogOption[]> {
  await ensurePrivateCatalog();
  const rows = await prisma.privateCatalogWorkType.findMany({
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
  });
  const hiddenBuiltIns = new Set(rows.filter((row) => row.builtInKey && row.hidden).map((row) => row.builtInKey as string));
  const builtIns = PRIVATE_CATALOG_WORK_TYPES.filter((item) => !hiddenBuiltIns.has(item.key)).map((item, index) => {
    const override = rows.find((row) => row.builtInKey === item.key && !row.hidden);
    return {
      sort: optionSortKey(override?.sortOrder, index),
      option: {
        id: override?.id ?? null,
        value: item.key,
        label: override?.label ?? item.label,
        builtInKey: item.key,
        isBuiltIn: true,
      } satisfies OpsCatalogOption,
    };
  });
  const customs = rows
    .filter((row) => !row.builtInKey && !row.hidden)
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
  return sortOptions([...builtIns, ...customs]);
}

export async function listPrivateCatalog(): Promise<{ phases: OpsCatalogOption[]; workTypes: OpsCatalogOption[] }> {
  const [phases, workTypes] = await Promise.all([listPrivatePhaseOptions(), listPrivateWorkTypeOptions()]);
  return { phases, workTypes };
}

export async function reorderPrivateCatalog(kind: "phase" | "work_type", values: string[]): Promise<string | null> {
  const current = kind === "phase" ? await listPrivatePhaseOptions() : await listPrivateWorkTypeOptions();
  if (values.length !== current.length || new Set(values).size !== values.length) return "Reorder the full list";
  const allowed = new Set(current.map((option) => option.value));
  if (values.some((value) => !allowed.has(value))) return "Unknown catalog item";

  const writes = values.map((value, index) => {
    const sortOrder = CATALOG_ORDER_BASE + index;
    if (kind === "phase") {
      if (isCustomCatalogValue(value)) {
        const id = catalogIdFromValue(value);
        if (!id) return null;
        return prisma.privateCatalogPhase.update({ where: { id }, data: { sortOrder } });
      }
      if (!isPrivateCatalogPhaseKey(value)) return null;
      const label = PRIVATE_CATALOG_PHASES.find((item) => item.key === value)?.label ?? value;
      return prisma.privateCatalogPhase.upsert({
        where: { builtInKey: value },
        create: { label, builtInKey: value, sortOrder },
        update: { sortOrder },
      });
    }
    if (isCustomCatalogValue(value)) {
      const id = catalogIdFromValue(value);
      if (!id) return null;
      return prisma.privateCatalogWorkType.update({ where: { id }, data: { sortOrder } });
    }
    if (!isPrivateCatalogWorkTypeKey(value)) return null;
    const label = PRIVATE_CATALOG_WORK_TYPES.find((item) => item.key === value)?.label ?? value;
    return prisma.privateCatalogWorkType.upsert({
      where: { builtInKey: value },
      create: { label, builtInKey: value, sortOrder },
      update: { sortOrder },
    });
  });
  if (writes.some((write) => write == null)) return "Unknown catalog item";
  await prisma.$transaction(writes.filter((write): write is NonNullable<(typeof writes)[number]> => write != null));
  return null;
}
