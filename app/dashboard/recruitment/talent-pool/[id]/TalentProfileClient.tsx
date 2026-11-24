"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Avatar, SoftwarePills, experienceText } from "@/components/recruitment/TalentChrome";
import { headerKey } from "@/lib/recruitment/parse";
import {
  ARCHIVE_REASONS,
  RECRUITMENT_AVAILABILITY,
  RECRUITMENT_STATUSES,
  archiveReasonLabel,
  formAnswersInSheetOrder,
  recruitmentAvailabilityLabel,
  recruitmentExperienceLabel,
  recruitmentStatusLabel,
  type RecruitmentAnswer,
  type RecruitmentDocument,
} from "@/lib/recruitment/constants";

type Comment = {
  id: string;
  authorName: string;
  body: string;
  fileLabel: string | null;
  filePage: number | null;
  createdAt: string;
};

type Activity = {
  id: string;
  actorName: string;
  action: string;
  detail: string | null;
  createdAt: string;
};

type Application = {
  id: string;
  fullName: string;
  email: string | null;
  phoneRaw: string | null;
  phoneE164: string | null;
  whatsApp: string | null;
  location: string | null;
  software: string[];
  experience: string;
  experienceYears: number | null;
  experienceRaw: string | null;
  availabilitySubmitted: string | null;
  confirmedAvailability: string;
  availabilityNote: string | null;
  availabilityUpdatedAt: string | null;
  availabilityUpdatedByName: string | null;
  services: string | null;
  answers: RecruitmentAnswer[];
  documents: RecruitmentDocument[];
  status: string;
  previousStatus: string | null;
  submittedAt: string | null;
  archivedAt: string | null;
  archiveReason: string | null;
  archiveComment: string | null;
  archivedByName: string | null;
  comments: Comment[];
  activity: Activity[];
};

const TABS = ["Overview", "Skills & setup", "Documents", "Comments"] as const;
const field = "rounded-lg border border-white/[0.1] bg-[#0b1220] px-3 py-2 text-sm text-white";

function answerFor(answers: RecruitmentAnswer[], pattern: RegExp): string | null {
  return answers.find((answer) => pattern.test(answer.question))?.answer ?? null;
}

export function TalentProfileClient({ id }: { id: string }) {
  const searchParams = useSearchParams();
  const back = `/dashboard/recruitment/talent-pool${searchParams.get("from") ? `?${searchParams.get("from")}` : ""}`;
  const [application, setApplication] = useState<Application | null>(null);
  const [canDelete, setCanDelete] = useState(false);
  const [tab, setTab] = useState<(typeof TABS)[number]>("Overview");
  const [error, setError] = useState("");
  const [comment, setComment] = useState("");
  const [attachPage, setAttachPage] = useState(true);
  const [filePage, setFilePage] = useState(1);
  const [selectedFile, setSelectedFile] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [reason, setReason] = useState("no_longer_interested");
  const [archiveComment, setArchiveComment] = useState("");
  const [availability, setAvailability] = useState("needs_confirmation");
  const [availabilityNote, setAvailabilityNote] = useState("");

  async function load() {
    const response = await fetch(`/api/recruitment/applications/${id}`);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(payload.error || "Could not load this profile.");
      return;
    }
    setApplication(payload.application);
    setCanDelete(Boolean(payload.canDelete));
    setAvailability(payload.application.confirmedAvailability);
    setAvailabilityNote(payload.application.availabilityNote ?? "");
  }

  useEffect(() => {
    void load();
  }, [id]);

  const file = application?.documents[selectedFile] ?? null;
  const previewUrl = file?.fileId ? `/api/recruitment/files/${file.fileId}` : null;
  const skillAnswers = useMemo(
    () => (application?.answers ?? []).filter((answer) => /software|experience|service|tool|setup|hardware|internet|fulltime|160/i.test(answer.question)),
    [application],
  );

  async function patch(body: Record<string, unknown>) {
    setError("");
    const response = await fetch(`/api/recruitment/applications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(payload.error || "Could not save.");
      return;
    }
    setApplication(payload.application);
    setArchiveOpen(false);
  }

  async function addComment(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch(`/api/recruitment/applications/${id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        body: comment,
        fileLabel: tab === "Documents" && attachPage ? file?.label : null,
        filePage: tab === "Documents" && attachPage ? filePage : null,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(payload.error || "Could not save the comment.");
      return;
    }
    setComment("");
    await load();
  }

  if (!application) return <p className="text-sm text-slate-500">{error || "Loading profile…"}</p>;

  const referral = answerFor(application.answers, /referral|how did you hear|^reference$/i);
  const position = answerFor(application.answers, /current professional position|current position|job title|current title/i) || answerFor(application.answers, /position|role/i);
  const emails = Array.from(
    new Set(
      application.answers
        .filter((answer) => headerKey(answer.question) === "email")
        .map((answer) => answer.answer.trim())
        .filter(Boolean),
    ),
  );
  if (application.email && !emails.some((email) => email.toLowerCase() === application.email?.toLowerCase())) {
    emails.unshift(application.email);
  }
  const latestMove = application.activity.find((item) => item.detail?.startsWith("Status") || item.detail?.startsWith("Restored") || item.detail?.startsWith("Archived"));

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <p className="text-sm text-slate-500">
        Recruitment / Talent Pool / <span className="text-slate-300">{application.fullName}</span>
      </p>
      <Link href={back} className="inline-flex text-sm text-cyan-300 hover:text-cyan-200">
        ← Back to talent pool
      </Link>
      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-sky-950 text-lg font-semibold text-sky-100 ring-1 ring-sky-400/30">
            {application.fullName.slice(0, 1)}
            {application.fullName.split(" ")[1]?.[0] ?? ""}
          </span>
          <div>
            <h1 className="text-3xl font-semibold text-white">{application.fullName}</h1>
            <p className="mt-1 text-sm text-slate-400">{application.location || "Location not submitted"}</p>
            <p className="mt-1 text-sm">
              {application.whatsApp && application.phoneE164 ? (
                <>
                  <a href={application.whatsApp} target="_blank" rel="noopener noreferrer" className="font-medium text-emerald-300">
                    {application.phoneE164}
                  </a>
                  <a href={application.whatsApp} target="_blank" rel="noopener noreferrer" className="ml-3 text-cyan-300">
                    WhatsApp
                  </a>
                </>
              ) : (
                <span className="text-slate-500">{application.phoneRaw ? `${application.phoneRaw} needs a country code` : "No phone number"}</span>
              )}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Self-reported</p>
            <SoftwarePills items={application.software} />
          </div>
          <div>
            <p className="text-lg font-semibold text-white">{experienceText(application.experienceYears, recruitmentExperienceLabel(application.experience))}</p>
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Experience</p>
          </div>
          {tab === "Documents" ? (
            <div className="text-sm text-slate-300">
              <p>Availability: {recruitmentAvailabilityLabel(application.confirmedAvailability)}</p>
              <p>Start: {application.availabilityNote || "Not set"}</p>
            </div>
          ) : null}
          <select
            value={application.status}
            onChange={(event) => {
              const next = event.target.value;
              if (next === "archived") {
                setArchiveOpen(true);
                return;
              }
              if (application.status === "archived") {
                void patch({ restore: true, status: next });
                return;
              }
              void patch({ status: next });
            }}
            className="select-console rounded-full border border-cyan-400/40 bg-cyan-400/10 px-3 py-2 text-sm text-white"
          >
            {RECRUITMENT_STATUSES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          {application.status !== "archived" ? (
            <button type="button" onClick={() => setArchiveOpen(true)} className="rounded-lg border border-white/[0.1] px-3 py-2 text-sm text-slate-200">
              Archive
            </button>
          ) : null}
        </div>
      </header>

      <div className="flex gap-6 border-b border-white/[0.06]">
        {TABS.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTab(item)}
            className={`pb-2 text-sm ${tab === item ? "border-b-2 border-cyan-300 text-white" : "text-slate-400"}`}
          >
            {item}
          </button>
        ))}
      </div>

      {tab === "Overview" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-2xl border border-white/[0.08] bg-[#0c1526] p-5">
            <h2 className="font-semibold text-white">Personal details</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <Detail label="Email" value={emails.length > 0 ? emails.join(" · ") : application.email} />
              <Detail label="Location" value={application.location} />
              <Detail label="Cellphone" value={application.phoneE164 || application.phoneRaw} href={application.whatsApp} />
              <Detail label="Referral" value={referral} />
              <Detail label="Current position" value={position} />
            </dl>
          </section>
          <section className="rounded-2xl border border-white/[0.08] bg-[#0c1526] p-5">
            <h2 className="font-semibold text-white">Availability</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="grid grid-cols-[9rem_1fr] gap-2">
                <dt className="text-slate-400">Submitted response</dt>
                <dd className="text-white">{application.availabilitySubmitted || "Not answered"}</dd>
              </div>
              <div className="grid grid-cols-[9rem_1fr] items-center gap-2">
                <dt className="text-slate-400">Confirmed availability</dt>
                <dd>
                  <select value={availability} onChange={(event) => setAvailability(event.target.value)} className={`select-console ${field}`}>
                    {RECRUITMENT_AVAILABILITY.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </dd>
              </div>
              <div className="grid grid-cols-[9rem_1fr] items-center gap-2">
                <dt className="text-slate-400">Start timing</dt>
                <dd>
                  <input value={availabilityNote} onChange={(event) => setAvailabilityNote(event.target.value)} placeholder="One month notice" className={`w-full ${field}`} />
                </dd>
              </div>
              <div className="grid grid-cols-[9rem_1fr] gap-2">
                <dt className="text-slate-400">Last confirmed</dt>
                <dd className="text-white">
                  {application.availabilityUpdatedAt
                    ? `${application.availabilityUpdatedByName} · ${new Date(application.availabilityUpdatedAt).toLocaleString("en-GB")}`
                    : "Not yet confirmed"}
                </dd>
              </div>
            </dl>
            <button
              type="button"
              onClick={() => void patch({ confirmedAvailability: availability, availabilityNote })}
              className="mt-4 rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950"
            >
              Update availability
            </button>
          </section>
          <section className="rounded-2xl border border-white/[0.08] bg-[#0c1526] p-5">
            <h2 className="font-semibold text-white">Form answers</h2>
            <AnswerList answers={formAnswersInSheetOrder(application.answers)} />
          </section>
          <CommentPanel
            comments={application.comments}
            comment={comment}
            setComment={setComment}
            onSubmit={addComment}
            showPage={false}
          />
        </div>
      ) : null}

      {tab === "Skills & setup" ? (
        <section className="space-y-3 rounded-2xl border border-white/[0.08] bg-[#0c1526] p-5">
          <p className="text-sm text-slate-300">Software: {application.software.join(", ") || "Not answered"}</p>
          <p className="text-sm text-slate-300">
            Experience: {experienceText(application.experienceYears, recruitmentExperienceLabel(application.experience))}
            {application.experienceRaw ? ` · submitted “${application.experienceRaw}”` : ""}
          </p>
          <p className="text-sm text-slate-300">Services: {application.services || "Not answered"}</p>
          <AnswerList answers={skillAnswers.length > 0 ? skillAnswers : application.answers} />
        </section>
      ) : null}

      {tab === "Documents" ? (
        <div className="grid gap-4 xl:grid-cols-[16rem_minmax(0,1fr)_18rem]">
          <section className="rounded-2xl border border-white/[0.08] bg-[#0c1526] p-4">
            <h2 className="font-semibold text-white">Documents ({application.documents.length})</h2>
            <ul className="mt-3 space-y-2">
              {application.documents.length === 0 ? <li className="text-sm text-slate-500">No Drive files were submitted.</li> : null}
              {application.documents.map((document, index) => (
                <li key={`${document.url}-${index}`}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFile(index);
                      setZoom(1);
                      setFilePage(1);
                    }}
                    className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left ${index === selectedFile ? "border-cyan-400/50 bg-cyan-400/10" : "border-white/[0.08]"}`}
                  >
                    <span className="text-slate-400">{document.restricted ? "🔒" : "📄"}</span>
                    <span>
                      <span className="block text-sm text-white">{document.label}</span>
                      <span className="block text-[11px] text-slate-500">{document.restricted ? "Restricted access" : document.kind}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
          <section className="rounded-2xl border border-white/[0.08] bg-[#0c1526] p-4">
            {file && previewUrl ? (
              <>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-white">{file.label}</p>
                    <p className="text-xs text-slate-500">{file.restricted ? "Restricted identity document" : "Submitted file"}</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-200">
                    <button type="button" onClick={() => setFilePage((page) => Math.max(1, page - 1))} className="rounded border border-white/[0.1] px-2 py-1">
                      ‹
                    </button>
                    <span>Page {filePage}</span>
                    <button type="button" onClick={() => setFilePage((page) => page + 1)} className="rounded border border-white/[0.1] px-2 py-1">
                      ›
                    </button>
                    <button type="button" onClick={() => setZoom((value) => Math.max(0.5, value - 0.25))} className="rounded border border-white/[0.1] px-2 py-1">
                      −
                    </button>
                    <span>{Math.round(zoom * 100)}%</span>
                    <button type="button" onClick={() => setZoom((value) => Math.min(2.5, value + 0.25))} className="rounded border border-white/[0.1] px-2 py-1">
                      +
                    </button>
                    <button type="button" onClick={() => document.getElementById("talent-file-frame")?.requestFullscreen()} className="rounded border border-white/[0.1] px-2 py-1">
                      Open
                    </button>
                    <a href={`${previewUrl}?download=1`} className="rounded-lg bg-cyan-400 px-3 py-1.5 font-semibold text-slate-950">
                      Download
                    </a>
                  </div>
                </div>
                <div id="talent-file-frame" className="overflow-auto rounded-xl bg-white">
                  <iframe title={file.label} src={`${previewUrl}#page=${filePage}`} className="h-[70vh] origin-top-left" style={{ transform: `scale(${zoom})`, width: `${100 / zoom}%` }} />
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-500">{file ? "This link cannot be previewed." : "Select a file."}</p>
            )}
          </section>
          <CommentPanel
            comments={application.comments}
            comment={comment}
            setComment={setComment}
            onSubmit={addComment}
            showPage={Boolean(file)}
            attachPage={attachPage}
            setAttachPage={setAttachPage}
            fileLabel={file?.label}
            filePage={filePage}
          />
        </div>
      ) : null}

      {tab === "Comments" ? (
        <CommentPanel comments={application.comments} comment={comment} setComment={setComment} onSubmit={addComment} showPage={false} />
      ) : null}

      {latestMove ? (
        <p className="text-sm text-slate-400">
          {new Date(latestMove.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })} · {latestMove.detail}
        </p>
      ) : null}

      {canDelete ? (
        <button
          type="button"
          onClick={() => {
            const confirmed = window.confirm(
              "Permanently remove this profile from recruitment? Comments and review history in the dashboard are deleted. The Google Form response and Drive files stay, and this submission will not be imported again.",
            );
            if (!confirmed) return;
            void fetch(`/api/recruitment/applications/${id}`, { method: "DELETE" }).then((response) => {
              if (response.ok) window.location.href = back;
            });
          }}
          className="text-xs text-red-300"
        >
          Permanently delete
        </button>
      ) : null}

      {archiveOpen ? (
        <dialog open className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
          <form
            className="w-full max-w-md rounded-2xl border border-white/[0.1] bg-[#10192b] p-5"
            onSubmit={(event) => {
              event.preventDefault();
              void patch({ archive: true, archiveReason: reason, archiveComment });
            }}
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Archive athlete</h2>
                <p className="text-sm text-slate-400">{application.fullName}</p>
              </div>
              <button type="button" onClick={() => setArchiveOpen(false)} className="text-slate-400">
                ×
              </button>
            </div>
            <p className="mt-3 text-sm text-slate-300">Remove this athlete from the active talent pool. Their profile and comments will be retained.</p>
            <label className="mt-4 block text-xs text-slate-400">
              Reason
              <select value={reason} onChange={(event) => setReason(event.target.value)} className={`select-console mt-1 w-full ${field}`}>
                {ARCHIVE_REASONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-3 block text-xs text-slate-400">
              Optional comment
              <textarea value={archiveComment} onChange={(event) => setArchiveComment(event.target.value)} rows={3} className={`mt-1 w-full ${field}`} />
            </label>
            <p className="mt-2 text-xs text-slate-500">You can restore this athlete later.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setArchiveOpen(false)} className="rounded-lg border border-white/[0.1] px-3 py-1.5 text-sm text-slate-300">
                Cancel
              </button>
              <button className="rounded-lg bg-cyan-400 px-3 py-1.5 text-sm font-semibold text-slate-950">Archive athlete</button>
            </div>
          </form>
        </dialog>
      ) : null}
    </div>
  );
}

function Detail({ label, value, href }: { label: string; value: string | null; href?: string | null }) {
  return (
    <div className="grid grid-cols-[8rem_1fr] gap-2">
      <dt className="text-slate-400">{label}</dt>
      <dd className="text-white">
        {href && value ? (
          <a href={href} target="_blank" rel="noopener noreferrer" className="text-emerald-300">
            {value}
          </a>
        ) : (
          value || "—"
        )}
      </dd>
    </div>
  );
}

function AnswerList({ answers }: { answers: RecruitmentAnswer[] }) {
  if (answers.length === 0) return <p className="mt-3 text-sm text-slate-500">No answers were imported for this section.</p>;
  return (
    <ul className="mt-4 space-y-4">
      {answers.map((answer) => (
        <li key={answer.question}>
          <p className="text-sm font-medium text-white">{answer.question}</p>
          {/^https?:\/\/\S+$/.test(answer.answer.trim()) ? (
            <a href={answer.answer.trim()} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-sm text-cyan-300 hover:text-cyan-200">
              Open
            </a>
          ) : (
            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-300">{answer.answer.trim() || "—"}</p>
          )}
        </li>
      ))}
    </ul>
  );
}

function CommentPanel({
  comments,
  comment,
  setComment,
  onSubmit,
  showPage,
  attachPage,
  setAttachPage,
  fileLabel,
  filePage,
}: {
  comments: Comment[];
  comment: string;
  setComment: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
  showPage: boolean;
  attachPage?: boolean;
  setAttachPage?: (value: boolean) => void;
  fileLabel?: string;
  filePage?: number;
}) {
  return (
    <section className="rounded-2xl border border-white/[0.08] bg-[#0c1526] p-5">
      <h2 className="font-semibold text-white">Internal comments ({comments.length})</h2>
      <ul className="mt-4 space-y-4">
        {comments.length === 0 ? <li className="text-sm text-slate-500">No comments yet.</li> : null}
        {comments.map((item) => (
          <li key={item.id} className="flex gap-3">
            <Avatar name={item.authorName} />
            <div>
              <p className="text-sm text-white">
                {item.authorName} <span className="text-xs text-slate-500">{new Date(item.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}</span>
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-300">{item.body}</p>
              {item.fileLabel ? (
                <p className="mt-1 text-xs text-slate-500">
                  {item.fileLabel}
                  {item.filePage ? ` · Page ${item.filePage}` : ""}
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      <form onSubmit={onSubmit} className="mt-4 space-y-2">
        <textarea value={comment} onChange={(event) => setComment(event.target.value)} rows={3} placeholder="Add an internal comment..." className={`w-full ${field}`} />
        {showPage && setAttachPage ? (
          <label className="flex items-center gap-2 text-xs text-slate-400">
            <input type="checkbox" checked={attachPage} onChange={(event) => setAttachPage(event.target.checked)} />
            Attach current page reference
            {fileLabel ? <span>· {fileLabel}{filePage ? ` · Page ${filePage}` : ""}</span> : null}
          </label>
        ) : null}
        <button className="rounded-lg bg-cyan-400 px-3 py-1.5 text-sm font-semibold text-slate-950">Add comment</button>
      </form>
    </section>
  );
}
