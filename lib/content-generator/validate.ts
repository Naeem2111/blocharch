export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

export type ColourMethod = "samples" | "hex" | "palette" | "source";

const METHODS: readonly ColourMethod[] = ["samples", "hex", "palette", "source"];

export function isColourMethod(value: string): value is ColourMethod {
  return (METHODS as readonly string[]).includes(value);
}

export function isValidHex(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value.trim());
}

export function normalizeHex(value: string): string {
  return value.trim().toUpperCase();
}

export function parseHexList(
  values: string[],
  bounds: { min?: number; max?: number } = {},
): { ok: true; hex: string[] } | { ok: false; error: string } {
  const min = bounds.min ?? 3;
  const max = bounds.max ?? 5;
  const filled = values.map((value) => value.trim()).filter(Boolean);
  if (filled.some((value) => !isValidHex(value))) {
    return { ok: false, error: "Each colour must be a HEX code like #0000DC." };
  }
  if (filled.length < min || filled.length > max) {
    return { ok: false, error: `Enter ${min} to ${max} HEX colours, like #0000DC.` };
  }
  return { ok: true, hex: filled.map(normalizeHex) };
}

export function isAllowedImageName(name: string, type: string): boolean {
  const mime = type.toLowerCase();
  if (mime === "image/jpeg" || mime === "image/png" || mime === "image/webp") return true;
  const lower = name.toLowerCase();
  return (
    lower.endsWith(".jpg") ||
    lower.endsWith(".jpeg") ||
    lower.endsWith(".png") ||
    lower.endsWith(".webp")
  );
}
