import { prisma } from "@/lib/prisma";
import { PRIVATE_PROJECT_TYPE_LABELS } from "@/lib/private-constants";
import type { PrivateProjectType } from "@prisma/client";

export async function findOrCreateCustomProjectType(label: string) {
  const trimmed = label.trim();
  if (!trimmed) return null;

  const existing = await prisma.privateProjectCustomType.findFirst({
    where: { label: { equals: trimmed, mode: "insensitive" } },
  });
  if (existing) return existing;

  return prisma.privateProjectCustomType.create({
    data: { label: trimmed },
  });
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

export async function listPrivateProjectTypeOptions() {
  const customTypes = await prisma.privateProjectCustomType.findMany({
    orderBy: { label: "asc" },
    select: { id: true, label: true },
  });

  return {
    builtIn: (Object.keys(PRIVATE_PROJECT_TYPE_LABELS) as PrivateProjectType[])
      .filter((key) => key !== "other")
      .map((key) => ({
        key,
        label: PRIVATE_PROJECT_TYPE_LABELS[key],
      })),
    customTypes,
  };
}

/** Parse onboarding/API payload into projectType + optional custom type id. */
export async function resolveProjectTypeInput(body: {
  projectType?: string;
  customProjectTypeId?: string | null;
  customProjectTypeLabel?: string | null;
}): Promise<
  | { ok: true; projectType: PrivateProjectType; customProjectTypeId: string | null }
  | { ok: false; error: string }
> {
  const raw = String(body.projectType || "").trim();

  if (raw.startsWith("custom:")) {
    const id = raw.slice("custom:".length).trim();
    if (!id) return { ok: false, error: "Invalid custom project type" };
    const custom = await prisma.privateProjectCustomType.findUnique({ where: { id } });
    if (!custom) return { ok: false, error: "Custom project type not found" };
    return { ok: true, projectType: "other", customProjectTypeId: custom.id };
  }

  if (raw === "other") {
    const label = String(body.customProjectTypeLabel || "").trim();
    if (!label) {
      return { ok: false, error: "A project type label is required when type is Other" };
    }
    const custom = await findOrCreateCustomProjectType(label);
    if (!custom) {
      return { ok: false, error: "A project type label is required when type is Other" };
    }
    return { ok: true, projectType: "other", customProjectTypeId: custom.id };
  }

  if (raw !== "residential_extension" && raw !== "commercial") {
    return { ok: false, error: "Invalid project type" };
  }

  return { ok: true, projectType: raw, customProjectTypeId: null };
}
