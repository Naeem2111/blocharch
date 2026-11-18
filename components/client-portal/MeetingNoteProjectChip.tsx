import { daysUntilDueFromIso, projectDueColor, projectDueFillTextColor } from "@/lib/project-color-scale";

export function MeetingNoteProjectChip({
  name,
  dueDate,
  selected = false,
  onClick,
}: {
  name: string;
  dueDate: string | null;
  selected?: boolean;
  onClick?: () => void;
}) {
  const color = projectDueColor(daysUntilDueFromIso(dueDate));
  const Tag = onClick ? "button" : "span";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className="inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
      style={
        selected
          ? { backgroundColor: color, color: projectDueFillTextColor(color), border: `1px solid ${color}` }
          : { backgroundColor: `${color}26`, color, border: `1px solid ${color}88` }
      }
    >
      {name}
    </Tag>
  );
}
