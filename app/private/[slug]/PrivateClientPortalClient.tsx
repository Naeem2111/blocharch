"use client";

import { useMemo, useState } from "react";
import type { PrivateDesignStage } from "@prisma/client";
import { ClientPortalBrandMark } from "@/components/client-portal/ClientPortalBrandMark";
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

const DOC_FILTERS = ["All documents", "Concept design", "Design development", "Council submission", "Other"] as const;

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

function documentCategory(title: string) {
  const t = title.toLowerCase();
  if (t.includes("council")) return "Council submission";
  if (t.includes("concept")) return "Concept design";
  if (t.includes("development")) return "Design development";
  if (t.includes("review") || t.includes("finish") || t.includes("material")) return "Design review";
  if (t.includes("site") || t.includes("existing") || t.includes("photo") || t.includes("survey")) return "Site information";
  return "Other";
}

function linkKind(url: string | null): "zoom" | "pinterest" | "link" {
  const value = (url ?? "").toLowerCase();
  if (value.includes("zoom.")) return "zoom";
  if (value.includes("pinterest.") || value.includes("pin.it")) return "pinterest";
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

function descriptionForCard(text: string) {
  return text
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim().replace(/^[*•-]\s+/, "").replace(/^🔗\s*/, "");
      if (!trimmed) return false;
      if (/^https?:\/\//i.test(trimmed)) return false;
      return true;
    })
    .join("\n");
}

function typeLine(label: string) {
  return label === "Residential extension" ? "Private residential project" : label;
}

function DescriptionBody({ text }: { text: string }) {
  const blocks: Array<{ type: "p" | "ul"; lines: string[] }> = [];
  for (const line of text.split("\n")) {
    const bullet = line.match(/^\s*[*•-]\s+(.*)$/);
    if (bullet) {
      const last = blocks[blocks.length - 1];
      if (last?.type === "ul") last.lines.push(bullet[1]!);
      else blocks.push({ type: "ul", lines: [bullet[1]!] });
      continue;
    }
    if (line.trim()) blocks.push({ type: "p", lines: [line.trim()] });
  }
  return (
    <div className="space-y-2 text-sm leading-relaxed text-slate-300">
      {blocks.map((block, i) =>
        block.type === "ul" ? (
          <ul key={i} className="list-disc space-y-1 pl-5">
            {block.lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : (
          <p key={i}>{block.lines[0]}</p>
        ),
      )}
    </div>
  );
}

function cardClass() {
  return "rounded-2xl border border-white/[0.08] bg-[#0c1524]";
}

export function PrivateClientPortalClient({ slug, data }: { slug: string; data: PortalData }) {
  const { project, updates, stages } = data;
  const [portalDocuments, setPortalDocuments] = useState(data.documents ?? []);
  const [view, setView] = useState<View>("overview");
  const [actionTab, setActionTab] = useState<"required" | "completed">("required");
  const [actionItems, setActionItems] = useState<ActionItem[]>(data.actionItems);
  const [completedActionItems, setCompletedActionItems] = useState<CompletedActionItem[]>(data.completedActionItems);
  const [completing, setCompleting] = useState<string | null>(null);
  const [openCompleted, setOpenCompleted] = useState<string | null>(completedActionItems[0]?.id ?? null);
  const [showCompletedOnOverview, setShowCompletedOnOverview] = useState(false);
  const [noticesOpen, setNoticesOpen] = useState(false);
  const [docQuery, setDocQuery] = useState("");
  const [docFilter, setDocFilter] = useState<(typeof DOC_FILTERS)[number]>("All documents");
  const [docSort, setDocSort] = useState<"newest" | "oldest">("newest");
  const [docMenu, setDocMenu] = useState<string | null>(null);
  const [docDetails, setDocDetails] = useState<PortalDocument | null>(null);
  const [uploadNote, setUploadNote] = useState("");
  const [uploading, setUploading] = useState(false);

  const current = stages.find((s) => s.state === "current") ?? stages[0];
  const next = current ? stages.find((s) => s.number === current.number + 1) ?? null : null;
  const contactEmail = project.team.find((member) => member.email)?.email ?? null;
  const subtitle = typeLine(project.projectTypeLabel);

  const notices = useMemo(() => {
    const items: Array<{ id: string; kind: "document" | "action" | "update"; title: string; detail: string; cta: string; view: View }> = [];
    for (const doc of portalDocuments.slice(0, 2)) {
      items.push({
        id: `doc-${doc.id}`,
        kind: "document",
        title: doc.title,
        detail: `${documentCategory(doc.title)} · ${formatDate(doc.createdAt)}`,
        cta: "Open document",
        view: "documents",
      });
    }
    for (const action of actionItems.slice(0, 2)) {
      items.push({
        id: `act-${action.id}`,
        kind: "action",
        title: action.title,
        detail: "Please respond when you can",
        cta: "View action",
        view: "actions",
      });
    }
    for (const update of updates.slice(0, 2)) {
      items.push({
        id: `upd-${update.occurredAt}-${update.title}`,
        kind: "update",
        title: update.title,
        detail: formatDate(update.occurredAt),
        cta: "View update",
        view: "overview",
      });
    }
    return items;
  }, [actionItems, portalDocuments, updates]);

  const [readIds, setReadIds] = useState<string[]>([]);
  const unread = notices.filter((item) => !readIds.includes(item.id));

  const visibleDocs = useMemo(() => {
    const q = docQuery.trim().toLowerCase();
    const rows = portalDocuments.filter((doc) => {
      const category = documentCategory(doc.title);
      const matchesFilter =
        docFilter === "All documents" ||
        category === docFilter ||
        (docFilter === "Other" && category !== "Concept design" && category !== "Design development" && category !== "Council submission");
      return matchesFilter && (!q || doc.title.toLowerCase().includes(q));
    });
    return [...rows].sort((a, b) =>
      docSort === "newest" ? b.createdAt.localeCompare(a.createdAt) : a.createdAt.localeCompare(b.createdAt),
    );
  }, [docFilter, docQuery, docSort, portalDocuments]);

  async function completeAction(actionItemId: string) {
    setCompleting(actionItemId);
    try {
      const r = await fetch(`/api/private/portal/${slug}/actions`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionItemId }),
      });
      if (!r.ok) return;
      const j = (await r.json()) as { actionItem: { id: string; title: string; completedAt: string } };
      setActionItems((prev) => prev.filter((a) => a.id !== actionItemId));
      setCompletedActionItems((prev) => [
        { id: j.actionItem.id, title: j.actionItem.title, completedAt: j.actionItem.completedAt.slice(0, 10) },
        ...prev,
      ]);
      setOpenCompleted(j.actionItem.id);
    } finally {
      setCompleting(null);
    }
  }

  function openNotice(item: (typeof notices)[number]) {
    setReadIds((prev) => (prev.includes(item.id) ? prev : [...prev, item.id]));
    setView(item.view);
    if (item.view === "actions") setActionTab("required");
    setNoticesOpen(false);
  }

  function emailTeam(subject: string) {
    if (!contactEmail) {
      setUploadNote("Your project team has no email on file yet. Blocharch can add one from the project.");
      return;
    }
    window.location.href = `mailto:${contactEmail}?subject=${encodeURIComponent(subject)}`;
  }

  async function uploadPortalFiles(files: File[]) {
    if (files.length === 0) return;
    setUploading(true);
    setUploadNote("");
    const notes: string[] = [];
    for (const file of files) {
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
          }),
        });
        const started = (await start.json().catch(() => ({}))) as { uploadUrl?: string; error?: string };
        if (!start.ok || !started.uploadUrl) {
          if (file.size > 4 * 1024 * 1024) throw new Error(started.error || "Could not start the upload");
          const form = new FormData();
          form.set("file", file);
          const posted = await fetch(`/api/private/portal/${slug}/documents`, { method: "POST", body: form });
          const body = (await posted.json().catch(() => ({}))) as { error?: string; document?: PortalDocument };
          if (!posted.ok || !body.document) throw new Error(body.error || started.error || "Upload failed");
          setPortalDocuments((prev) => [body.document!, ...prev.filter((doc) => doc.id !== body.document!.id)]);
          notes.push(`${file.name} saved to your project folder.`);
          continue;
        }
        const put = await fetch(started.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type || "application/octet-stream" },
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
          }),
        });
        const finished = (await done.json().catch(() => ({}))) as { error?: string; document?: PortalDocument };
        if (!done.ok || !finished.document) throw new Error(finished.error || "Could not record the file");
        setPortalDocuments((prev) => [finished.document!, ...prev.filter((doc) => doc.id !== finished.document!.id)]);
        notes.push(`${file.name} saved to your Google Drive folder.`);
      } catch (error) {
        notes.push(error instanceof Error ? `${file.name}: ${error.message}` : `Could not upload ${file.name}`);
      }
    }
    setUploadNote(notes.join(" "));
    setUploading(false);
  }

  return (
    <div className="flex min-h-screen bg-[#071018] text-slate-100">
      <aside className="sticky top-0 hidden h-screen w-[16.5rem] shrink-0 flex-col border-r border-white/[0.06] bg-[#08101c] lg:flex">
        <div className="px-5 pb-2 pt-5">
          <ClientPortalBrandMark />
        </div>
        <ProjectArt />
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
        <header className="flex items-center justify-end gap-2 px-4 py-3 sm:px-8">
          <div className="relative">
            <button
              type="button"
              aria-label="Notifications"
              onClick={() => setNoticesOpen((open) => !open)}
              className="relative rounded-full p-2 text-slate-300 hover:bg-white/[0.06]"
            >
              <BellIcon />
              {unread.length > 0 ? <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" /> : null}
            </button>
            {noticesOpen ? (
              <div className="absolute right-0 z-30 mt-2 w-[min(24rem,calc(100vw-2rem))] rounded-2xl border border-white/[0.08] bg-[#0c1422] p-4 shadow-2xl">
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
                <ul className="mt-3 divide-y divide-white/[0.06]">
                  {notices.length === 0 ? (
                    <li className="py-4 text-sm text-slate-500">No notifications yet.</li>
                  ) : (
                    notices.map((item) => (
                      <li key={item.id} className="flex items-start gap-3 py-3">
                        {!readIds.includes(item.id) ? <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400" /> : <span className="w-1.5" />}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-white">{item.title}</p>
                          <p className="text-xs text-slate-500">{item.detail}</p>
                        </div>
                        <button type="button" className="shrink-0 text-xs text-sky-300 hover:underline" onClick={() => openNotice(item)}>
                          {item.cta} →
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            ) : null}
          </div>
        </header>

        <div className="flex gap-2 overflow-x-auto px-4 pb-2 lg:hidden">
          {(["overview", "journey", "actions", "documents"] as const).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setView(id)}
              className={`rounded-full px-3 py-1.5 text-xs ${view === id ? "bg-sky-500 text-slate-950" : "bg-white/[0.04] text-slate-300"}`}
            >
              {id === "overview" ? "Overview" : id === "journey" ? "Journey" : id === "actions" ? "Actions" : "Documents"}
            </button>
          ))}
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
              onComplete={(id) => void completeAction(id)}
              onContact={() => emailTeam(`Question about ${project.address}`)}
              uploadNote={uploadNote}
              uploading={uploading}
              onFiles={(files) => void uploadPortalFiles(files)}
            />
          ) : null}
          {view === "documents" ? (
            <Documents
              docs={visibleDocs}
              query={docQuery}
              onQuery={setDocQuery}
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
      <h1 className="text-[1.7rem] font-semibold tracking-tight text-white sm:text-[2rem]">{displayAddress(address)}</h1>
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
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <Metric icon="cal" label="Brief received" value={formatDate(project.briefReceivedAt)} />
        <Metric icon="dot" label="Current stage" value={current?.label ?? project.designStageLabel} hint={current ? `Step ${current.number} of ${stages.length}` : undefined} />
        <Metric icon="cal" label="Target next stage" value={next?.label ?? "—"} hint={next?.dateFrom ? formatDate(next.dateFrom) : "To be confirmed"} />
      </div>

      <div className="grid items-stretch gap-3 xl:grid-cols-3">
        <section className={`${cardClass()} flex h-52 flex-col p-4`}>
          <CardTitle icon="doc">Project description</CardTitle>
          <div className="mt-3 min-h-0 flex-1 overflow-y-auto pr-1">
            <DescriptionBody
              text={descriptionForCard(
                project.clientDescription?.trim() ||
                  `Your Blocharch client portal gives you a live view of this ${subtitle.toLowerCase()}. Track the current stage, open actions, and documents as they are shared.`,
              )}
            />
          </div>
        </section>
        <section className={`${cardClass()} flex h-52 flex-col p-4`}>
          <CardTitle icon="link">Quick links</CardTitle>
          <p className="mt-1 text-xs text-slate-500">Access important project resources.</p>
          <ul className="mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto">
            {project.clientLinks.length === 0 ? <li className="text-sm text-slate-500">Links will appear here once they are added.</li> : null}
            {project.clientLinks.map((link, i) => {
              const parts = splitLinkLabel(link.label.replace(/^🔗\s*/, ""), link.url);
              const kind = linkKind(link.url);
              return (
                <li key={`${link.label}-${i}`}>
                  <a href={link.url ?? "#"} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3">
                    <LinkGlyph kind={kind} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-white">{parts.title}</span>
                      <span className="block truncate text-xs text-slate-500">{parts.subtitle}</span>
                    </span>
                    <ExternalIcon />
                  </a>
                </li>
              );
            })}
          </ul>
        </section>
        <section className={`${cardClass()} flex h-52 flex-col p-4`}>
          <CardTitle icon="team">Project team</CardTitle>
          <p className="mt-1 text-xs text-slate-500">Your main points of contact.</p>
          <ul className="mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto">
            {project.team.length === 0 ? <li className="text-sm text-slate-500">The project team will appear here once assigned.</li> : null}
            {project.team.map((member) => (
              <li key={member.id} className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-xs font-semibold text-slate-200 ring-1 ring-white/10">
                  {member.initials}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-white">{member.fullName}</span>
                  <span className="block text-xs text-slate-500">{member.role}</span>
                </span>
                {member.email ? (
                  <a href={`mailto:${member.email}`} className="rounded-lg border border-white/10 p-2 text-slate-300 hover:text-white" aria-label={`Email ${member.fullName}`}>
                    <MailIcon />
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      </div>

      {current ? (
        <section className="private-portal-hero rounded-2xl p-5 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_14rem] sm:items-start">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300">Current stage</p>
              <h2 className="mt-1.5 text-xl font-semibold text-white sm:text-2xl">{current.label}</h2>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full bg-sky-500/15 px-2.5 py-0.5 text-sky-200 ring-1 ring-sky-400/30">In progress</span>
                <span className="text-slate-400">Step {current.number} of {stages.length}</span>
              </div>
            </div>
            <div className="sm:text-right">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Up next</p>
              <p className="mt-1.5 text-base font-semibold text-white">{next?.label ?? "—"}</p>
              <p className="mt-1 text-sm text-slate-500">Target date: {next?.dateFrom ? formatDate(next.dateFrom) : "To be confirmed"}</p>
            </div>
          </div>
          <StageRail stages={stages} />
        </section>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-3">
        <section className={`${cardClass()} p-5`}>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-white"><span className="text-emerald-400"><ClockMini /></span>Recent updates</h2>
          <p className="mt-1 text-xs text-slate-500">The latest activity on your project.</p>
          <ul className="mt-4 space-y-3">
            {updates.length === 0 ? <li className="text-sm text-slate-500">Updates will show here as they are published.</li> : null}
            {updates.slice(0, 4).map((update, i) => (
              <li key={`${update.occurredAt}-${update.title}`} className="flex gap-3 text-sm">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${["bg-emerald-400", "bg-sky-400", "bg-violet-400", "bg-slate-400"][i % 4]}`} />
                <span className="w-24 shrink-0 text-xs text-slate-500">{formatDate(update.occurredAt)}</span>
                <span className="text-slate-200">{update.title}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className={`${cardClass()} p-5`}>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-white"><span className="text-sky-300"><CheckMini /></span>Required from you</h2>
          <p className="mt-1 text-xs text-slate-500">Actions and information we need from you.</p>
          <ul className="mt-4 space-y-3">
            {actionItems.length === 0 ? <li className="text-sm text-slate-500">Nothing is waiting on you right now.</li> : null}
            {actionItems.slice(0, 3).map((action) => (
              <li key={action.id} className="flex items-start gap-3 text-sm text-slate-200">
                <span className="mt-0.5 h-4 w-4 shrink-0 rounded-full border border-slate-500" />
                <span>{action.title}</span>
              </li>
            ))}
          </ul>
          <button type="button" onClick={onOpenActions} className="mt-4 text-sm text-sky-300 hover:underline">
            View all actions →
          </button>
          {completedActionItems.length > 0 ? (
            <div className="mt-4 border-t border-white/[0.06] pt-3">
              <button type="button" onClick={onToggleCompleted} className="flex w-full items-center gap-2 text-sm text-emerald-300">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-[10px]">✓</span>
                Completed actions ({completedActionItems.length})
                <span className="ml-auto text-slate-500">{showCompleted ? "▴" : "▾"}</span>
              </button>
              {showCompleted ? (
                <ul className="mt-3 space-y-2 text-sm text-slate-300">
                  {completedActionItems.map((action) => (
                    <li key={action.id} className="flex justify-between gap-3">
                      <span>{action.title}</span>
                      <span className="text-xs text-slate-500">{formatDate(action.completedAt)}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </section>
        <section className={`${cardClass()} p-5`}>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-white"><span className="text-slate-300"><FolderMini /></span>Files for download</h2>
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
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(18rem,0.9fr)]">
      <section className={`${cardClass()} p-5 sm:p-6`}>
        <h2 className="text-lg font-semibold text-white">Project timeline</h2>
        <p className="mt-1 text-sm text-slate-500">A step-by-step guide to your project journey.</p>
        <ol className="mt-6 space-y-4">
          {stages.map((stage) => (
            <li key={stage.key} className="flex gap-4">
              <StageDot stage={stage} />
              <div className={`min-w-0 flex-1 ${stage.state === "current" ? "private-portal-timeline-current rounded-xl px-3 py-2" : ""}`}>
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium text-white">{stage.label}</p>
                  <p className="shrink-0 text-xs text-slate-500">
                    {stage.dateFrom ? formatDate(stage.dateFrom) : stage.state === "upcoming" ? "To be confirmed" : "—"}
                  </p>
                </div>
                <p className={`text-xs ${stage.state === "done" ? "text-emerald-300" : stage.state === "current" ? "text-sky-300" : "text-slate-500"}`}>
                  {stage.state === "done"
                    ? "Completed"
                    : stage.state === "current"
                      ? "In progress"
                      : /approval/i.test(stage.label)
                        ? "Final milestone"
                        : "Upcoming"}
                </p>
                {stage.state === "current" ? <p className="mt-1 text-sm text-slate-400">{stageBody(project.designStage)}</p> : null}
              </div>
            </li>
          ))}
        </ol>
      </section>
      <div className="space-y-4">
        <section className="private-portal-hero rounded-2xl p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Current stage details</p>
            <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-[11px] text-sky-200">In progress</span>
          </div>
          <h2 className="mt-3 text-2xl font-semibold text-white">{current.label}</h2>
          <p className="mt-1 text-sm text-slate-500">Step {current.number} of {stages.length}</p>
          <p className="mt-3 text-sm leading-relaxed text-slate-300">{stageBody(project.designStage)}</p>
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
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Next stage</p>
              <span className="text-xs text-slate-500">{next.dateFrom ? formatDate(next.dateFrom) : "To be confirmed"}</span>
            </div>
            <h3 className="mt-3 text-xl font-semibold text-white">{next.label}</h3>
            <p className="mt-1 text-sm text-slate-500">Step {next.number} of {stages.length}</p>
            <p className="mt-3 text-sm leading-relaxed text-slate-400">{PRIVATE_STAGE_CLIENT_COPY[project.designStage].nextHint}</p>
          </section>
        ) : null}
        <section className={`${cardClass()} p-5`}>
          <h2 className="text-sm font-semibold text-white">Recent updates</h2>
          <ul className="mt-4 space-y-3">
            {updates.slice(0, 4).map((update) => (
              <li key={`${update.occurredAt}-${update.title}`} className="flex gap-3 text-sm">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-sky-400" />
                <span className="w-24 shrink-0 text-xs text-slate-500">{formatDate(update.occurredAt)}</span>
                <span>{update.title}</span>
              </li>
            ))}
          </ul>
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
  onComplete,
  onContact,
  uploadNote,
  uploading,
  onFiles,
}: {
  tab: "required" | "completed";
  onTab: (tab: "required" | "completed") => void;
  actionItems: ActionItem[];
  completed: CompletedActionItem[];
  openCompleted: string | null;
  onToggleCompleted: (id: string) => void;
  completing: string | null;
  onComplete: (id: string) => void;
  onContact: () => void;
  uploadNote: string;
  uploading: boolean;
  onFiles: (files: File[]) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => onTab("required")}
          className={`rounded-2xl border px-4 py-3 text-sm font-medium ${tab === "required" ? "border-sky-400/40 bg-sky-500/20 text-white" : "border-white/[0.08] text-slate-300"}`}
        >
          Required from you <Count n={actionItems.length} hot />
        </button>
        <button
          type="button"
          onClick={() => onTab("completed")}
          className={`rounded-2xl border px-4 py-3 text-sm font-medium ${tab === "completed" ? "border-sky-400/40 bg-sky-500/20 text-white" : "border-white/[0.08] text-slate-300"}`}
        >
          Completed <Count n={completed.length} />
        </button>
      </div>

      {tab === "required" ? (
        <section className={`${cardClass()} p-5 sm:p-6`}>
          <h2 className="text-xl font-semibold text-white">Actions required from you</h2>
          <p className="mt-1 text-sm text-slate-400">Actions and information we need from you to keep the project on track.</p>
          <ul className="mt-5 space-y-3">
            {actionItems.length === 0 ? <li className="text-sm text-slate-500">Nothing is waiting on you right now.</li> : null}
            {actionItems.map((action) => (
              <li key={action.id} className="flex items-center gap-3 rounded-2xl border border-white/[0.08] px-4 py-3">
                <button
                  type="button"
                  disabled={completing === action.id}
                  onClick={() => onComplete(action.id)}
                  aria-label={`Mark ${action.title} complete`}
                  className="h-5 w-5 shrink-0 rounded-full border border-slate-500 hover:border-emerald-400 disabled:opacity-50"
                />
                <span className="min-w-0 flex-1 text-sm font-medium text-white">{action.title}</span>
              </li>
            ))}
          </ul>
          <label
            className="mt-5 flex cursor-pointer flex-col items-center rounded-2xl border border-dashed border-sky-400/40 px-4 py-8 text-center"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (!uploading) onFiles(Array.from(e.dataTransfer.files));
            }}
          >
            <span className="text-sky-300">↑</span>
            <span className="mt-2 text-sm text-slate-200">
              {uploading ? "Saving to your project folder…" : <>Drag & drop files here or <span className="text-sky-300 underline">browse</span></>}
            </span>
            <span className="mt-1 text-xs text-slate-500">PDF, JPG, PNG, Word, or Excel (Max 50 MB)</span>
            <input
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png,.webp,.gif,.doc,.docx,.xls,.xlsx,application/pdf,image/*"
              className="sr-only"
              disabled={uploading}
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                onFiles(files);
                e.target.value = "";
              }}
            />
          </label>
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
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 text-xs text-emerald-300">✓</span>
                    <span className="min-w-0 flex-1 text-sm font-medium text-white">{action.title}</span>
                    <span className="rounded-full border border-white/10 px-2 py-1 text-[11px] text-slate-400">Completed {formatDate(action.completedAt)}</span>
                    <span className="text-slate-500">{open ? "▴" : "▾"}</span>
                  </button>
                  {open ? (
                    <p className="mt-3 border-t border-white/[0.06] pt-3 text-xs text-slate-500">
                      Recorded by BLOCHARCH · {formatDate(action.completedAt)}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className={`${cardClass()} flex flex-wrap items-center justify-between gap-3 p-4`}>
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-500/15 text-sky-300">?</span>
          <div>
            <p className="text-sm font-medium text-white">Have a question?</p>
            <p className="text-xs text-slate-500">If you're unsure about anything or need more information, please reach out.</p>
          </div>
        </div>
        <button type="button" onClick={onContact} className="rounded-xl border border-white/10 px-3 py-2 text-sm text-white hover:bg-white/[0.04]">
          Contact BLOCHARCH
        </button>
      </section>
    </div>
  );
}

function Documents({
  docs,
  query,
  onQuery,
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
  filter: (typeof DOC_FILTERS)[number];
  onFilter: (value: (typeof DOC_FILTERS)[number]) => void;
  sort: "newest" | "oldest";
  onSort: (value: "newest" | "oldest") => void;
  menuId: string | null;
  onMenu: (id: string | null) => void;
  details: PortalDocument | null;
  onDetails: (doc: PortalDocument | null) => void;
}) {
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {DOC_FILTERS.map((item) => (
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
      <div className={`${cardClass()} mt-4 overflow-x-auto`}>
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
                    <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-xs text-slate-300">{documentCategory(doc.title)}</span>
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
                {fileKind(details)} · {documentCategory(details.title)} · {formatBytes(details.sizeBytes)} · {formatDate(details.createdAt)}
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
    <div className="mt-5 overflow-x-auto">
      <div className="flex min-w-[36rem] items-start">
        {stages.map((stage, i) => (
          <div key={stage.key} className="flex min-w-0 flex-1 flex-col items-center">
            <div className="flex w-full items-center">
              {i > 0 ? (
                <div className={`h-[3px] flex-1 rounded-full ${stages[i - 1]?.state === "done" ? "bg-emerald-400" : "bg-white/10"}`} />
              ) : (
                <div className="flex-1" />
              )}
              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                  stage.state === "done"
                    ? "bg-emerald-500 text-slate-950"
                    : stage.state === "current"
                      ? "bg-sky-400 text-slate-950 shadow-[0_0_16px_rgba(56,189,248,0.75)] ring-4 ring-sky-400/40"
                      : "border border-white/15 bg-[#0c1524] text-slate-400"
                }`}
              >
                {stage.state === "done" ? "✓" : stage.number}
              </div>
              {i < stages.length - 1 ? (
                <div className={`h-[3px] flex-1 rounded-full ${stage.state === "done" ? "bg-emerald-400" : "bg-white/10"}`} />
              ) : (
                <div className="flex-1" />
              )}
            </div>
            <p className={`mt-2 px-1 text-center text-[10px] leading-tight ${stage.state === "current" ? "font-medium text-white" : "text-slate-500"}`}>
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
      ? "bg-emerald-500 text-slate-950"
      : stage.state === "current"
        ? "bg-sky-500 text-slate-950"
        : "bg-white/10 text-slate-400";
  return <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${cls}`}>{stage.state === "done" ? "✓" : stage.number}</span>;
}

function Metric({ icon, label, value, hint }: { icon: "cal" | "dot"; label: string; value: string; hint?: string }) {
  return (
    <div className={`${cardClass()} flex items-center gap-3 px-4 py-3`}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.04] text-slate-300">
        {icon === "dot" ? <span className="h-2.5 w-2.5 rounded-full bg-sky-400" /> : <CalIcon />}
      </span>
      <span className="min-w-0">
        <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</span>
        <span className="block truncate text-sm font-semibold text-white">{value}</span>
        {hint ? <span className="block truncate text-xs text-slate-500">{hint}</span> : null}
      </span>
    </div>
  );
}

function CardTitle({ icon, children }: { icon: "doc" | "link" | "team"; children: string }) {
  return (
    <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
      <span className="text-slate-400">
        {icon === "doc" ? <DocMini /> : icon === "link" ? <LinkMini /> : <TeamMini />}
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

function DocMini() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  );
}

function LinkMini() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
    </svg>
  );
}

function TeamMini() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
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
  return <span className={`ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] ${hot ? "bg-red-500 text-white" : "bg-white/10 text-slate-300"}`}>{n}</span>;
}

function ProjectArt() {
  return (
    <div className="mx-4 mt-2 overflow-hidden rounded-2xl" aria-hidden>
      <svg viewBox="0 0 280 150" className="h-[7.25rem] w-full">
        <defs>
          <linearGradient id="portal-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7eb6e8" />
            <stop offset="55%" stopColor="#c5d7ea" />
            <stop offset="100%" stopColor="#e7eef4" />
          </linearGradient>
        </defs>
        <rect width="280" height="150" fill="url(#portal-sky)" />
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

function CheckMini() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function FolderMini() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6.75v10.5A2.25 2.25 0 004.5 19.5h15a2.25 2.25 0 002.25-2.25V11.25a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
    </svg>
  );
}

function PdfBadge() {
  return <span className="rounded bg-red-500 px-1.5 py-1 text-[9px] font-bold text-white">PDF</span>;
}

function LinkGlyph({ kind }: { kind: "zoom" | "pinterest" | "link" }) {
  const cls = kind === "pinterest" ? "bg-red-500" : "bg-sky-500";
  const mark = kind === "pinterest" ? "P" : kind === "zoom" ? "▶" : "↗";
  return <span className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white ${cls}`}>{mark}</span>;
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
