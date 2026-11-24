"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Avatar, relativeSync, statusDot } from "@/components/recruitment/TalentChrome";
import {
  ARCHIVE_REASONS,
  RECRUITMENT_AVAILABILITY,
  RECRUITMENT_EXPERIENCE,
  RECRUITMENT_FORM_COLUMNS,
  RECRUITMENT_STATUSES,
  archiveReasonLabel,
  formAnswersInSheetOrder,
  recruitmentAvailabilityLabel,
  recruitmentExperienceLabel,
  recruitmentStatusLabel,
  type RecruitmentAnswer,
} from "@/lib/recruitment/constants";

type Row = {
  id: string;
  fullName: string;
  email: string | null;
  phoneRaw: string | null;
  phoneE164: string | null;
  whatsApp: string | null;
  location: string | null;
  software: string[];
  experience: string;
  experienceRaw: string | null;
  experienceYears: number | null;
  availabilitySubmitted: string | null;
  confirmedAvailability: string;
  status: string;
  previousStatus: string | null;
  submittedAt: string | null;
  archivedAt: string | null;
  archiveReason: string | null;
  answers: RecruitmentAnswer[];
};

type SyncState = {
  configured: boolean;
  status: string;
  lastSuccessAt: string | null;
  lastError: string | null;
};

const field = "rounded-lg border border-white/[0.1] bg-[#0c1526] px-3 py-2 text-sm text-slate-200";

export function TalentPoolClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [softwareOptions, setSoftwareOptions] = useState<string[]>([]);
  const [sync, setSync] = useState<SyncState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [softwareQuery, setSoftwareQuery] = useState("");
  const [softwareOpen, setSoftwareOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [draftSoftware, setDraftSoftware] = useState<string[]>([]);
  const [draftMatch, setDraftMatch] = useState<"any" | "all">("any");
  const [archiveFor, setArchiveFor] = useState<Row | null>(null);
  const [restoreFor, setRestoreFor] = useState<Row | null>(null);
  const [reason, setReason] = useState("no_longer_interested");
  const [comment, setComment] = useState("");
  const [restoreStatus, setRestoreStatus] = useState("potential");
  const [saving, setSaving] = useState(false);
  const [searchDraft, setSearchDraft] = useState(searchParams.get("q") || "");

  const status = searchParams.get("status") || "all_active";
  const experience = searchParams.get("experience") || "all";
  const availability = searchParams.get("availability") || "all";
  const match = searchParams.get("match") === "all" ? "all" : "any";
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const selectedSoftware = searchParams.getAll("software");
  const archivedView = status === "archived";

  const replaceParams = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const next = new URLSearchParams(searchParams.toString());
      mutate(next);
      const text = next.toString();
      router.replace(text ? `/dashboard/recruitment/talent-pool?${text}` : "/dashboard/recruitment/talent-pool");
    },
    [router, searchParams],
  );

  const load = useCallback(
    async (refresh = false) => {
      setLoading(true);
      setError("");
      const params = new URLSearchParams(queryString);
      if (!params.get("status")) params.set("status", "all_active");
      if (refresh) params.set("refresh", "1");
      const response = await fetch(`/api/recruitment/applications?${params}`);
      const payload = await response.json().catch(() => ({}));
      setLoading(false);
      if (!response.ok) {
        setError(payload.error || "Could not load the talent pool.");
        return;
      }
      setRows(payload.applications || []);
      setTotal(payload.total || 0);
      setTotalPages(payload.totalPages || 1);
      setSoftwareOptions(payload.softwareOptions || []);
      setSync(payload.sync || null);
    },
    [queryString],
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  const visibleSoftware = useMemo(() => {
    const term = softwareQuery.trim().toLowerCase();
    return softwareOptions.filter((item) => item.toLowerCase().includes(term));
  }, [softwareOptions, softwareQuery]);

  async function patch(id: string, body: Record<string, unknown>) {
    setSaving(true);
    setError("");
    const response = await fetch(`/api/recruitment/applications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok) {
      setError(payload.error || "Could not save.");
      return false;
    }
    await load(false);
    return true;
  }

  function profileHref(id: string) {
    return `/dashboard/recruitment/talent-pool/${id}${queryString ? `?from=${encodeURIComponent(queryString)}` : ""}`;
  }

  const statusLabel =
    status === "all_active" ? "All active" : status === "all" ? "All statuses" : recruitmentStatusLabel(status);
  const syncLabel =
    sync?.status === "connected" ? "Google Sheets connected" : sync?.status === "syncing" ? "Syncing" : sync?.status === "failed" ? "Sync failed" : "Google Sheets not connected";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">{archivedView ? "Recruitment  ·  Archived talent" : "Recruitment"}</p>
          <h1 className="mt-1 text-3xl font-semibold text-white">{archivedView ? "Talent Pool — Archived" : "Talent Pool"}</h1>
          <p className="mt-1 text-sm text-slate-400">
            {archivedView
              ? "Archived athletes are excluded from the active talent pool."
              : "Each row is one response from the recruitment form, in the same column order."}
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm text-slate-300">
          <span className="inline-flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${sync?.status === "failed" ? "bg-red-400" : "bg-emerald-400"}`} />
            {syncLabel}
            <span className="text-slate-500">|</span>
            {relativeSync(sync?.lastSuccessAt ?? null)}
          </span>
          <button
            type="button"
            onClick={() => void load(true)}
            className="inline-flex items-center gap-2 rounded-full border border-cyan-400/40 px-3 py-1.5 text-xs font-semibold text-cyan-200 hover:bg-cyan-400/10"
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {sync?.lastError ? <p className="text-sm text-red-300">{sync.lastError}</p> : null}
      {error ? <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p> : null}

      <input
        value={searchDraft}
        onChange={(event) => setSearchDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;
          replaceParams((params) => {
            if (searchDraft.trim()) params.set("q", searchDraft.trim());
            else params.delete("q");
            params.set("page", "1");
          });
        }}
        placeholder="Search by name, software, or keyword..."
        className="w-full rounded-xl border border-white/[0.08] bg-[#0b1220] px-4 py-3 text-sm text-white placeholder:text-slate-500"
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setDraftSoftware(selectedSoftware);
              setDraftMatch(match);
              setSoftwareOpen((open) => !open);
              setStatusOpen(false);
            }}
            className={field}
          >
            Software: {selectedSoftware.length === 0 ? "All software" : `${selectedSoftware.length} selected`} ▾
          </button>
          {softwareOpen ? (
            <div className="absolute z-30 mt-2 w-72 rounded-xl border border-white/[0.1] bg-[#0d1526] p-3 shadow-2xl">
              <input
                value={softwareQuery}
                onChange={(event) => setSoftwareQuery(event.target.value)}
                placeholder="Search software..."
                className="w-full rounded-lg border border-white/[0.08] bg-[#0b1220] px-3 py-2 text-sm text-white"
              />
              <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto">
                {visibleSoftware.length === 0 ? <li className="px-1 py-2 text-xs text-slate-500">No software submitted yet.</li> : null}
                {visibleSoftware.map((item) => (
                  <li key={item}>
                    <label className="flex items-center gap-2 rounded-md px-1 py-1.5 text-sm text-slate-200 hover:bg-white/[0.04]">
                      <input
                        type="checkbox"
                        checked={draftSoftware.includes(item)}
                        onChange={() =>
                          setDraftSoftware((current) =>
                            current.includes(item) ? current.filter((value) => value !== item) : [...current, item],
                          )
                        }
                      />
                      {item}
                    </label>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex items-center gap-4 border-t border-white/[0.06] pt-3 text-sm text-slate-300">
                <label className="inline-flex items-center gap-2">
                  <input type="radio" checked={draftMatch === "any"} onChange={() => setDraftMatch("any")} />
                  Match any
                </label>
                <label className="inline-flex items-center gap-2">
                  <input type="radio" checked={draftMatch === "all"} onChange={() => setDraftMatch("all")} />
                  Match all
                </label>
              </div>
              <button
                type="button"
                onClick={() => {
                  replaceParams((params) => {
                    params.delete("software");
                    draftSoftware.forEach((item) => params.append("software", item));
                    params.set("match", draftMatch);
                    params.set("page", "1");
                  });
                  setSoftwareOpen(false);
                }}
                className="mt-3 w-full rounded-lg bg-cyan-400 py-2 text-sm font-semibold text-slate-950"
              >
                Apply filters
              </button>
            </div>
          ) : null}
        </div>
        <select
          value={experience}
          onChange={(event) =>
            replaceParams((params) => {
              params.set("experience", event.target.value);
              params.set("page", "1");
            })
          }
          className={`select-console ${field}`}
          aria-label="Experience"
        >
          <option value="all">Experience: All experience</option>
          {RECRUITMENT_EXPERIENCE.map((item) => (
            <option key={item.value} value={item.value}>
              Experience: {item.label}
            </option>
          ))}
        </select>
        <select
          value={availability}
          onChange={(event) =>
            replaceParams((params) => {
              params.set("availability", event.target.value);
              params.set("page", "1");
            })
          }
          className={`select-console ${field}`}
          aria-label="Availability"
        >
          <option value="all">Availability: All availability</option>
          {RECRUITMENT_AVAILABILITY.map((item) => (
            <option key={item.value} value={item.value}>
              Availability: {item.label}
            </option>
          ))}
        </select>
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setStatusOpen((open) => !open);
              setSoftwareOpen(false);
            }}
            className={`${field} inline-flex items-center gap-2`}
          >
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: status === "all_active" || status === "all" ? "#22d3ee" : statusDot(status) }} />
            Status: {statusLabel} ▾
          </button>
          {statusOpen ? (
            <div className="absolute z-30 mt-2 w-64 rounded-xl border border-white/[0.1] bg-[#0d1526] p-2 shadow-2xl">
              {[
                { value: "all_active", label: "All active", hint: "All active excludes archived athletes" },
                ...RECRUITMENT_STATUSES.map((item) => ({ value: item.value, label: item.label, hint: "" })),
                { value: "all", label: "All statuses", hint: "" },
              ].map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => {
                    replaceParams((params) => {
                      params.set("status", item.value);
                      params.set("page", "1");
                    });
                    setStatusOpen(false);
                  }}
                  className="flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left text-sm text-white hover:bg-white/[0.05]"
                >
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: item.value === "all_active" || item.value === "all" ? "#22d3ee" : statusDot(item.value) }} />
                  <span>
                    <span className="block">{item.label}</span>
                    {item.hint ? <span className="block text-[11px] text-slate-500">{item.hint}</span> : null}
                  </span>
                  {status === item.value ? <span className="ml-auto text-cyan-300">✓</span> : null}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => router.replace("/dashboard/recruitment/talent-pool")}
          className="ml-auto rounded-lg border border-white/[0.1] px-3 py-2 text-sm text-slate-300"
        >
          Clear filters
        </button>
      </div>

      {(selectedSoftware.length > 0 || experience !== "all" || availability !== "all" || status !== "all_active") && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-slate-500">Active filters:</span>
          {selectedSoftware.map((item) => (
            <FilterChip
              key={item}
              label={item}
              onRemove={() =>
                replaceParams((params) => {
                  const remaining = params.getAll("software").filter((value) => value !== item);
                  params.delete("software");
                  remaining.forEach((value) => params.append("software", value));
                  params.set("page", "1");
                })
              }
            />
          ))}
          {experience !== "all" ? (
            <FilterChip
              label={recruitmentExperienceLabel(experience)}
              onRemove={() => replaceParams((params) => params.delete("experience"))}
            />
          ) : null}
          {availability !== "all" ? (
            <FilterChip
              label={recruitmentAvailabilityLabel(availability)}
              onRemove={() => replaceParams((params) => params.delete("availability"))}
            />
          ) : null}
          {status !== "all_active" ? (
            <FilterChip label={statusLabel} onRemove={() => replaceParams((params) => params.delete("status"))} />
          ) : null}
        </div>
      )}

      <p className="text-sm text-slate-400">
        {loading ? "Loading…" : `${total} form response${total === 1 ? "" : "s"}`}
      </p>

      <SheetTable
        rows={rows}
        loading={loading}
        configured={Boolean(sync?.configured)}
        archivedView={archivedView}
        profileHref={profileHref}
        onStatus={(row, next) => {
          if (next === "archived") {
            setReason("no_longer_interested");
            setComment("");
            setArchiveFor(row);
            return;
          }
          if (row.status === "archived") {
            setRestoreStatus(next);
            setRestoreFor(row);
            return;
          }
          void patch(row.id, { status: next });
        }}
        onRestore={(row) => {
          setRestoreStatus(row.previousStatus && row.previousStatus !== "archived" ? row.previousStatus : "potential");
          setRestoreFor(row);
        }}
      />

      <div className="flex items-center justify-between text-sm text-slate-400">
        <button type="button" disabled={page <= 1} onClick={() => replaceParams((params) => params.set("page", String(page - 1)))} className="disabled:opacity-40">
          Previous
        </button>
        <span>
          Page {page} of {totalPages}
        </span>
        <button type="button" disabled={page >= totalPages} onClick={() => replaceParams((params) => params.set("page", String(page + 1)))} className="disabled:opacity-40">
          Next
        </button>
      </div>

      {archiveFor ? (
        <dialog open className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
          <form
            className="w-full max-w-md rounded-2xl border border-white/[0.1] bg-[#10192b] p-5 shadow-2xl"
            onSubmit={(event) => {
              event.preventDefault();
              void patch(archiveFor.id, { archive: true, archiveReason: reason, archiveComment: comment }).then((ok) => {
                if (ok) setArchiveFor(null);
              });
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-white">Archive athlete</h2>
                <p className="text-sm text-slate-400">{archiveFor.fullName}</p>
              </div>
              <button type="button" onClick={() => setArchiveFor(null)} className="text-slate-400">
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
              <textarea value={comment} onChange={(event) => setComment(event.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-white/[0.08] bg-[#0b1220] px-3 py-2 text-sm text-white" />
            </label>
            <p className="mt-2 text-xs text-slate-500">You can restore this athlete later.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setArchiveFor(null)} className="rounded-lg border border-white/[0.1] px-3 py-1.5 text-sm text-slate-300">
                Cancel
              </button>
              <button disabled={saving} className="rounded-lg bg-cyan-400 px-3 py-1.5 text-sm font-semibold text-slate-950">
                Archive athlete
              </button>
            </div>
          </form>
        </dialog>
      ) : null}

      {restoreFor ? (
        <aside className="fixed inset-y-0 right-0 z-40 flex w-full max-w-sm flex-col border-l border-white/[0.08] bg-[#10192b] p-5 shadow-2xl">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Restore athlete</h2>
            <button type="button" onClick={() => setRestoreFor(null)} className="text-slate-400">
              ×
            </button>
          </div>
          <div className="mt-6 flex items-center gap-3">
            <Avatar name={restoreFor.fullName} />
            <p className="font-medium text-white">{restoreFor.fullName}</p>
          </div>
          <p className="mt-6 text-sm text-white">Return {restoreFor.fullName} to {recruitmentStatusLabel(restoreStatus)}?</p>
          <p className="mt-1 text-sm text-slate-400">Their existing comments and documents will remain available.</p>
          <label className="mt-4 block text-xs text-slate-400">
            Destination status
            <select value={restoreStatus} onChange={(event) => setRestoreStatus(event.target.value)} className={`select-console mt-1 w-full ${field}`}>
              {RECRUITMENT_STATUSES.filter((item) => item.value !== "archived").map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <div className="mt-auto flex justify-end gap-2">
            <button type="button" onClick={() => setRestoreFor(null)} className="rounded-lg border border-white/[0.1] px-3 py-1.5 text-sm text-slate-300">
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() =>
                void patch(restoreFor.id, { restore: true, status: restoreStatus }).then((ok) => {
                  if (ok) setRestoreFor(null);
                })
              }
              className="rounded-lg bg-cyan-400 px-3 py-1.5 text-sm font-semibold text-slate-950"
            >
              Restore
            </button>
          </div>
        </aside>
      ) : null}
    </div>
  );
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <button type="button" onClick={onRemove} className="inline-flex items-center gap-1 rounded-full border border-white/[0.1] bg-white/[0.04] px-2.5 py-1 text-xs text-white">
      {label} <span aria-hidden>×</span>
    </button>
  );
}

function sheetColumns(rows: Row[]): string[] {
  const known = new Set<string>(RECRUITMENT_FORM_COLUMNS);
  const extras: string[] = [];
  for (const row of rows) {
    for (const answer of row.answers || []) {
      const question = answer.question.trim();
      if (!question || known.has(question) || question.toLowerCase() === "application id" || extras.includes(question)) continue;
      extras.push(question);
    }
  }
  return [...RECRUITMENT_FORM_COLUMNS, ...extras];
}

function SheetTable({
  rows,
  loading,
  configured,
  archivedView,
  profileHref,
  onStatus,
  onRestore,
}: {
  rows: Row[];
  loading: boolean;
  configured: boolean;
  archivedView: boolean;
  profileHref: (id: string) => string;
  onStatus: (row: Row, next: string) => void;
  onRestore: (row: Row) => void;
}) {
  const columns = sheetColumns(rows);
  const extra = archivedView ? 3 : 2;
  return (
    <div className="overflow-x-auto rounded-2xl border border-white/[0.08] bg-[#0b1220]">
      <table className="min-w-max border-separate border-spacing-0 text-left">
        <thead>
          <tr>
            {columns.map((question, index) => (
              <th
                key={question}
                className={`sticky top-0 min-w-[11rem] max-w-[18rem] border-b border-white/[0.08] bg-[#0b1220] px-3 py-2 text-left text-[11px] font-medium text-slate-400 ${index === 1 ? "left-0 z-20" : "z-10"}`}
              >
                {question}
              </th>
            ))}
            {archivedView ? (
              <th className="sticky top-0 z-10 min-w-[9rem] border-b border-l border-white/[0.08] bg-[#10192b] px-3 py-2 text-[11px] font-medium text-slate-400">
                Archive reason
              </th>
            ) : null}
            <th className={`sticky top-0 z-10 min-w-[9rem] border-b border-white/[0.08] bg-[#10192b] px-3 py-2 text-[11px] font-medium text-slate-400 ${archivedView ? "" : "border-l"}`}>
              Status
            </th>
            <th className="sticky top-0 z-10 min-w-[8rem] border-b border-white/[0.08] bg-[#10192b] px-3 py-2 text-[11px] font-medium text-slate-400">
              Profile
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && !loading ? (
            <tr>
              <td colSpan={columns.length + extra} className="px-4 py-10 text-center text-sm text-slate-500">
                {configured ? "No responses match these filters." : "Connect the recruitment Google Sheet to import applications."}
              </td>
            </tr>
          ) : null}
          {rows.map((row) => {
            const answers = formAnswersInSheetOrder(row.answers || []);
            const byQuestion = new Map(answers.map((answer) => [answer.question, answer.answer]));
            return (
              <tr key={row.id} className="align-top">
                {columns.map((question, index) => (
                  <SheetCell
                    key={question}
                    value={question === "Full name" ? byQuestion.get(question) || row.fullName : byQuestion.get(question) || ""}
                    sticky={index === 1}
                    href={question === "Full name" ? profileHref(row.id) : null}
                  />
                ))}
                {archivedView ? (
                  <td className="border-l border-t border-white/[0.05] bg-[#10192b] px-3 py-2 text-xs text-slate-300">
                    {row.archiveReason ? archiveReasonLabel(row.archiveReason) : "—"}
                  </td>
                ) : null}
                <td className={`border-t border-white/[0.05] bg-[#10192b] px-3 py-2 ${archivedView ? "" : "border-l"}`}>
                  <select
                    value={row.status}
                    onChange={(event) => onStatus(row, event.target.value)}
                    className="select-console rounded-full border border-white/[0.08] bg-transparent px-2 py-1 text-xs text-white"
                  >
                    {RECRUITMENT_STATUSES.filter((item) => item.value !== "archived").map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                    <option value="archived">Archived</option>
                  </select>
                </td>
                <td className="border-t border-white/[0.05] bg-[#10192b] px-3 py-2">
                  <Link href={profileHref(row.id)} className="text-xs font-medium text-cyan-300 hover:text-cyan-200">
                    Open
                  </Link>
                  {row.status === "archived" ? (
                    <button type="button" onClick={() => onRestore(row)} className="ml-3 text-xs text-slate-300 hover:text-white">
                      Restore
                    </button>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SheetCell({ value, sticky, href }: { value: string; sticky?: boolean; href?: string | null }) {
  const text = value.trim();
  const className = `max-w-[18rem] min-w-[11rem] border-t border-white/[0.05] px-3 py-2 align-top text-xs text-slate-200 ${sticky ? "sticky left-0 z-10 border-r border-white/[0.08] bg-[#0b1220]" : ""}`;
  if (!text) return <td className={`${className} text-slate-600`}>—</td>;
  if (href) {
    return (
      <td className={className}>
        <Link href={href} className="font-medium text-white hover:text-cyan-200">
          {text}
        </Link>
      </td>
    );
  }
  if (/^https?:\/\/\S+$/.test(text)) {
    return (
      <td className={className}>
        <a href={text} target="_blank" rel="noopener noreferrer" className="text-cyan-300 hover:text-cyan-200">
          Open
        </a>
      </td>
    );
  }
  return (
    <td className={className}>
      <span className="line-clamp-4 whitespace-pre-wrap" title={text}>
        {text}
      </span>
    </td>
  );
}
