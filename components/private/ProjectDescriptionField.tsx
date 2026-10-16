"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { richTextIsEmpty, richTextToHtml, sanitizeRichHtml } from "@/lib/rich-text";

function ToolbarButton({
  label,
  className,
  onClick,
  children,
}: {
  label: string;
  className?: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`rounded px-2 py-1 text-xs text-slate-200 ring-1 ring-white/15 hover:bg-white/10 disabled:opacity-40 ${className ?? ""}`}
    >
      {children}
    </button>
  );
}

export function ProjectDescriptionField({
  value,
  onChange,
  disabled,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const focused = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || focused.current) return;
    const next = richTextToHtml(value);
    if (el.innerHTML !== next) el.innerHTML = next;
  }, [value]);

  function emit() {
    const html = sanitizeRichHtml(ref.current?.innerHTML ?? "");
    onChange(richTextIsEmpty(html) ? "" : html);
  }

  function run(command: string) {
    if (disabled) return;
    ref.current?.focus();
    document.execCommand(command, false);
    emit();
  }

  return (
    <div className="mt-2">
      <div className="mb-1 flex flex-wrap gap-1">
        <ToolbarButton label="Bold" className="font-bold" onClick={() => run("bold")}>
          B
        </ToolbarButton>
        <ToolbarButton label="Italic" className="italic" onClick={() => run("italic")}>
          I
        </ToolbarButton>
        <ToolbarButton label="Underline" className="underline" onClick={() => run("underline")}>
          U
        </ToolbarButton>
        <ToolbarButton label="Bulleted list" onClick={() => run("insertUnorderedList")}>
          • List
        </ToolbarButton>
      </div>
      <div
        ref={ref}
        role="textbox"
        aria-multiline="true"
        aria-label="Project description"
        contentEditable={!disabled}
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onFocus={() => {
          focused.current = true;
        }}
        onBlur={() => {
          focused.current = false;
          emit();
        }}
        onInput={emit}
        className="project-description project-description-editor min-h-52 w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm leading-relaxed text-white outline-none focus:border-brand-500/40"
      />
    </div>
  );
}

export function ProjectDescriptionView({ html }: { html: string }) {
  const safe = richTextToHtml(html);
  if (!safe) return null;
  return <div className="project-description" dangerouslySetInnerHTML={{ __html: safe }} />;
}
