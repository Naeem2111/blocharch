export type ClientPortalDeliverable = {
  label: string;
  url: string | null;
};

export function parseClientDeliverables(raw: unknown): ClientPortalDeliverable[] {
  if (!Array.isArray(raw)) return [];
  const out: ClientPortalDeliverable[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const label = "label" in item ? String((item as { label: unknown }).label ?? "").trim() : "";
    if (!label) continue;
    const urlRaw = "url" in item ? (item as { url: unknown }).url : null;
    const url =
      typeof urlRaw === "string" && urlRaw.trim().length > 0 ? urlRaw.trim().slice(0, 2048) : null;
    out.push({ label: label.slice(0, 200), url });
  }
  return out;
}

export function normalizeClientDeliverablesForSave(
  raw: unknown
): ClientPortalDeliverable[] | null {
  if (raw === null || raw === undefined) return null;
  const parsed = parseClientDeliverables(raw);
  return parsed.length > 0 ? parsed : null;
}
