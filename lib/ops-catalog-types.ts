export const OPS_CUSTOM_PREFIX = "custom:";

export type OpsCatalogKind = "phase" | "work_type";

export type OpsCatalogOption = {
  id: string | null;
  value: string;
  label: string;
  builtInKey: string | null;
  isBuiltIn: boolean;
};

export function isCustomCatalogValue(value: string): boolean {
  return value.startsWith(OPS_CUSTOM_PREFIX);
}

export function catalogIdFromValue(value: string): string | null {
  if (!isCustomCatalogValue(value)) return null;
  const id = value.slice(OPS_CUSTOM_PREFIX.length).trim();
  return id || null;
}

export function catalogValueFromId(id: string): string {
  return `${OPS_CUSTOM_PREFIX}${id}`;
}

export function linePhaseSelectValue(
  projectPhase: string,
  customPhaseId?: string | null,
): string {
  return customPhaseId ? catalogValueFromId(customPhaseId) : projectPhase;
}

export function catalogOptionLabel(
  value: string,
  options: { value: string; label: string }[],
  fallback?: string,
): string {
  return options.find((o) => o.value === value)?.label ?? fallback ?? value;
}
