"use client";

import { useState } from "react";

export function PrivateProjectSidebarImage({
  projectId,
  imageUrl,
  onChange,
}: {
  projectId: string;
  imageUrl: string | null;
  onChange: (url: string | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function upload(file: File) {
    setBusy(true);
    setError("");
    const body = new FormData();
    body.set("file", file);
    const res = await fetch(`/api/private/projects/${projectId}/sidebar-image`, { method: "POST", body });
    const json = (await res.json().catch(() => ({}))) as { error?: string; sidebarImageUrl?: string | null };
    setBusy(false);
    if (!res.ok) {
      setError(json.error || "Could not upload the image");
      return;
    }
    onChange(json.sidebarImageUrl ?? null);
  }

  async function remove() {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/private/projects/${projectId}/sidebar-image`, { method: "DELETE" });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!res.ok) {
      setError(json.error || "Could not remove the image");
      return;
    }
    onChange(null);
  }

  return (
    <div>
      <p className="text-xs text-slate-400">Sidebar image</p>
      <p className="mt-1 text-[11px] text-slate-500">
        Shown at the top of the client portal sidebar. The house illustration stays until you add a photo.
      </p>
      {imageUrl ? (
        // User-uploaded project photo; served from this app, not a remote optimizer host.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="" className="mt-3 h-28 w-full max-w-xs rounded-xl object-cover" />
      ) : null}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="cursor-pointer rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs text-slate-200 hover:bg-white/[0.08]">
          {busy ? "Saving…" : imageUrl ? "Replace image" : "Upload image"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="sr-only"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void upload(file);
            }}
          />
        </label>
        {imageUrl ? (
          <button type="button" disabled={busy} onClick={() => void remove()} className="text-xs text-red-400 hover:underline disabled:opacity-50">
            Remove
          </button>
        ) : null}
      </div>
      {error ? <p className="mt-2 text-xs text-red-300">{error}</p> : null}
    </div>
  );
}
