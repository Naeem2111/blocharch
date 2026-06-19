import { LEAD_STAGES, type LeadStage } from "@/lib/leads";
import { LEAD_STAGE_LABELS } from "@/lib/lead-stage-ui";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Inline stage dropdown for Leaflet marker popups (vanilla HTML). */
export function buildMapPinStageSelectHtml(slug: string, stage: LeadStage): string {
  const options = LEAD_STAGES.map(
    (s) =>
      `<option value="${escapeHtml(s)}"${s === stage ? " selected" : ""}>${escapeHtml(LEAD_STAGE_LABELS[s])}</option>`
  ).join("");
  return `<div class="map-pin-stage-row" style="margin-top:8px;">
    <label style="display:block;font-size:11px;font-weight:600;color:#475569;margin-bottom:4px;">Lead stage</label>
    <select class="map-pin-stage-select" data-slug="${escapeHtml(slug)}" style="width:100%;font-size:12px;border:1px solid #cbd5e1;border-radius:6px;padding:4px 8px;background:#fff;color:#0f172a;">
      ${options}
    </select>
  </div>`;
}
