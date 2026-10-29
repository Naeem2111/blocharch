"use client";

import { useEffect, useMemo, useState } from "react";
import type { PrivateDesignStage } from "@prisma/client";
import { ClientPortalBrandMark } from "@/components/client-portal/ClientPortalBrandMark";
import { ProjectDescriptionView } from "@/components/private/ProjectDescriptionField";
import { PRIVATE_STAGE_CLIENT_COPY } from "@/lib/private-constants";

type PortalData = NonNullable<
  Awaited<ReturnType<typeof import("@/lib/private-public-portal").getPublicPrivateProjectBySlug>>
>;
type Stage = PortalData["stages"][number];
type View = "overview" | "journey" | "actions" | "documents";
type ActionItem = PortalData["actionItems"][number];
type CompletedActionItem = PortalData["completedActionItems"][number];
type PortalDocument = PortalData["documents"][number];

const STAGE_BODY: Partial<Record<PrivateDesignStage, string>> = {
  design_review:
    "We're refining the concept design in more detail based on your feedback, finalising layouts, materials and key design decisions before moving to design development.",
  design_development:
    "We'll develop the design in more detail, finalise specifications and prepare for council submission.",
};

const STAGE_FOCUS: Record<PrivateDesignStage, string[]> = {
  site_measure_up: ["Measure the existing site", "Confirm access and levels", "Record the conditions that affect the design"],
  existing_drawings: ["Draw the building as it stands", "Check dimensions against the survey", "Prepare a base for the concept"],
  concept_design: ["Explore layout options", "Set the design direction", "Prepare the concept for your review"],
  design_review: [
    "Review updated drawings",
    "Confirm layout and design direction",
    "Discuss finishes and materials",
    "Resolve outstanding queries",
  ],
  design_development: ["Develop the design in more detail", "Finalise specifications", "Prepare for council submission"],
  council_submission_docs: ["Complete the submission drawings", "Assemble the council pack", "Confirm the documents before lodgement"],
  council_review: ["Council reviews the submission", "We reply if they ask for more information", "Nothing is needed from you unless we ask"],
  council_approved: ["The design is approved", "Construction follows as a separate phase"],
};

const PORTAL_UPLOAD_ACCEPT =
  ".pdf,.jpg,.jpeg,.png,.webp,.gif,.doc,.docx,.xls,.xlsx,application/pdf,image/*";

const PORTAL_UPLOAD_EXTENSIONS = new Set([
  "pdf",
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "doc",
  "docx",
  "xls",
  "xlsx",
]);

function isPortalUploadFile(file: File) {
  const ext = file.name.includes(".") ? file.name.split(".").pop()!.toLowerCase() : "";
  if (PORTAL_UPLOAD_EXTENSIONS.has(ext)) return true;
  const mime = file.type.toLowerCase();
  return mime === "application/pdf" || mime.startsWith("image/");
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(Date.UTC(y, m - 1, d))
    .toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
    .replace(/\bSep\b/, "Sept");
}

function formatBytes(n: number) {
  if (!n) return "—";
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function fileKind(doc: PortalDocument) {
  const mime = doc.mimeType ?? "";
  if (mime.includes("pdf") || doc.title.toLowerCase().endsWith(".pdf")) return "PDF";
  if (mime.startsWith("image/")) return "Image";
  return "File";
}

function documentPhase(doc: { title: string; category?: string | null }) {
  return doc.category?.trim() || documentCategory(doc.title);
}

function documentCategory(title: string) {
  const t = title.toLowerCase();
  if (t.includes("council")) return "Council submission";
  if (t.includes("concept")) return "Concept design";
  if (t.includes("development")) return "Design development";
  if (t.includes("review") || t.includes("finish") || t.includes("material")) return "Design review";
  if (t.includes("site") || t.includes("existing") || t.includes("photo") || t.includes("survey")) return "Site information";
  return "Other";
}

function linkKind(url: string | null, label?: string): "zoom" | "pinterest" | "link" {
  const value = `${url ?? ""} ${label ?? ""}`.toLowerCase();
  if (/\bzoom\b|zoom\.us|zoom\.com|zoomgov\.com/.test(value)) return "zoom";
  if (/pinterest|pin\.it/.test(value)) return "pinterest";
  return "link";
}

function splitLinkLabel(label: string, url?: string | null) {
  const parts = label.split(/\s+[|—–-]\s+/);
  if (parts.length < 2) {
    let subtitle = "Open link";
    if (url) {
      try {
        subtitle = new URL(url).host.replace(/^www\./, "");
      } catch {
        subtitle = "Open link";
      }
    }
    return { title: label, subtitle };
  }
  return { title: parts[0]!, subtitle: parts.slice(1).join(" · ") };
}

function stageBody(stage: PrivateDesignStage) {
  return STAGE_BODY[stage] ?? PRIVATE_STAGE_CLIENT_COPY[stage].current;
}

function displayAddress(value: string) {
  const titled = value
    .toLowerCase()
    .replace(/(^|\s)([a-z])/g, (_, space: string, letter: string) => space + letter.toUpperCase());
  return titled.replace(/\b(\d+)([a-z])\b/g, (_, digits: string, letter: string) => digits + letter.toUpperCase());
}


function typeLine(label: string) {
  return label === "Residential extension" ? "Private residential project" : label;
}

function DescriptionBody({ text }: { text: string }) {
  return (
    <div className="text-sm leading-relaxed text-slate-300">
      <ProjectDescriptionView html={text} />
    </div>
  );
}

function cardClass() {
  return "rounded-2xl border border-white/[0.08] bg-[#0c1524]";
}

function viewForUpdate(kind: string): View {
  if (kind === "file") return "documents";
  if (kind === "action" || kind === "action_done") return "actions";
  if (kind === "stage" || kind === "date") return "journey";
  return "overview";
}

function RecentUpdates({ updates, limit }: { updates: PortalData["updates"]; limit?: number }) {
  const rows = limit ? updates.slice(0, limit) : updates;
  if (rows.length === 0) {
    return <p className="mt-4 text-sm text-slate-500">Updates will show here as the project moves.</p>;
  }
  const blueFrom = Math.ceil(rows.length / 2);
  return (
    <ol className="mt-4">
      {rows.map((update, i) => {
        const blue = i >= blueFrom;
        const nextBlue = i + 1 >= blueFrom;
        const lineTone = nextBlue ? "bg-sky-400" : "bg-emerald-700";
        return (
          <li key={update.id} className="flex items-start gap-3 sm:items-center">
            <div className="relative flex w-5 shrink-0 justify-center self-stretch">
              {i < rows.length - 1 ? (
                <span aria-hidden className={`absolute left-1/2 top-5 w-0.5 -translate-x-1/2 ${lineTone}`} style={{ bottom: "-0.35rem" }} />
              ) : null}
              <span
                className={`relative z-10 mt-3 size-3.5 shrink-0 rounded-full border-[2.5px] bg-white ${blue ? "border-sky-400" : "border-emerald-700"}`}
              />
            </div>
            <div className="min-w-0 flex-1 py-2.5 sm:flex sm:items-center sm:gap-3">
              <p className="text-xs text-slate-300 sm:w-[7.25rem] sm:shrink-0 sm:text-sm sm:text-white">
                {formatDate(update.occurredAt)}
              </p>
              <p className="mt-0.5 text-sm text-white sm:mt-0">{update.title}</p>
            </div>
            <span className="shrink-0 self-center text-sm text-white/70" aria-hidden>
              ›
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function PrivateClientPortalClient({ slug, data }: { slug: string; data: PortalData }) {
  const { project, stages } = data;
  const [updates, setUpdates] = useState(data.updates);
  const [portalDocuments, setPortalDocuments] = useState(data.documents ?? []);
  const [view, setView] = useState<View>("overview");
  const [actionTab, setActionTab] = useState<"required" | "completed">("required");
  const [actionItems, setActionItems] = useState<ActionItem[]>(data.actionItems);
  const [completedActionItems, setCompletedActionItems] = useState<CompletedActionItem[]>(data.completedActionItems);
  const [completing, setCompleting] = useState<string | null>(null);
  const [openCompleted, setOpenCompleted] = useState<string | null>(completedActionItems[0]?.id ?? null);
  const [showCompletedOnOverview, setShowCompletedOnOverview] = useState(false);
  const [noticesOpen, setNoticesOpen] = useState(false);
  const [noticeTop, setNoticeTop] = useState(96);
  const [docQuery, setDocQuery] = useState("");
  const [docFilter, setDocFilter] = useState("All documents");
  const [docSort, setDocSort] = useState<"newest" | "oldest">("newest");
  const [docMenu, setDocMenu] = useState<string | null>(null);
  const [docDetails, setDocDetails] = useState<PortalDocument | null>(null);
  const [uploadNote, setUploadNote] = useState("");
  const [uploading, setUploading] = useState(false);

  const current = stages.find((s) => s.state === "current") ?? stages[0];
  const next = current ? stages.find((s) => s.number === current.number + 1) ?? null : null;
  const subtitle = typeLine(project.projectTypeLabel);

  const notices = useMemo(
    () =>
      updates.slice(0, 8).map((update) => ({
        id: update.id,
        kind: update.kind,
        title: update.title,
        detail: update.body?.trim() || formatDate(update.occurredAt),
        cta: "View update",
        view: viewForUpdate(update.kind),
      })),
    [updates],
  );

  const [readIds, setReadIds] = useState<string[]>([]);
  const unread = notices.filter((item) => !readIds.includes(item.id));

  const docFilters = useMemo(() => {
    const phases = stages.map((stage) => stage.label).filter((label) => label && label !== "Other");
    return ["All documents", ...Array.from(new Set(phases)), "Other"];
  }, [stages]);

  const visibleDocs = useMemo(() => {
    const q = docQuery.trim().toLowerCase();
    const phases = new Set(stages.map((stage) => stage.label));
    const rows = portalDocuments.filter((doc) => {
      const category = documentPhase(doc);
      const matchesFilter =
        docFilter === "All documents" ||
        (docFilter === "Other" ? category === "Other" || !phases.has(category) : category === docFilter);
      return matchesFilter && (!q || doc.title.toLowerCase().includes(q));
    });
    return [...rows].sort((a, b) =>
      docSort === "newest" ? b.createdAt.localeCompare(a.createdAt) : a.createdAt.localeCompare(b.createdAt),
    );
  }, [docFilter, docQuery, docSort, portalDocuments, stages]);

  async function completeAction(actionItemId: string, opts?: { confirmUpload?: boolean }) {
    setCompleting(actionItemId);
    try {
      const r = await fetch(`/api/private/portal/${slug}/actions`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionItemId, confirmUpload: opts?.confirmUpload === true }),
      });
      if (!r.ok) {
        const body = (await r.json().catch(() => ({}))) as { error?: string };
        setUploadNote(body.error || "Could not complete this action.");
        return false;
      }
      const j = (await r.json()) as {
        actionItem: {
          id: string;
          title: string;
          completedAt: string;
          requiresUpload?: boolean;
          documents?: PortalDocument[];
        };
        update?: PortalData["updates"][number];
      };
      if (j.update) {
        setUpdates((prev) => (prev.some((row) => row.id === j.update!.id) ? prev : [j.update!, ...prev]));
      }
      setActionItems((prev) => prev.filter((a) => a.id !== actionItemId));
      setCompletedActionItems((prev) => [
        {
          id: j.actionItem.id,
          title: j.actionItem.title,
          requiresUpload: Boolean(j.actionItem.requiresUpload),
          completedAt: j.actionItem.completedAt.slice(0, 10),
          documents: j.actionItem.documents ?? [],
        },
        ...prev,
      ]);
      if (opts?.confirmUpload) {
        setActionTab("completed");
        setUploadNote("Files saved to Documents and this action is complete.");
      }
      setOpenCompleted(j.actionItem.id);
      return true;
    } finally {
      setCompleting(null);
    }
  }

  function openNotice(item: (typeof notices)[number]) {
    setReadIds((prev) => (prev.includes(item.id) ? prev : [...prev, item.id]));
    setView(item.view);
    if (item.view === "actions") setActionTab(item.kind === "action_done" ? "completed" : "required");
    setNoticesOpen(false);
  }

  async function postPortalMultipart(file: File, actionItemId?: string) {
    const form = new FormData();
    form.set("file", file);
    form.set("title", file.name);
    if (actionItemId) form.set("actionItemId", actionItemId);
    const posted = await fetch(`/api/private/portal/${slug}/documents`, { method: "POST", body: form });
    const body = (await posted.json().catch(() => ({}))) as { error?: string; document?: PortalDocument };
    if (!posted.ok || !body.document) throw new Error(body.error || "Upload failed");
    setPortalDocuments((prev) => [body.document!, ...prev.filter((doc) => doc.id !== body.document!.id)]);
    return body.document;
  }

  async function uploadPortalFiles(files: File[], actionItemId?: string) {
    if (files.length === 0) return false;
    const notes: string[] = [];
    const queue = files.filter((file) => {
      if (isPortalUploadFile(file)) return true;
      notes.push(`${file.name} is not a supported document or image.`);
      return false;
    });
    if (queue.length === 0) {
      setUploadNote(notes.join(" "));
      return false;
    }
    setUploading(true);
    setUploadNote("");
    let okCount = 0;
    for (const file of queue) {
      if (file.size > 50 * 1024 * 1024) {
        notes.push(`${file.name} is over 50 MB.`);
        continue;
      }
      try {
        const start = await fetch(`/api/private/portal/${slug}/documents`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            intent: "start",
            name: file.name,
            mimeType: file.type || "application/octet-stream",
            sizeBytes: file.size,
            actionItemId,
          }),
        });
        const started = (await start.json().catch(() => ({}))) as {
          uploadUrl?: string;
          fallback?: boolean;
          error?: string;
        };

        const uploadUrl = started.uploadUrl;
        const useMultipart = !start.ok || !uploadUrl || started.fallback;
        if (useMultipart) {
          await postPortalMultipart(file, actionItemId);
          notes.push(`${file.name} saved to your project folder.`);
          okCount += 1;
          continue;
        }

        try {
          const put = await fetch(uploadUrl, {
            method: "PUT",
            headers: {
              "Content-Type": file.type || "application/octet-stream",
              "Content-Range": `bytes 0-${Math.max(file.size - 1, 0)}/${file.size}`,
            },
            body: file,
          });
          const created = (await put.json().catch(() => ({}))) as { id?: string };
          if (!put.ok || !created.id) throw new Error("Google Drive did not accept the file");
          const done = await fetch(`/api/private/portal/${slug}/documents`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              intent: "complete",
              driveFileId: created.id,
              name: file.name,
              title: file.name,
              mimeType: file.type || "application/octet-stream",
              sizeBytes: file.size,
              actionItemId,
            }),
          });
          const finished = (await done.json().catch(() => ({}))) as { error?: string; document?: PortalDocument };
          if (!done.ok || !finished.document) throw new Error(finished.error || "Could not record the file");
          setPortalDocuments((prev) => [finished.document!, ...prev.filter((doc) => doc.id !== finished.document!.id)]);
          notes.push(`${file.name} saved to your Google Drive folder.`);
          okCount += 1;
        } catch {
          // Browser PUT to Drive often fails CORS ("Failed to fetch") — upload through our API instead.
          await postPortalMultipart(file, actionItemId);
          notes.push(`${file.name} saved to your project folder.`);
          okCount += 1;
        }
      } catch (error) {
        notes.push(error instanceof Error ? `${file.name}: ${error.message}` : `Could not upload ${file.name}`);
      }
    }
    setUploadNote(notes.join(" "));
    setUploading(false);
    return okCount > 0 && okCount === queue.length;
  }

  const renderNotices = (shape: "round" | "square" = "round") => (
    <div className="relative">
      <button
        type="button"
        aria-label={unread.length > 0 ? `Notifications, ${unread.length} unread` : "Notifications"}
        onClick={(event) => {
          const bottom = event.currentTarget.getBoundingClientRect().bottom;
          setNoticeTop(bottom + 8);
          setNoticesOpen((open) => !open);
        }}
        className={
          shape === "square"
            ? unread.length > 0
              ? "portal-bell-live relative flex h-8 w-8 items-center justify-center rounded-md p-0 [&_svg]:!h-4 [&_svg]:!w-4"
              : "relative flex h-8 w-8 items-center justify-center rounded-md p-0 text-slate-300 hover:bg-white/[0.06] [&_svg]:h-4 [&_svg]:w-4"
            : unread.length > 0
              ? "portal-bell-live relative rounded-full p-2.5"
              : "relative rounded-full p-2 text-slate-300 hover:bg-white/[0.06]"
        }
      >
        <BellIcon />
        {unread.length > 0 ? (
          <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-red-500 shadow-[0_0_8px_rgb(239,68,68,0.95)]" />
        ) : null}
      </button>
      {noticesOpen ? (
        <div
          className="fixed left-4 right-4 top-[var(--notice-top)] z-40 max-h-[70vh] overflow-y-auto rounded-2xl border border-white/[0.08] bg-[#0c1422] p-4 shadow-2xl sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-2 sm:max-h-none sm:w-[min(24rem,calc(100vw-2rem))]"
          style={{ ["--notice-top" as string]: `${noticeTop}px` }}
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-white">
              Notifications{" "}
              {unread.length > 0 ? (
                <span className="ml-1 rounded-full bg-sky-500/20 px-2 py-0.5 text-[11px] text-sky-300">
                  {unread.length} new
                </span>
              ) : null}
            </p>
            <div className="flex items-center gap-3 text-xs">
              <button
                type="button"
                className="text-sky-300 hover:underline"
                onClick={() => setReadIds(notices.map((item) => item.id))}
              >
                Mark all as read
              </button>
              <button type="button" className="text-slate-400" onClick={() => setNoticesOpen(false)} aria-label="Close">
                ×
              </button>
            </div>
          </div>
          <ul className="mt-3 space-y-2">
            {notices.length === 0 ? (
              <li className="py-4 text-sm text-slate-500">No notifications yet.</li>
            ) : (
              notices.map((item) => (
                <li key={item.id} className="rounded-xl border border-white/[0.1] bg-white/[0.03] px-3 py-2.5">
                  <div className="flex items-start gap-3">
                    <NoticeIcon kind={item.kind} unread={!readIds.includes(item.id)} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-white">{item.title}</p>
                      <p className="text-xs text-slate-500">{item.detail}</p>
                    </div>
                    <button type="button" className="shrink-0 text-xs text-sky-300 hover:underline" onClick={() => openNotice(item)}>
                      {item.cta} →
                    </button>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );

  return (
    <div className="flex min-h-screen bg-[#071018] text-slate-100">
      <aside className="sticky top-0 hidden h-screen w-[16.5rem] shrink-0 flex-col border-r border-white/[0.06] bg-[#08101c] lg:flex">
        <div className="px-5 pb-2 pt-5">
          <ClientPortalBrandMark />
        </div>
        <ProjectArt src={project.sidebarImageUrl} />
        <div className="px-5 pb-6 pt-4">
          <p className="text-sm font-semibold leading-snug text-white">{displayAddress(project.address)}</p>
          <p className="mt-2 text-xs leading-relaxed text-slate-400">{subtitle}</p>
        </div>
        <p className="px-5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Your project</p>
        <nav className="mt-2 space-y-1 px-3">
          <NavButton active={view === "overview"} label="Overview" onClick={() => setView("overview")} icon="home" />
          <NavButton active={view === "journey"} label="Project Journey" onClick={() => setView("journey")} icon="clock" />
          <NavButton
            active={view === "actions"}
            label="Actions"
            badge={actionItems.length}
            onClick={() => setView("actions")}
            icon="check"
          />
          <NavButton active={view === "documents"} label="Documents" onClick={() => setView("documents")} icon="doc" />
        </nav>
      </aside>

      <div className="min-w-0 flex-1">
        <div className="border-b border-white/[0.06] lg:border-0">
        <div className="px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] lg:hidden">
          <div className="grid grid-cols-[minmax(0,34%)_minmax(0,1fr)] gap-x-2.5 gap-y-1.5">
            <div className="row-start-1 h-full min-h-[4.75rem] min-w-0 overflow-hidden">
              <ProjectArt src={project.sidebarImageUrl} placement="side" />
            </div>
            <nav className="row-start-1 grid min-w-0 grid-cols-1 gap-1.5" aria-label="Project sections">
              {(["overview", "journey", "actions", "documents"] as const).map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setView(id)}
                  className={`flex h-10 min-w-0 items-center justify-center rounded-lg px-3 text-center text-xs font-medium leading-none whitespace-nowrap ${view === id ? "bg-sky-500 text-slate-950" : "bg-white/[0.08] text-slate-100"}`}
                >
                  {id === "overview" ? "Overview" : id === "journey" ? "Project Journey" : id === "actions" ? "Actions" : "Documents"}
                </button>
              ))}
            </nav>
            <div className="col-start-2 flex justify-end">{renderNotices("square")}</div>
          </div>
        </div>
        <header className="hidden items-center justify-end gap-2 px-8 py-3 lg:flex">
          {renderNotices()}
        </header>
        </div>

        <main className="px-4 pb-16 sm:px-8">
          <PageHeading view={view} address={project.address} subtitle={subtitle} />
          {view === "overview" ? (
            <Overview
              project={project}
              stages={stages}
              current={current}
              next={next}
              updates={updates}
              documents={portalDocuments}
              actionItems={actionItems}
              completedActionItems={completedActionItems}
              showCompleted={showCompletedOnOverview}
              onToggleCompleted={() => setShowCompletedOnOverview((open) => !open)}
              onOpenActions={() => {
                setActionTab("required");
                setView("actions");
              }}
              onOpenDocuments={() => setView("documents")}
              subtitle={subtitle}
            />
          ) : null}
          {view === "journey" && current ? (
            <Journey project={project} stages={stages} current={current} next={next} updates={updates} onOpenOverview={() => setView("overview")} />
          ) : null}
          {view === "actions" ? (
            <Actions
              tab={actionTab}
              onTab={setActionTab}
              actionItems={actionItems}
              completed={completedActionItems}
              openCompleted={openCompleted}
              onToggleCompleted={(id) => setOpenCompleted((currentId) => (currentId === id ? null : id))}
              completing={completing}
              uploading={uploading}
              uploadNote={uploadNote}
              onComplete={(id) => void completeAction(id)}
              onSubmitUpload={async (id, files) => {
                const uploaded = await uploadPortalFiles(files, id);
                if (!uploaded) return false;
                return Boolean(await completeAction(id, { confirmUpload: true }));
              }}
            />
          ) : null}
          {view === "documents" ? (
            <Documents
              docs={visibleDocs}
              query={docQuery}
              onQuery={setDocQuery}
              filters={docFilters}
              filter={docFilter}
              onFilter={setDocFilter}
              sort={docSort}
              onSort={setDocSort}
              menuId={docMenu}
              onMenu={setDocMenu}
              details={docDetails}
              onDetails={setDocDetails}
            />
          ) : null}
        </main>
      </div>
    </div>
  );
}

function PageHeading({
  view,
  address,
  subtitle,
}: {
  view: View;
  address: string;
  subtitle: string;
}) {
  const label = view === "actions" ? "Actions" : view === "documents" ? "Documents" : view === "journey" ? "Project journey" : null;
  return (
    <div className="mb-5">
      {label ? <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-300">{label}</p> : null}
      <h1 className="text-xl font-semibold leading-tight tracking-tight text-white sm:text-[2rem]">{displayAddress(address)}</h1>
      <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
    </div>
  );
}

function Overview({
  project,
  stages,
  current,
  next,
  updates,
  documents,
  actionItems,
  completedActionItems,
  showCompleted,
  onToggleCompleted,
  onOpenActions,
  onOpenDocuments,
  subtitle,
}: {
  project: PortalData["project"];
  stages: Stage[];
  current: Stage | undefined;
  next: Stage | null;
  updates: PortalData["updates"];
  documents: PortalDocument[];
  actionItems: ActionItem[];
  completedActionItems: CompletedActionItem[];
  showCompleted: boolean;
  onToggleCompleted: () => void;
  onOpenActions: () => void;
  onOpenDocuments: () => void;
  subtitle: string;
}) {
  return (
    <div className="min-w-0 space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <Metric icon="cal" label="Brief received" value={formatDate(project.briefReceivedAt)} />
        <Metric icon="dot" label="Current stage" value={current?.label ?? project.designStageLabel} hint={current ? `Step ${current.number} of ${stages.length}` : undefined} emphasis />
        <Metric icon="cal" label="Target next stage" value={next?.label ?? "—"} hint={next?.dateFrom ? formatDate(next.dateFrom) : "To be confirmed"} />
      </div>

      <div className="grid items-stretch gap-3 xl:grid-cols-3">
        <section className={`${cardClass()} p-4`}>
          <CardTitle icon="doc">Project description</CardTitle>
          <div className="mt-3">
            <DescriptionBody
              text={
                project.clientDescription?.trim() ||
                `Your Blocharch client portal gives you a live view of this ${subtitle.toLowerCase()}. Track the current stage, open actions, and documents as they are shared.`
              }
            />
          </div>
        </section>
        <section className={`${cardClass()} flex flex-col p-4`}>
          <CardTitle icon="link">Quick links</CardTitle>
          <p className="mt-1 text-xs text-white">Access important project resources.</p>
          <ul className="mt-3 space-y-2">
            {project.clientLinks.length === 0 ? <li className="text-sm text-white">Links will appear here once they are added.</li> : null}
            {project.clientLinks.map((link, i) => {
              const parts = splitLinkLabel(link.label.replace(/^🔗\s*/, ""), link.url);
              const kind = linkKind(link.url, link.label);
              return (
                <li key={`${link.label}-${i}`}>
                  <a
                    href={link.url ?? "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 rounded-xl border border-white/[0.1] bg-white/[0.03] px-3 py-2.5 hover:bg-white/[0.06]"
                  >
                    <LinkGlyph kind={kind} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-white">{parts.title}</span>
                      <span className="block truncate text-xs text-white">{parts.subtitle}</span>
                    </span>
                    <ExternalIcon />
                  </a>
                </li>
              );
            })}
          </ul>
        </section>
        <section className={`${cardClass()} flex flex-col p-4`}>
          <CardTitle icon="team">Project team</CardTitle>
          <p className="mt-1 text-xs text-white">Your main points of contact.</p>
          <ul className="mt-3 space-y-2">
            {project.team.length === 0 ? <li className="text-sm text-white">The project team will appear here once assigned.</li> : null}
            {project.team.map((member) => (
              <li
                key={member.id}
                className="flex items-center gap-3 rounded-xl border border-white/[0.1] bg-white/[0.03] px-3 py-2.5"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-xs font-semibold text-slate-200 ring-1 ring-white/10">
                  {member.initials}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-white">{member.fullName}</span>
                  {member.role ? <span className="block text-xs text-white">{member.role}</span> : null}
                </span>
                {member.email ? (
                  <a href={`mailto:${member.email}`} className="text-slate-400 hover:text-white" aria-label={`Email ${member.fullName}`}>
                    <MailIcon />
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      </div>

      {current ? (
        <section className="private-portal-hero min-w-0 overflow-hidden rounded-2xl p-4 sm:p-8">
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_1px_15rem] sm:gap-0 sm:items-stretch">
            <div className="sm:pr-7">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-300 sm:text-sm sm:tracking-[0.2em] [text-shadow:0_0_18px_rgba(56,189,248,0.55)]">Current stage</p>
              <h2 className="mt-2 text-2xl font-bold leading-tight text-white sm:text-4xl">{current.label}</h2>
              <div className="mt-3 flex flex-wrap items-center gap-2.5 text-sm">
                <span className="rounded-full bg-sky-500/20 px-3 py-1 text-sky-100 ring-1 ring-sky-400/40 shadow-[0_0_16px_rgba(56,189,248,0.35)]">In progress</span>
                <span className="text-white">Step {current.number} of {stages.length}</span>
              </div>
            </div>
            <div className="hidden bg-sky-400/40 sm:block" aria-hidden />
            <div className="sm:pl-7">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-300 [text-shadow:0_0_18px_rgba(56,189,248,0.55)]">Up next</p>
              <p className="mt-2 text-xl font-semibold text-white">{next?.label ?? "—"}</p>
              <p className="mt-1.5 text-base text-white">Target date: {next?.dateFrom ? formatDate(next.dateFrom) : "To be confirmed"}</p>
            </div>
          </div>
          <StageRail stages={stages} />
        </section>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-3">
        <section className={`${cardClass()} p-5`}>
          <h2 className="flex items-center gap-2 border-b border-white/[0.08] pb-3 text-base font-bold text-white">
            <span className="text-white"><BellMini className="h-8 w-8" /></span>
            Recent updates
          </h2>
          <p className="mt-1 text-xs text-slate-500">The latest activity on your project.</p>
          <RecentUpdates updates={updates} limit={6} />
        </section>
        <section className={`${cardClass()} p-5`}>
          <h2 className="flex items-center gap-2 border-b border-white/[0.08] pb-3 text-base font-bold text-white"><span className="text-white"><CheckMini className="h-8 w-8" /></span>Required from you</h2>
          <p className="mt-1 text-xs text-slate-500">Actions and information we need from you.</p>
          <ul className="mt-4 space-y-2">
            {actionItems.length === 0 ? <li className="text-sm text-slate-500">Nothing is waiting on you right now.</li> : null}
            {actionItems.slice(0, 3).map((action) => (
              <li key={action.id} className="flex items-center gap-3 rounded-xl border border-white/[0.1] bg-white/[0.03] px-3 py-2.5 text-sm text-white">
                <span className="h-4 w-4 shrink-0 rounded-full border border-white" />
                <span>{action.title}</span>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={onOpenActions}
            className="mt-2 flex w-full items-center justify-between rounded-xl border border-white/[0.1] bg-white/[0.03] px-3 py-2.5 text-sm text-sky-300 hover:bg-white/[0.06]"
          >
            View all actions
            <span aria-hidden>→</span>
          </button>
          {completedActionItems.length > 0 ? (
            <div className="mt-5 border-t border-white/[0.08] pt-4">
              <button
                type="button"
                onClick={onToggleCompleted}
                aria-expanded={showCompleted}
                className="flex w-full items-center gap-3 rounded-xl px-1 py-1 text-left text-base font-bold text-white hover:bg-white/[0.04]"
              >
                <DoneMark />
                <span className="min-w-0 flex-1">Completed actions ({completedActionItems.length})</span>
                <svg
                  className={`h-7 w-7 shrink-0 text-white transition ${showCompleted ? "rotate-180" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2.4}
                  stroke="currentColor"
                  aria-hidden
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </button>
              {showCompleted ? (
                <ul className="mt-3 space-y-2 text-sm text-white">
                  {completedActionItems.map((action) => (
                    <li key={action.id} className="flex items-center gap-3">
                      <DoneMark />
                      <span className="min-w-0 flex-1">{action.title}</span>
                      <span className="shrink-0 text-xs text-white">{formatDate(action.completedAt)}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </section>
        <section className={`${cardClass()} p-5`}>
          <h2 className="flex items-center gap-2 border-b border-white/[0.08] pb-3 text-base font-bold text-white"><span className="text-white"><FolderMini className="h-8 w-8" /></span>Files for download</h2>
          <p className="mt-1 text-xs text-slate-500">Access and download important project documents.</p>
          <ul className="mt-4 space-y-3">
            {documents.length === 0 ? <li className="text-sm text-slate-500">Documents will appear here when they are shared.</li> : null}
            {documents.slice(0, 3).map((doc) => (
              <li key={doc.id} className="flex items-center gap-3">
                <PdfBadge />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-white">{doc.title}</span>
                  <span className="block text-xs text-slate-500">{formatBytes(doc.sizeBytes)} · {formatDate(doc.createdAt)}</span>
                </span>
                <a href={doc.fileUrl} download className="text-slate-300 hover:text-white" aria-label={`Download ${doc.title}`}>
                  <DownloadIcon />
                </a>
              </li>
            ))}
          </ul>
          <button type="button" onClick={onOpenDocuments} className="mt-4 text-sm text-sky-300 hover:underline">
            View all documents →
          </button>
        </section>
      </div>
    </div>
  );
}

function Journey({
  project,
  stages,
  current,
  next,
  updates,
  onOpenOverview,
}: {
  project: PortalData["project"];
  stages: Stage[];
  current: Stage;
  next: Stage | null;
  updates: PortalData["updates"];
  onOpenOverview: () => void;
}) {
  const focus = STAGE_FOCUS[project.designStage] ?? [];
  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(18rem,0.9fr)]">
      <section className={`${cardClass()} min-w-0 p-4 sm:p-6`}>
        <h2 className="text-base font-semibold text-white sm:text-lg">Project timeline</h2>
        <p className="mt-1 text-xs text-slate-500 sm:text-sm">A step-by-step guide to your project journey.</p>
        <ol className="mt-4 sm:mt-6">
          {stages.map((stage, i) => (
            <li key={stage.key} className="flex gap-3 pb-4 last:pb-0 sm:gap-4 sm:pb-5">
              <div className="relative w-8 shrink-0 self-stretch">
                {i < stages.length - 1 ? (
                  <span
                    aria-hidden
                    className={`absolute left-1/2 top-4 z-0 w-[3px] -translate-x-1/2 bottom-[-2.25rem] ${
                      stage.state === "done" ? "bg-emerald-400" : "bg-[#3e6288]"
                    }`}
                  />
                ) : null}
                <StageDot stage={stage} />
              </div>
              <div className={`min-w-0 flex-1 ${stage.state === "current" ? "private-portal-timeline-current rounded-xl px-4 py-3" : "pt-0.5"}`}>
                <div className="flex flex-col gap-0.5 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                  <p className={stage.state === "current" ? "font-bold text-white" : "font-medium text-white"}>{stage.label}</p>
                  <p className={`text-xs sm:shrink-0 ${stage.state === "current" ? "font-bold text-white" : "text-slate-400"}`}>
                    {stage.dateFrom ? formatDate(stage.dateFrom) : stage.state === "upcoming" ? "To be confirmed" : "—"}
                  </p>
                </div>
                <p
                  className={`text-xs ${
                    stage.state === "done"
                      ? "font-medium text-emerald-400"
                      : stage.state === "current"
                        ? "font-bold text-sky-400"
                        : "text-slate-500"
                  }`}
                >
                  {stage.state === "done"
                    ? "Completed"
                    : stage.state === "current"
                      ? "In progress"
                      : /approval/i.test(stage.label)
                        ? "Final milestone"
                        : "Upcoming"}
                </p>
                {stage.state === "current" ? <p className="mt-1 text-sm text-slate-300">{stageBody(project.designStage)}</p> : null}
              </div>
            </li>
          ))}
        </ol>
      </section>
      <div className="space-y-4">
        <section className="private-portal-hero min-w-0 rounded-2xl p-4 sm:p-7">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-300 [text-shadow:0_0_18px_rgba(56,189,248,0.55)]">
              Current stage details
            </p>
            <span className="rounded-full bg-sky-500/20 px-3 py-1 text-[11px] text-sky-100 ring-1 ring-sky-400/40 shadow-[0_0_16px_rgba(56,189,248,0.35)]">
              In progress
            </span>
          </div>
          <h2 className="mt-3 break-words text-xl font-bold leading-tight text-white sm:text-3xl">{current.label}</h2>
          <p className="mt-1.5 text-sm text-white">Step {current.number} of {stages.length}</p>
          <p className="mt-3 text-sm leading-relaxed text-slate-200">{stageBody(project.designStage)}</p>
          {focus.length > 0 ? (
            <>
              <p className="mt-5 text-sm font-semibold text-white">Key focus areas</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-300">
                {focus.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </>
          ) : null}
        </section>
        {next ? (
          <section className={`${cardClass()} p-5`}>
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white">Next stage</p>
              <span className="text-xs text-white">{next.dateFrom ? formatDate(next.dateFrom) : "To be confirmed"}</span>
            </div>
            <h3 className="mt-3 text-xl font-semibold text-white">{next.label}</h3>
            <p className="mt-1 text-sm text-white">Step {next.number} of {stages.length}</p>
            <p className="mt-3 text-sm leading-relaxed text-slate-400">{PRIVATE_STAGE_CLIENT_COPY[project.designStage].nextHint}</p>
          </section>
        ) : null}
        <section className={`${cardClass()} p-5`}>
          <h2 className="flex items-center gap-2 border-b border-white/[0.08] pb-3 text-base font-bold text-white">
            <span className="text-white"><BellMini className="h-8 w-8" /></span>
            Recent updates
          </h2>
          <RecentUpdates updates={updates} limit={6} />
          <button type="button" onClick={onOpenOverview} className="mt-4 text-sm text-sky-300 hover:underline">
            View all updates →
          </button>
        </section>
      </div>
    </div>
  );
}

function Actions({
  tab,
  onTab,
  actionItems,
  completed,
  openCompleted,
  onToggleCompleted,
  completing,
  uploading,
  uploadNote,
  onComplete,
  onSubmitUpload,
}: {
  tab: "required" | "completed";
  onTab: (tab: "required" | "completed") => void;
  actionItems: ActionItem[];
  completed: CompletedActionItem[];
  openCompleted: string | null;
  onToggleCompleted: (id: string) => void;
  completing: string | null;
  uploading: boolean;
  uploadNote: string;
  onComplete: (id: string) => void;
  onSubmitUpload: (id: string, files: File[]) => Promise<boolean>;
}) {
  const [expandedUploadId, setExpandedUploadId] = useState<string | null>(
    () => actionItems.find((a) => a.requiresUpload)?.id ?? null,
  );
  const [pendingByAction, setPendingByAction] = useState<Record<string, File[]>>({});

  function addPending(actionId: string, files: File[]) {
    const allowed = files.filter((file) => {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      return ["pdf", "png", "jpg", "jpeg"].includes(ext) || /pdf|png|jpe?g/i.test(file.type);
    });
    if (allowed.length === 0) return;
    setPendingByAction((prev) => ({
      ...prev,
      [actionId]: [...(prev[actionId] ?? []), ...allowed],
    }));
  }

  function removePending(actionId: string, index: number) {
    setPendingByAction((prev) => ({
      ...prev,
      [actionId]: (prev[actionId] ?? []).filter((_, i) => i !== index),
    }));
  }

  async function submitUpload(actionId: string) {
    const files = pendingByAction[actionId] ?? [];
    if (files.length === 0) return;
    const ok = await onSubmitUpload(actionId, files);
    if (ok) {
      setPendingByAction((prev) => {
        const next = { ...prev };
        delete next[actionId];
        return next;
      });
      setExpandedUploadId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => onTab("required")}
          className={`rounded-2xl border px-4 py-3 text-sm font-medium ${tab === "required" ? "border-sky-400 bg-sky-500 text-white" : "border-white/10 bg-[#0c1524] text-slate-300"}`}
        >
          Required from you <Count n={actionItems.length} hot />
        </button>
        <button
          type="button"
          onClick={() => onTab("completed")}
          className={`rounded-2xl border px-4 py-3 text-sm font-medium ${tab === "completed" ? "border-sky-400 bg-sky-500 text-white" : "border-white/10 bg-[#0c1524] text-slate-300"}`}
        >
          Completed <Count n={completed.length} />
        </button>
      </div>

      {tab === "required" ? (
        <section className={`${cardClass()} p-5 sm:p-6`}>
          <h2 className="text-xl font-semibold text-white">Your actions</h2>
          <p className="mt-1 text-sm text-slate-400">Actions and information we need from you to keep the project on track.</p>
          <ul className="mt-5 space-y-3">
            {actionItems.length === 0 ? <li className="text-sm text-slate-500">Nothing is waiting on you right now.</li> : null}
            {actionItems.map((action) => {
              if (action.requiresUpload) {
                const open = expandedUploadId === action.id;
                const pending = pendingByAction[action.id] ?? [];
                const busy = uploading || completing === action.id;
                return (
                  <li key={action.id} className="rounded-2xl border border-sky-400/30 bg-sky-400/[0.04] px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setExpandedUploadId((id) => (id === action.id ? null : action.id))}
                      className="flex w-full items-start gap-3 text-left"
                      aria-expanded={open}
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-sky-200 ring-1 ring-sky-400/30">
                        <UploadActionIcon />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-white">{action.title}</span>
                        <span className="mt-1 inline-flex rounded-full border border-sky-400/50 px-2.5 py-0.5 text-[11px] font-medium text-sky-200">
                          Upload requested
                        </span>
                      </span>
                      <span className={`text-slate-400 transition ${open ? "rotate-180" : ""}`} aria-hidden>
                        ▾
                      </span>
                    </button>
                    {open ? (
                      <div className="mt-4 border-t border-white/[0.06] pt-4">
                        <p className="text-sm text-slate-300">Upload the files needed for this action.</p>
                        <label
                          className="mt-3 flex cursor-pointer flex-col items-center rounded-2xl border border-dashed border-sky-400/70 bg-sky-400/[0.04] px-4 py-8 text-center"
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault();
                            if (!busy) addPending(action.id, Array.from(e.dataTransfer.files));
                          }}
                        >
                          <span className="text-sky-300">↑</span>
                          <span className="mt-2 text-sm text-slate-200">
                            Drag & drop files here or <span className="text-sky-300 underline">browse</span>
                          </span>
                          <span className="mt-1 text-xs text-slate-500">PDF, PNG or JPEG · Max 50 MB</span>
                          <input
                            type="file"
                            multiple
                            accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                            className="sr-only"
                            disabled={busy}
                            onChange={(e) => {
                              addPending(action.id, Array.from(e.target.files ?? []));
                              e.target.value = "";
                            }}
                          />
                        </label>
                        {pending.length > 0 ? (
                          <ul className="mt-3 space-y-2">
                            {pending.map((file, index) => (
                              <li
                                key={`${file.name}-${file.size}-${index}`}
                                className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2"
                              >
                                <PdfBadge />
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-sm text-white">{file.name}</span>
                                  <span className="block text-xs text-slate-500">
                                    {formatBytes(file.size)} · Ready to submit
                                  </span>
                                </span>
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => removePending(action.id, index)}
                                  className="text-slate-400 hover:text-white"
                                  aria-label={`Remove ${file.name}`}
                                >
                                  ×
                                </button>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                        <div className="mt-4 flex justify-end">
                          <button
                            type="button"
                            disabled={busy || pending.length === 0}
                            onClick={() => void submitUpload(action.id)}
                            className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-400 disabled:opacity-50"
                          >
                            {busy ? "Submitting…" : "Submit files"}
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </li>
                );
              }
              return (
                <li key={action.id} className="flex items-center gap-3 rounded-2xl border border-sky-400/25 bg-sky-400/[0.04] px-4 py-3">
                  <button
                    type="button"
                    disabled={completing === action.id}
                    onClick={() => onComplete(action.id)}
                    aria-label={`Mark ${action.title} complete`}
                    className="h-5 w-5 shrink-0 rounded-full border border-white hover:border-emerald-400 disabled:opacity-50"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-white">{action.title}</span>
                    <span className="mt-0.5 block text-xs text-slate-400 sm:hidden">Tick to confirm</span>
                  </span>
                  <span className="hidden shrink-0 text-xs text-slate-400 sm:inline">Tick to confirm</span>
                </li>
              );
            })}
          </ul>
          {uploadNote ? <p className="mt-3 text-sm text-slate-400">{uploadNote}</p> : null}
        </section>
      ) : (
        <section className={`${cardClass()} p-5 sm:p-6`}>
          <h2 className="text-xl font-semibold text-white">Completed actions</h2>
          <p className="mt-1 text-sm text-slate-400">A record of actions completed for your project.</p>
          <ul className="mt-5 space-y-3">
            {completed.length === 0 ? <li className="text-sm text-slate-500">Completed actions will be listed here.</li> : null}
            {completed.map((action) => {
              const open = openCompleted === action.id;
              return (
                <li key={action.id} className="rounded-2xl border border-white/[0.08] px-4 py-3">
                  <button type="button" onClick={() => onToggleCompleted(action.id)} className="flex w-full items-center gap-3 text-left">
                    <DoneMark />
                    <span className="min-w-0 flex-1 text-left">
                      <span className="block text-sm font-medium text-white">{action.title}</span>
                      <span className="mt-0.5 block text-xs text-slate-400 sm:hidden">Completed {formatDate(action.completedAt)}</span>
                    </span>
                    <span className="hidden shrink-0 rounded-full border border-white/10 px-2 py-1 text-[11px] text-slate-400 sm:inline">Completed {formatDate(action.completedAt)}</span>
                    <span className="text-slate-500">{open ? "▴" : "▾"}</span>
                  </button>
                  {open ? (
                    <div className="mt-3 space-y-3 border-t border-white/[0.06] pt-3">
                      <p className="text-xs text-slate-500">
                        Recorded by BLOCHARCH · {formatDate(action.completedAt)}
                      </p>
                      {"documents" in action && Array.isArray(action.documents) && action.documents.length > 0 ? (
                        <ul className="space-y-2">
                          {action.documents.map((doc) => (
                            <li key={doc.id}>
                              <a
                                href={doc.fileUrl}
                                download
                                className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 hover:bg-white/[0.06]"
                              >
                                <PdfBadge />
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-sm text-white">{doc.title}</span>
                                  <span className="block text-xs text-slate-500">
                                    {formatBytes(doc.sizeBytes)} · {formatDate(doc.createdAt)}
                                  </span>
                                </span>
                                <DownloadIcon />
                              </a>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

function UploadActionIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
    </svg>
  );
}

function Documents({
  docs,
  query,
  onQuery,
  filters,
  filter,
  onFilter,
  sort,
  onSort,
  menuId,
  onMenu,
  details,
  onDetails,
}: {
  docs: PortalDocument[];
  query: string;
  onQuery: (value: string) => void;
  filters: string[];
  filter: string;
  onFilter: (value: string) => void;
  sort: "newest" | "oldest";
  onSort: (value: "newest" | "oldest") => void;
  menuId: string | null;
  onMenu: (id: string | null) => void;
  details: PortalDocument | null;
  onDetails: (doc: PortalDocument | null) => void;
}) {
  return (
    <div className="rounded-2xl">
      <div className="flex flex-wrap gap-2">
        {filters.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => onFilter(item)}
            className={`rounded-full px-3 py-1.5 text-xs ${filter === item ? "bg-sky-500 text-slate-950" : "bg-white/[0.04] text-slate-300"}`}
          >
            {item}
          </button>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Search documents..."
          className="min-w-[12rem] flex-1 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-slate-600"
        />
        <select
          value={sort}
          onChange={(e) => onSort(e.target.value === "oldest" ? "oldest" : "newest")}
          className="rounded-xl border border-white/[0.08] bg-[#0c1422] px-3 py-2 text-sm text-slate-200"
        >
          <option value="newest">Date (newest first)</option>
          <option value="oldest">Date (oldest first)</option>
        </select>
      </div>
      <ul className="mt-4 space-y-2 md:hidden">
        {docs.length === 0 ? (
          <li className={`${cardClass()} px-4 py-8 text-sm text-slate-500`}>No documents match this view.</li>
        ) : (
          docs.map((doc) => (
            <li key={doc.id} className={`${cardClass()} p-4`}>
              <div className="flex items-start gap-3">
                <span className="mt-0.5 shrink-0">
                  <PdfBadge />
                </span>
                <p className="min-w-0 break-words font-medium text-white">{doc.title}</p>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                {documentPhase(doc)} · {formatBytes(doc.sizeBytes)} · {formatDate(doc.createdAt)}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <a href={doc.fileUrl} download className="rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-200">
                  Download
                </a>
                <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-200">
                  Preview
                </a>
                <button type="button" onClick={() => onDetails(doc)} className="rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-200">
                  Details
                </button>
              </div>
            </li>
          ))
        )}
      </ul>
      <div className={`${cardClass()} relative mt-4 hidden overflow-x-auto md:block`}>
        <table className="min-w-full text-left text-sm">
          <thead className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Size</th>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {docs.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-slate-500">No documents match this view.</td>
              </tr>
            ) : (
              docs.map((doc) => (
                <tr key={doc.id} className="border-t border-white/[0.06]">
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-3">
                      <PdfBadge />
                      <span className="font-medium text-white">{doc.title}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-xs text-slate-300">{documentPhase(doc)}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-400">{formatBytes(doc.sizeBytes)}</td>
                  <td className="px-4 py-3 text-slate-400">{formatDate(doc.createdAt)}</td>
                  <td className="relative px-4 py-3">
                    <div className="flex items-center gap-2">
                      <a href={doc.fileUrl} download className="text-slate-300 hover:text-white" aria-label={`Download ${doc.title}`}>
                        <DownloadIcon />
                      </a>
                      <button type="button" className="px-1 text-slate-400" aria-label="Document menu" onClick={() => onMenu(menuId === doc.id ? null : doc.id)}>
                        ⋮
                      </button>
                    </div>
                    {menuId === doc.id ? (
                      <div className="absolute right-4 z-20 mt-1 w-44 rounded-xl border border-white/10 bg-[#10192b] py-1 text-xs shadow-xl">
                        <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="block px-3 py-2 hover:bg-white/[0.04]">Preview document</a>
                        <a href={doc.fileUrl} download className="block px-3 py-2 hover:bg-white/[0.04]">Download {fileKind(doc)}</a>
                        <button type="button" className="block w-full px-3 py-2 text-left hover:bg-white/[0.04]" onClick={() => onDetails(doc)}>
                          Version history
                        </button>
                        <button type="button" className="block w-full px-3 py-2 text-left hover:bg-white/[0.04]" onClick={() => onDetails(doc)}>
                          File details
                        </button>
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {details ? (
        <div className={`${cardClass()} mt-4 p-4 text-sm`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium text-white">{details.title}</p>
              <p className="mt-1 text-slate-400">
                {fileKind(details)} · {documentPhase(details)} · {formatBytes(details.sizeBytes)} · {formatDate(details.createdAt)}
              </p>
              <p className="mt-2 text-xs text-slate-500">Current file only — older versions are not stored on the portal.</p>
            </div>
            <button type="button" className="text-slate-400" onClick={() => onDetails(null)}>Close</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function StageRail({ stages }: { stages: Stage[] }) {
  return (
    <div className="mt-5 overflow-hidden">
      <div className="flex items-start">
        {stages.map((stage, i) => (
          <div key={stage.key} className="flex min-w-0 flex-1 flex-col items-center overflow-hidden">
            <div className="relative flex h-8 w-full items-center justify-center sm:h-11">
              {i > 0 ? (
                <span
                  className={`absolute left-0 right-1/2 top-1/2 h-[3px] -translate-y-1/2 ${
                    stages[i - 1]?.state === "done" ? "bg-emerald-400" : "bg-[#3e6288]"
                  }`}
                />
              ) : null}
              {i < stages.length - 1 ? (
                <span
                  className={`absolute left-1/2 right-0 top-1/2 h-[3px] -translate-y-1/2 ${
                    stage.state === "done" ? "bg-emerald-400" : "bg-[#3e6288]"
                  }`}
                />
              ) : null}
              <div className="relative z-10 shrink-0">
                <div
                  className={`flex size-7 items-center justify-center rounded-full text-[11px] font-semibold leading-none sm:size-11 sm:text-sm ${
                    stage.state === "done"
                      ? "bg-emerald-900 text-white shadow-[0_0_0_3px_rgba(52,211,153,0.95),0_0_14px_rgba(16,185,129,0.55)]"
                      : stage.state === "current"
                        ? "bg-sky-400 text-white shadow-[0_0_0_5px_rgba(56,189,248,0.45),0_0_18px_rgba(56,189,248,0.55)]"
                        : "border border-white/20 bg-[#0c1524] text-white"
                  }`}
                >
                  {stage.state === "done" ? "✓" : stage.number}
                </div>
              </div>
            </div>
            <p className={`mt-2 w-full px-0.5 text-center text-[8px] leading-[1.15] text-white [overflow-wrap:anywhere] sm:mt-3 sm:text-[10px] ${stage.state === "current" || stage.state === "done" ? "font-bold" : ""}`}>
              {stage.label}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function StageDot({ stage }: { stage: Stage }) {
  const cls =
    stage.state === "done"
      ? "bg-emerald-900 text-white shadow-[0_0_0_3px_rgba(52,211,153,0.95),0_0_14px_rgba(16,185,129,0.55)]"
      : stage.state === "current"
        ? "bg-sky-400 text-white shadow-[0_0_0_5px_rgba(56,189,248,0.4),0_0_20px_rgba(56,189,248,0.55)]"
        : "border border-slate-500 bg-[#0c1524] text-white";
  return (
    <span className={`relative z-10 flex size-8 items-center justify-center rounded-full text-xs font-semibold ${cls}`}>
      {stage.state === "done" ? "✓" : stage.number}
    </span>
  );
}

function Metric({ icon, label, value, hint, emphasis }: { icon: "cal" | "dot"; label: string; value: string; hint?: string; emphasis?: boolean }) {
  return (
    <div className={`${cardClass()} flex items-center gap-3 px-4 py-3`}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.04] text-slate-300">
        {icon === "dot" ? <span className="h-2.5 w-2.5 rounded-full bg-sky-400" /> : <CalIcon />}
      </span>
      <span className="min-w-0">
        <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-white">{label}</span>
        <span className={`block text-sm leading-snug text-white ${emphasis ? "font-bold" : "font-semibold"}`}>{value}</span>
        {hint ? <span className="block truncate text-xs text-white">{hint}</span> : null}
      </span>
    </div>
  );
}

function CardTitle({ icon, children }: { icon: "doc" | "link" | "team"; children: string }) {
  return (
    <h2 className="flex items-center gap-2 border-b border-white/[0.08] pb-3 text-base font-bold text-white">
      <span className="text-white">
        {icon === "doc" ? <DocMini className="h-8 w-8" /> : icon === "link" ? <LinkMini className="h-8 w-8" /> : <TeamMini className="h-8 w-8" />}
      </span>
      {children}
    </h2>
  );
}

function CalIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3.75 8.25h16.5M4.5 6.75h15A.75.75 0 0120.25 7.5v12a.75.75 0 01-.75.75h-15a.75.75 0 01-.75-.75v-12a.75.75 0 01.75-.75z" />
    </svg>
  );
}

function DocMini({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  );
}

function LinkMini({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
    </svg>
  );
}

function TeamMini({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  );
}

function NavButton({
  active,
  label,
  onClick,
  icon,
  badge,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  icon: "home" | "clock" | "check" | "doc";
  badge?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm ${active ? "bg-sky-600 text-white" : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"}`}
    >
      <NavIcon name={icon} />
      <span className="flex-1 text-left">{label}</span>
      {badge ? <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">{badge}</span> : null}
    </button>
  );
}

function Count({ n, hot }: { n: number; hot?: boolean }) {
  return <span className={`ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] text-white ${hot ? "bg-red-500" : "bg-white/10"}`}>{n}</span>;
}

function ProjectArt({ src, placement = "sidebar" }: { src: string | null; placement?: "sidebar" | "banner" | "side" }) {
  const [failed, setFailed] = useState(false);
  const frame =
    placement === "side"
      ? "h-full w-full"
      : placement === "banner"
        ? "aspect-[16/10] max-h-52 w-full"
        : "mx-4 mt-2 aspect-square";
  const skyId = placement === "sidebar" ? "portal-sky" : `portal-sky-${placement}`;
  if (src && !failed) {
    return (
      <div className={`${frame} overflow-hidden rounded-2xl bg-[#10192b]`}>
        {/* User-uploaded project photo served by this app. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" className={`h-full w-full ${placement === "side" ? "object-cover" : "object-contain"}`} onError={() => setFailed(true)} />
      </div>
    );
  }
  return (
    <div className={`${placement === "sidebar" ? "mx-4 mt-2" : "h-full w-full"} overflow-hidden rounded-2xl`} aria-hidden>
      <svg viewBox="0 0 280 150" className={placement === "side" ? "h-full w-full" : "h-auto w-full"}>
        <defs>
          <linearGradient id={skyId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7eb6e8" />
            <stop offset="55%" stopColor="#c5d7ea" />
            <stop offset="100%" stopColor="#e7eef4" />
          </linearGradient>
        </defs>
        <rect width="280" height="150" fill={`url(#${skyId})`} />
        <rect x="0" y="118" width="280" height="32" fill="#d5ddd4" />
        <rect x="36" y="62" width="168" height="72" fill="#f4f7fb" />
        <rect x="36" y="54" width="168" height="12" fill="#ffffff" />
        <rect x="48" y="74" width="46" height="34" fill="#8eb4d4" />
        <rect x="102" y="74" width="46" height="34" fill="#7aa6c8" />
        <rect x="156" y="74" width="36" height="60" fill="#1f3348" />
        <rect x="214" y="78" width="42" height="48" fill="#e8eef3" />
        <rect x="222" y="88" width="14" height="16" fill="#9bb8d0" />
        <rect x="240" y="88" width="10" height="16" fill="#9bb8d0" />
      </svg>
    </div>
  );
}

function ClockMini() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function DoneMark() {
  return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
      </svg>
    </span>
  );
}

function CheckMini({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function FolderMini({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6.75v10.5A2.25 2.25 0 004.5 19.5h15a2.25 2.25 0 002.25-2.25V11.25a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
    </svg>
  );
}

function PdfBadge() {
  return <span className="rounded bg-red-500 px-1.5 py-1 text-[9px] font-bold text-white">PDF</span>;
}

function LinkGlyph({ kind }: { kind: "zoom" | "pinterest" | "link" }) {
  if (kind === "pinterest") {
    return (
      <svg viewBox="0 0 24 24" className="h-9 w-9 shrink-0" aria-hidden>
        <path
          fill="#E60023"
          d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.099.12.112.225.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.401.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.354-.629-2.758-1.379l-.749 2.848c-.269 1.045-1.004 2.352-1.498 3.146 1.123.345 2.306.535 3.55.535 6.607 0 11.985-5.365 11.985-11.987C23.97 5.39 18.592.026 11.985.026L12.017 0z"
        />
      </svg>
    );
  }
  if (kind === "zoom") {
    return (
      <svg viewBox="0 0 24 24" className="h-9 w-9 shrink-0" aria-hidden>
        <rect width="24" height="24" rx="7" fill="#2D8CFF" />
        <path
          fill="#fff"
          d="M4.8 8.4c0-.8.6-1.4 1.4-1.4h7.2c.8 0 1.4.6 1.4 1.4v7.2c0 .8-.6 1.4-1.4 1.4H6.2c-.8 0-1.4-.6-1.4-1.4V8.4z"
        />
        <path fill="#fff" d="M16.2 10.1 19.6 8v8l-3.4-2.1v-3.8z" />
      </svg>
    );
  }
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-500 text-xs font-bold text-white">
      ↗
    </span>
  );
}

function NoticeIcon({ kind, unread }: { kind: string; unread: boolean }) {
  const tone =
    kind === "file"
      ? "text-slate-200"
      : kind === "action"
        ? "text-sky-300"
        : kind === "action_done"
          ? "text-emerald-300"
          : kind === "date"
            ? "text-amber-200"
            : kind === "description"
              ? "text-violet-200"
              : "text-emerald-300";
  return (
    <span className={`relative mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.05] ring-1 ring-white/10 ${tone}`}>
      {kind === "file" ? (
        <FolderMini />
      ) : kind === "action" || kind === "action_done" ? (
        <CheckMini />
      ) : kind === "date" ? (
        <CalIcon />
      ) : kind === "description" ? (
        <DocMini />
      ) : (
        <ClockMini />
      )}
      {unread ? <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-sky-400" /> : null}
    </span>
  );
}

function BellMini({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12M12 16.5V3" />
    </svg>
  );
}

function ExternalIcon() {
  return (
    <svg className="h-3.5 w-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5M15 3h6m0 0v6m0-6L10.5 13.5" />
    </svg>
  );
}

function NavIcon({ name }: { name: "home" | "clock" | "check" | "doc" }) {
  const common = "h-4 w-4";
  if (name === "home") {
    return (
      <svg className={common} fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75" />
      </svg>
    );
  }
  if (name === "clock") {
    return (
      <svg className={common} fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    );
  }
  if (name === "check") {
    return (
      <svg className={common} fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    );
  }
  return (
    <svg className={common} fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  );
}
