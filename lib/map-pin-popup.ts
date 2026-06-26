import { LEAD_STAGES, type LeadStage } from "@/lib/leads";
import { LEAD_STAGE_COLORS, LEAD_STAGE_LABELS } from "@/lib/lead-stage-ui";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function mapPinStageColor(stage: string): string {
  return LEAD_STAGE_COLORS[stage as LeadStage] ?? LEAD_STAGE_COLORS.cold;
}

/** Sync stage dot beside the map popup `<select>`. */
export function applyMapPinStageSelectAppearance(sel: HTMLSelectElement): void {
  const color = mapPinStageColor(sel.value);
  const dot = sel.closest(".map-pin-stage-wrap")?.querySelector(".map-pin-stage-dot") as HTMLElement | null;
  if (dot) dot.style.backgroundColor = color;
}

/** Inline stage dropdown for Leaflet marker popups (vanilla HTML). */
export function buildMapPinStageSelectHtml(slug: string, stage: LeadStage): string {
  const color = mapPinStageColor(stage);
  const options = LEAD_STAGES.map(
    (s) =>
      `<option value="${escapeHtml(s)}"${s === stage ? " selected" : ""}>${escapeHtml(LEAD_STAGE_LABELS[s])}</option>`
  ).join("");
  return `<div class="map-pin-stage-row" style="margin-top:8px;">
    <label style="display:block;font-size:11px;font-weight:600;color:#475569;margin-bottom:4px;">Lead stage</label>
    <div class="map-pin-stage-wrap" style="display:flex;align-items:center;gap:8px;">
      <span class="map-pin-stage-dot" aria-hidden="true" style="flex-shrink:0;display:inline-block;width:12px;height:12px;border-radius:9999px;background:${color};border:2px solid #fff;box-shadow:0 0 0 1px rgba(15,23,42,0.25);"></span>
      <select class="map-pin-stage-select" data-slug="${escapeHtml(slug)}" style="flex:1;min-width:0;font-size:12px;border:1px solid #cbd5e1;border-radius:6px;padding:4px 8px;background:#fff;color:#0f172a;">
        ${options}
      </select>
    </div>
  </div>`;
}
