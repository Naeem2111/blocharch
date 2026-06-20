"use client";

import { useEffect, useRef, useState } from "react";
import { ClientAvatar } from "@/components/ops/ClientAvatar";

type ClientLogoUploadProps = {
  clientId?: string | null;
  clientName: string;
  logoUrl?: string | null;
  /** Staged file for create flow (before client exists). */
  pendingFile?: File | null;
  onPendingFile?: (file: File | null) => void;
  onUploaded?: (logoUrl: string) => void;
  onRemoved?: () => void;
  disabled?: boolean;
};

export function ClientLogoUpload({
  clientId,
  clientName,
  logoUrl,
  pendingFile,
  onPendingFile,
  onUploaded,
  onRemoved,
  disabled = false,
}: ClientLogoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!pendingFile) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(pendingFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pendingFile]);

  async function uploadFile(file: File) {
    if (!clientId) {
      onPendingFile?.(file);
      setError("");
      return;
    }

    setBusy(true);
    setError("");
    const body = new FormData();
    body.set("logo", file);
    const r = await fetch(`/api/ops/clients/${encodeURIComponent(clientId)}/logo`, {
      method: "POST",
      body,
    });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) {
      setError(j.error || "Upload failed");
      return;
    }
    onPendingFile?.(null);
    onUploaded?.(j.logoUrl ?? j.client?.logoUrl ?? "");
  }

  async function removeLogo() {
    if (!clientId) {
      onPendingFile?.(null);
      setError("");
      return;
    }
    setBusy(true);
    setError("");
    const r = await fetch(`/api/ops/clients/${encodeURIComponent(clientId)}/logo`, {
      method: "DELETE",
    });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) {
      setError(j.error || "Could not remove logo");
      return;
    }
    onPendingFile?.(null);
    onRemoved?.();
  }

  const displayUrl = previewUrl ?? logoUrl ?? null;
  const hasLogo = !!displayUrl;

  return (
    <div className="flex flex-wrap items-center gap-3 md:col-span-2">
      <ClientAvatar name={clientName || "Client"} logoUrl={displayUrl} size={48} />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-xs font-medium text-slate-400">Client logo</p>
        <p className="text-[11px] text-slate-500">
          Square image recommended (512px). Shown as a circle in Commercial and client lists.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={disabled || busy}
            onClick={() => inputRef.current?.click()}
            className="rounded-lg bg-white/[0.08] px-3 py-1.5 text-xs text-slate-200 hover:bg-white/[0.12] disabled:opacity-50"
          >
            {busy ? "Uploading…" : hasLogo ? "Replace logo" : "Upload logo"}
          </button>
          {hasLogo ? (
            <button
              type="button"
              disabled={disabled || busy}
              onClick={() => void removeLogo()}
              className="text-xs text-slate-500 hover:text-red-300 disabled:opacity-50"
            >
              Remove
            </button>
          ) : null}
        </div>
        {error ? <p className="text-xs text-red-400">{error}</p> : null}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void uploadFile(file);
        }}
      />
    </div>
  );
}

/** Upload a staged logo after client creation. */
export async function uploadClientLogo(clientId: string, file: File): Promise<string | null> {
  const body = new FormData();
  body.set("logo", file);
  const r = await fetch(`/api/ops/clients/${encodeURIComponent(clientId)}/logo`, {
    method: "POST",
    body,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) return null;
  return (j.logoUrl as string) ?? (j.client?.logoUrl as string) ?? null;
}
