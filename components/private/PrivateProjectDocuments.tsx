"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type ProjectDocument = {
  id: string;
  title: string;
  originalName: string;
  fileUrl: string;
  clientVisible: boolean;
};

const ACCEPT =
  ".pdf,.doc,.docx,.xls,.xlsx,.csv,.zip,.dwg,.heic,.heif,image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif";

export function PrivateProjectDocuments({ projectId }: { projectId: string }) {
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [title, setTitle] = useState("");
  const [clientVisible, setClientVisible] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [itemLoading, setItemLoading] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const r = await fetch(`/api/private/projects/${projectId}/documents`);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      setError(j.error || "Could not load documents");
      return;
    }
    setDocuments(j.documents || []);
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function uploadOne(file: File, visible: boolean, label: string) {
    const start = await fetch(`/api/private/projects/${projectId}/documents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        intent: "start",
        name: file.name,
        title: label,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
        clientVisible: visible,
      }),
    });
    const started = (await start.json().catch(() => ({}))) as {
      uploadUrl?: string;
      fallback?: boolean;
      error?: string;
    };
    if (start.ok && started.uploadUrl) {
      const put = await fetch(started.uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": file.type || "application/octet-stream",
          "Content-Range": `bytes 0-${Math.max(file.size - 1, 0)}/${file.size}`,
        },
        body: file,
      });
      const created = (await put.json().catch(() => ({}))) as { id?: string };
      if (!put.ok || !created.id) throw new Error("Google Drive did not accept the file");
      const done = await fetch(`/api/private/projects/${projectId}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intent: "complete",
          driveFileId: created.id,
          name: file.name,
          title: label,
          mimeType: file.type || "application/octet-stream",
          sizeBytes: file.size,
          clientVisible: visible,
        }),
      });
      const finished = (await done.json().catch(() => ({}))) as { error?: string };
      if (!done.ok) throw new Error(finished.error || "Could not record the file");
      return;
    }
    if (!started.fallback && !start.ok) {
      if (file.size > 4 * 1024 * 1024) throw new Error(started.error || "Could not start the upload");
    }
    const form = new FormData();
    form.set("file", file);
    form.set("title", label);
    form.set("clientVisible", visible ? "true" : "false");
    const posted = await fetch(`/api/private/projects/${projectId}/documents`, {
      method: "POST",
      body: form,
    });
    const body = (await posted.json().catch(() => ({}))) as { error?: string };
    if (!posted.ok) throw new Error(body.error || started.error || "Could not upload document");
  }

  async function uploadFiles(files: File[]) {
    if (files.length === 0) {
      setError("Choose a file to upload.");
      return;
    }
    setUploading(true);
    setError("");
    setNote("");
    const notes: string[] = [];
    for (const file of files) {
      const label = files.length === 1 && title.trim() ? title.trim() : file.name;
      try {
        await uploadOne(file, clientVisible, label);
        notes.push(`${file.name} uploaded.`);
      } catch (err) {
        notes.push(err instanceof Error ? `${file.name}: ${err.message}` : `Could not upload ${file.name}`);
      }
    }
    setUploading(false);
    setTitle("");
    setClientVisible(false);
    if (fileRef.current) fileRef.current.value = "";
    const failed = notes.filter((line) => line.includes(": "));
    const saved = notes.filter((line) => !line.includes(": "));
    setError(failed.join(" "));
    setNote(saved.join(" "));
    void load();
  }

  async function toggleVisible(documentId: string, next: boolean) {
    setItemLoading(documentId);
    await fetch(`/api/private/projects/${projectId}/documents`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentId, clientVisible: next }),
    });
    setItemLoading(null);
    void load();
  }

  async function removeDocument(documentId: string) {
    if (!confirm("Remove this document?")) return;
    setItemLoading(documentId);
    await fetch(`/api/private/projects/${projectId}/documents`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentId }),
    });
    setItemLoading(null);
    void load();
  }

  return (
    <section id="documents" className="card-tool scroll-mt-24 rounded-xl p-5">
      <h2 className="text-sm font-semibold text-white">Documents</h2>
      <p className="mt-1 text-xs text-slate-500">
        Files go to this client&apos;s Google Drive folder and stay hidden until you publish them. PDF, image,
        Word, Excel, CSV, ZIP, or drawing — 50 MB max.
      </p>
      {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
      <ul className="mt-3 space-y-2">
        {documents.length === 0 ? (
          <li className="text-sm text-slate-500">No documents yet.</li>
        ) : (
          documents.map((d) => {
            const loading = itemLoading === d.id;
            return (
              <li
                key={d.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/[0.03] px-3 py-2 ring-1 ring-white/[0.06]"
              >
                <div className="min-w-0">
                  <a href={d.fileUrl} target="_blank" rel="noreferrer" className="text-sm text-slate-200 hover:text-brand-300">
                    {d.title}
                  </a>
                  <p className="text-[11px] text-slate-500">{d.originalName}</p>
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-500">
                    <input
                      type="checkbox"
                      checked={d.clientVisible}
                      disabled={loading}
                      onChange={(e) => void toggleVisible(d.id, e.target.checked)}
                      className="h-3.5 w-3.5 accent-brand-400"
                    />
                    Show on portal
                  </label>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => void removeDocument(d.id)}
                    className="rounded px-2 py-0.5 text-[10px] font-medium text-red-300/80 ring-1 ring-red-500/20 hover:bg-red-500/10 disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              </li>
            );
          })
        )}
      </ul>
      <div className="mt-4 space-y-2 border-t border-white/[0.06] pt-4">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Document title (optional, used for a single file)"
          className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
        />
        <input
          ref={fileRef}
          type="file"
          multiple
          accept={ACCEPT}
          disabled={uploading}
          className="w-full text-xs text-slate-400 file:mr-3 file:rounded-md file:border-0 file:bg-white/[0.08] file:px-3 file:py-1.5 file:text-xs file:text-slate-200"
        />
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-slate-500">
            <input
              type="checkbox"
              checked={clientVisible}
              onChange={(e) => setClientVisible(e.target.checked)}
              className="h-3.5 w-3.5 accent-brand-400"
            />
            Show on client portal
          </label>
          <button
            type="button"
            disabled={uploading}
            onClick={() => void uploadFiles(Array.from(fileRef.current?.files ?? []))}
            className="rounded-lg bg-brand-500/20 px-3 py-1.5 text-xs font-medium text-brand-200 ring-1 ring-brand-500/30 disabled:opacity-50"
          >
            {uploading ? "Uploading…" : "Upload"}
          </button>
        </div>
        {note ? <p className="text-xs text-slate-400">{note}</p> : null}
      </div>
    </section>
  );
}
