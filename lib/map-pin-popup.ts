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

/** Sync dot + accent border with the current `<select>` value. */
export function applyMapPinStageSelectAppearance(sel: HTMLSelectElement): void {
  const color = mapPinStageColor(sel.value);
  const dot = sel.parentElement?.querySelector(".map-pin-stage-dot") as HTMLElement | null;
  if (dot) dot.style.backgroundColor = color;
  sel.style.borderLeftColor = color;
}

/** Inline stage dropdown for Leaflet marker popups (vanilla HTML). */
export function buildMapPinStageSelectHtml(slug: string, stage: LeadStage): string {
  const color = mapPinStageColor(stage);
  const options = LEAD_STAGES.map((s) => {
    const optionColor = mapPinStageColor(s);
    return `<option value="${escapeHtml(s)}"${s === stage ? " selected" : ""} style="background-color:${optionColor};color:#fff;">${escapeHtml(LEAD_STAGE_LABELS[s])}</option>`;
  }).join("");
  return `<div class="map-pin-stage-row" style="margin-top:8px;">
    <label style="display:block;font-size:11px;font-weight:600;color:#475569;margin-bottom:4px;">Lead stage</label>
    <div style="position:relative;">
      <span class="map-pin-stage-dot" aria-hidden="true" style="position:absolute;left:8px;top:50%;transform:translateY(-50%);width:10px;height:10px;border-radius:9999px;background:${color};border:2px solid #fff;box-shadow:0 0 0 1px rgba(15,23,42,0.2);pointer-events:none;z-index:1;"></span>
      <select class="map-pin-stage-select" data-slug="${escapeHtml(slug)}" style="width:100%;font-size:12px;border:1px solid #cbd5e1;border-left:3px solid ${color};border-radius:6px;padding:4px 8px 4px 26px;background:#fff;color:#0f172a;">
        ${options}
      </select>
    </div>
  </div>`;
}
