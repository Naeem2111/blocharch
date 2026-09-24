import { prisma } from "@/lib/prisma";
import { PRIVATE_PROJECT_TYPE_LABELS } from "@/lib/private-constants";
import type { PrivateProjectType } from "@prisma/client";

const BUILT_IN_TYPE_KEYS: PrivateProjectType[] = ["residential_extension", "commercial"];

export type PrivateProjectTypeOption = {
  id: string | null;
  value: string;
  label: string;
  builtInKey: PrivateProjectType | null;
  isBuiltIn: boolean;
};

export async function listPrivateProjectTypeOptions(): Promise<{
  types: PrivateProjectTypeOption[];
}> {
  const rows = await prisma.privateProjectCustomType.findMany({
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    select: { id: true, label: true, builtInKey: true, hidden: true },
  });

  const hiddenBuiltIns = new Set(
    rows.filter((r) => r.builtInKey && r.hidden).map((r) => r.builtInKey as string),
  );

  const types: PrivateProjectTypeOption[] = [];

  for (const key of BUILT_IN_TYPE_KEYS) {
    if (hiddenBuiltIns.has(key)) continue;
    const override = rows.find((r) => r.builtInKey === key && !r.hidden);
    types.push({
      id: override?.id ?? null,
      value: key,
      label: override?.label ?? PRIVATE_PROJECT_TYPE_LABELS[key],
      builtInKey: key,
      isBuiltIn: true,
    });
  }

  for (const row of rows.filter((r) => !r.builtInKey && !r.hidden)) {
    types.push({
      id: row.id,
      value: `custom:${row.id}`,
      label: row.label,
      builtInKey: null,
      isBuiltIn: false,
    });
  }

  return { types };
}

export function resolvePrivateProjectTypeLabel(
  projectType: PrivateProjectType,
  customType: { label: string } | null | undefined,
): string {
  if (projectType === "other" && customType?.label) {
    return customType.label;
  }
  return PRIVATE_PROJECT_TYPE_LABELS[projectType];
}

/** Parse onboarding/API payload into projectType + optional custom type id. */
export async function resolveProjectTypeInput(body: {
  projectType?: string;
}): Promise<
  | { ok: true; projectType: PrivateProjectType; customProjectTypeId: string | null }
  | { ok: false; error: string }
> {
  const raw = String(body.projectType || "").trim();
  if (!raw) return { ok: false, error: "Project type is required" };

  if (raw.startsWith("custom:")) {
    const id = raw.slice("custom:".length).trim();
    if (!id) return { ok: false, error: "Invalid project type" };
    const custom = await prisma.privateProjectCustomType.findFirst({
      where: { id, builtInKey: null, hidden: false },
    });
    if (!custom) return { ok: false, error: "Project type not found" };
    return { ok: true, projectType: "other", customProjectTypeId: custom.id };
  }

  if (raw === "residential_extension" || raw === "commercial") {
    const hidden = await prisma.privateProjectCustomType.findFirst({
      where: { builtInKey: raw, hidden: true },
      select: { id: true },
    });
    if (hidden) return { ok: false, error: "That project type is no longer available" };
    return { ok: true, projectType: raw, customProjectTypeId: null };
  }

  return { ok: false, error: "Invalid project type" };
}

export function projectTypeSelectValue(input: {
  projectType: string;
  customProjectTypeId: string | null;
}): string {
  if (input.projectType === "other" && input.customProjectTypeId) {
    return `custom:${input.customProjectTypeId}`;
  }
  if (input.projectType === "residential_extension" || input.projectType === "commercial") {
    return input.projectType;
  }
  return "residential_extension";
}
