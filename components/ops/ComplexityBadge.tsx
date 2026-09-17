const COMPLEXITY_TONE: Record<string, { background: string; border: string; color: string }> = {
  high: { background: "rgba(139, 92, 246, 0.22)", border: "rgba(167, 139, 250, 0.55)", color: "#ddd6fe" },
  medium: { background: "rgba(245, 158, 11, 0.2)", border: "rgba(251, 191, 36, 0.55)", color: "#fbbf24" },
  low: { background: "rgba(148, 163, 184, 0.16)", border: "rgba(148, 163, 184, 0.45)", color: "#cbd5e1" },
};

export function ComplexityBadge({ value, label }: { value: string; label: string }) {
  const tone = COMPLEXITY_TONE[value] ?? COMPLEXITY_TONE.low;
  return (
    <span
      className="inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold"
      style={{ backgroundColor: tone.background, borderColor: tone.border, color: tone.color }}
    >
      {label}
    </span>
  );
}
