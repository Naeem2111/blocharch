"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";

type Variant = "link" | "danger";

export function PrivateDeleteProjectButton({
  projectId,
  projectName,
  onDeleted,
  variant = "link",
}: {
  projectId: string;
  projectName: string;
  onDeleted: () => void | Promise<void>;
  variant?: Variant;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function confirmDelete() {
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`/api/private/projects/${projectId}`, { method: "DELETE" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError((j as { error?: string }).error || "Could not delete project");
        return;
      }
      setOpen(false);
      await onDeleted();
    } catch {
      setError("Could not delete project");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError("");
          setOpen(true);
        }}
        className={
          variant === "danger"
            ? "rounded-lg px-4 py-2.5 text-sm font-semibold text-red-300 ring-1 ring-red-500/30 hover:bg-red-500/10"
            : "text-left text-xs text-red-400 hover:text-red-300"
        }
      >
        Delete project
      </button>
      <ConfirmDialog
        open={open}
        title="Delete this project?"
        body={`“${projectName}” will be permanently removed, including updates, documents, expenses, and hour logs. The client record stays. This cannot be undone.`}
        confirmLabel="Delete project"
        busy={busy}
        error={error}
        onConfirm={() => void confirmDelete()}
        onClose={() => {
          if (!busy) setOpen(false);
        }}
      />
    </>
  );
}
