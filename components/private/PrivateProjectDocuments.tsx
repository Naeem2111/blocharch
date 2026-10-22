"use client";

import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";

type ProjectDocument = {
  id: string;
  title: string;
  originalName: string;
  fileUrl: string;
  clientVisible: boolean;
  category: string | null;
};

const ACCEPT =
  ".pdf,.doc,.docx,.xls,.xlsx,.csv,.zip,.dwg,.heic,.heif,image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif";

export function PrivateProjectDocuments({
  projectId,
  variant = "staff",
}: {
  projectId: string;
  variant?: "staff" | "athlete";
}) {
  const staff = variant === "staff";
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [phases, setPhases] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [title, setTitle] = useState("");
  const [clientVisible, setClientVisible] = useState(false);
  const [category, setCategory] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [itemLoading, setItemLoading] = useState<string | null>(null);
  const [open, setOpen] = useState(staff);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const r = await fetch(`/api/private/projects/${projectId}/documents`);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      setError(j.error || "Could not load documents");
      return;
    }
    setDocuments(j.documents || []);
    setPhases(Array.isArray(j.phases) ? j.phases.filter((name: unknown) => typeof name === "string" && name.trim()) : []);
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
        category: category || "Other",
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
          category: category || "Other",
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
    form.set("category", category || "Other");
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
    setCategory("");
    if (fileRef.current) fileRef.current.value = "";
    const failed = notes.filter((line) => line.includes(": "));
    const saved = notes.filter((line) => !line.includes(": "));
    setError(failed.join(" "));
    setNote(saved.join(" "));
    void load();
  }

  function onDropFiles(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setDragging(false);
    if (uploading) return;
    const files = Array.from(event.dataTransfer.files);
    if (files.length === 0) return;
    void uploadFiles(files);
  }

  async function setDocumentCategory(documentId: string, next: string) {
    setItemLoading(documentId);
    await fetch(`/api/private/projects/${projectId}/documents`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentId, category: next }),
    });
    setItemLoading(null);
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
    <section
      id={staff ? "documents" : undefined}
      className={`${staff ? "card-tool scroll-mt-24 p-5" : "rounded-xl bg-white/[0.02]"} rounded-xl`}
    >
      {staff ? (
        <h2 className="text-sm font-semibold text-white">Documents</h2>
      ) : (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        >
          <span className="text-sm font-semibold text-white">Documents</span>
          <span className="text-[11px] font-medium text-slate-500">{open ? "Hide" : "Show"}</span>
        </button>
      )}
      {open ? (
      <div className={staff ? undefined : "border-t border-white/[0.06] px-4 pb-4"}>
      <p className="mt-1 text-xs text-slate-500">
        {staff
          ? "Drop files here or browse. They stay hidden from the client portal until you publish them. PDF, image, Word, Excel, CSV, ZIP, or drawing — 50 MB max."
          : "Drop drawings, documents, or images for this project. An admin publishes them to the client portal. 50 MB max."}
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
                    Phase
                    <select
                      value={d.category && d.category !== "Other" ? d.category : "Other"}
                      disabled={loading}
                      onChange={(e) => void setDocumentCategory(d.id, e.target.value)}
                      className="rounded-md border border-white/10 bg-[#0c1422] px-2 py-1 text-xs normal-case tracking-normal text-white"
                    >
                      {phases
                        .filter((name) => name !== "Other")
                        .concat(d.category && d.category !== "Other" && !phases.includes(d.category) ? [d.category] : [])
                        .map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      <option value="Other">Other</option>
                    </select>
                  </label>
                  {staff ? (
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
                  ) : null}
                  {staff ? (
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => void removeDocument(d.id)}
                    className="rounded px-2 py-0.5 text-[10px] font-medium text-red-300/80 ring-1 ring-red-500/20 hover:bg-red-500/10 disabled:opacity-50"
                  >
                    Remove
                  </button>
                  ) : null}
                </div>
              </li>
            );
          })
        )}
      </ul>
      <div
        className={`mt-4 space-y-2 rounded-xl border border-dashed px-3 py-3 ${
          dragging ? "border-sky-300 bg-sky-400/15" : "border-white/20 bg-white/[0.02]"
        }`}
        onDragEnter={(event) => {
          if (!Array.from(event.dataTransfer.types).includes("Files")) return;
          event.preventDefault();
          setDragging(true);
        }}
        onDragOver={(event) => {
          if (!Array.from(event.dataTransfer.types).includes("Files")) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        }}
        onDragLeave={(event) => {
          const next = event.relatedTarget;
          if (next instanceof Node && event.currentTarget.contains(next)) return;
          setDragging(false);
        }}
        onDrop={onDropFiles}
      >
        {staff ? (
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Document title (optional, used for a single file)"
            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
          />
        ) : null}
        <label className="flex items-center gap-2 text-xs text-slate-400">
          Documents tab
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-md border border-white/10 bg-[#0c1422] px-2 py-1 text-sm text-white"
          >
            <option value="">Other</option>
            {phases
              .filter((name) => name !== "Other")
              .map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
          </select>
        </label>
        <p className="text-sm text-white">{dragging ? "Drop to upload" : "Drag and drop files here, or browse."}</p>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept={ACCEPT}
          disabled={uploading}
          onChange={(event) => {
            if (staff) return;
            const files = Array.from(event.target.files ?? []);
            event.target.value = "";
            if (files.length > 0) void uploadFiles(files);
          }}
          className="w-full text-xs text-slate-400 file:mr-3 file:rounded-md file:border-0 file:bg-white/[0.08] file:px-3 file:py-1.5 file:text-xs file:text-slate-200"
        />
        <div className="flex flex-wrap items-center gap-3">
          {staff ? (
            <label className="flex items-center gap-2 text-xs text-slate-500">
              <input
                type="checkbox"
                checked={clientVisible}
                onChange={(e) => setClientVisible(e.target.checked)}
                className="h-3.5 w-3.5 accent-brand-400"
              />
              Show on client portal
            </label>
          ) : null}
          {staff ? (
            <button
              type="button"
              disabled={uploading}
              onClick={() => void uploadFiles(Array.from(fileRef.current?.files ?? []))}
              className="rounded-lg bg-brand-500/20 px-3 py-1.5 text-xs font-medium text-brand-200 ring-1 ring-brand-500/30 disabled:opacity-50"
            >
              {uploading ? "Uploading…" : "Upload"}
            </button>
          ) : (
            <span className="text-xs text-slate-500">{uploading ? "Uploading…" : "PDF, image, Word, Excel, CSV, ZIP, or drawing."}</span>
          )}
        </div>
        {note ? <p className="text-xs text-slate-400">{note}</p> : null}
      </div>
      </div>
      ) : null}
    </section>
  );
}
