/** Pure string helpers for address display (safe for client and server). */

export function getBestAddressFromFields(
  address: string | undefined,
  description: string | undefined
): string | null {
  const direct = (address || "").trim();
  if (direct) return direct;

  const desc = (description || "").trim();
  if (!desc) return null;

  const m = desc.match(
    /\bAddresses?\b\s+([\s\S]*?)(?=\bContact\b|\bEmail\b|\bWebsite\b|\bTwitter\b|\bInstagram\b|\bLinkedIn\b|\bFacebook\b|\bBack to Results\b|$)/i
  );
  if (!m?.[1]) return null;
  const extracted = m[1].replace(/\s+/g, " ").trim();
  if (!extracted) return null;
  return extracted.length > 160 ? extracted.slice(0, 160) : extracted;
}
