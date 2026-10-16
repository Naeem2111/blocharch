function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function looksLikeHtml(value: string): boolean {
  return /<\/?(p|br|strong|b|em|i|u|ul|ol|li|div)\b/i.test(value);
}

/** Keep only the formatting the project description editor can produce. */
export function sanitizeRichHtml(html: string): string {
  let source = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "");
  source = source.replace(/<\/?([a-z0-9]+)(\s[^>]*)?>/gi, (full, tag: string) => {
    const name = tag.toLowerCase();
    const mapped =
      name === "b" || name === "strong"
        ? "strong"
        : name === "i" || name === "em"
          ? "em"
          : name === "u"
            ? "u"
            : name === "ul" || name === "ol"
              ? "ul"
              : name === "li"
                ? "li"
                : name === "p" || name === "div"
                  ? "p"
                  : name === "br"
                    ? "br"
                    : "";
    if (!mapped) return "";
    if (mapped === "br") return "<br>";
    return full.startsWith("</") ? `</${mapped}>` : `<${mapped}>`;
  });
  source = source
    .replace(/<p>\s*<\/p>/g, "")
    .replace(/<p>(?:<br>)+<\/p>/g, "")
    .replace(/<p>(<ul>[\s\S]*?<\/ul>)<\/p>/g, "$1")
    .replace(/<p>(https?:\/\/[^\s<]+)<\/p>/gi, "");
  return source.trim();
}

function plainTextToHtml(text: string): string {
  const blocks: string[] = [];
  let list: string[] = [];
  const flush = () => {
    if (!list.length) return;
    blocks.push(`<ul>${list.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`);
    list = [];
  };
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) {
      flush();
      continue;
    }
    const body = trimmed.replace(/^🔗\s*/, "");
    const bullet = body.match(/^[*•-]\s+(.*)$/);
    if (bullet) {
      const item = bullet[1]!.trim();
      if (!item || /^https?:\/\//i.test(item)) continue;
      list.push(item);
      continue;
    }
    if (/^https?:\/\//i.test(body)) continue;
    flush();
    blocks.push(`<p>${escapeHtml(body)}</p>`);
  }
  flush();
  return blocks.join("");
}

export function richTextToHtml(value: string): string {
  const raw = value.trim();
  if (!raw) return "";
  if (looksLikeHtml(raw)) return sanitizeRichHtml(raw);
  return plainTextToHtml(raw);
}

export function normalizeProjectDescription(value: unknown): string | null {
  const html = richTextToHtml(String(value ?? ""));
  return richTextIsEmpty(html) ? null : html;
}

export function richTextIsEmpty(value: string): boolean {
  const text = richTextToHtml(value)
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
  return text.length === 0;
}
