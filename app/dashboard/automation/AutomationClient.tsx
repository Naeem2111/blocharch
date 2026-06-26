"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { LEAD_STAGES } from "@/lib/leads";
import { LEAD_STAGE_LABELS } from "@/lib/lead-stage-ui";
import { LeadStagePicker } from "@/components/LeadStagePicker";

const STAGES = LEAD_STAGES;

interface LeadItem {
  url: string;
  name: string;
  email: string;
  contact: string;
  slug: string;
  lead: { stage: string; rating: number; notes?: string; lastEmailedAt?: string };
}

function slugFromUrl(url: string): string {
  const m = url.match(/\/practice\/([^/]+)\/?$/);
  return m ? m[1] : "";
}

function formatEmailedAt(iso?: string): string {
  if (!iso?.trim()) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString(undefined, {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function toDatetimeLocalValue(iso?: string): string {
  if (!iso?.trim()) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function truncateNote(s: string, max: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1) + "…";
}

function StarRating({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={disabled}
          onClick={() => onChange(value === n ? 0 : n)}
          className={`p-0.5 rounded transition-colors ${
            disabled ? "cursor-not-allowed opacity-60" : "hover:scale-110"
          } ${value >= n ? "text-amber-400" : "text-slate-600"}`}
          aria-label={`Rate ${n} stars`}
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        </button>
      ))}
    </div>
  );
}

export function AutomationClient() {
  const [stage, setStage] = useState<string>("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ items: LeadItem[]; total: number; totalPages: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingEmailed, setEditingEmailed] = useState<string | null>(null);
  const [emailedDraft, setEmailedDraft] = useState("");

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("perPage", "25");
    if (stage) params.set("stage", stage);
    params.set("withEmail", "true");
    fetch(`/api/leads?${params}`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [stage, page]);

  async function updateLead(
    practiceUrl: string,
    updates: { stage?: string; rating?: number; notes?: string; lastEmailedAt?: string | null }
  ) {
    const slug = slugFromUrl(practiceUrl);
    const res = await fetch(`/api/leads/${encodeURIComponent(slug)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (!res.ok) return;
    const d = await res.json().catch(() => null);
    if (data && d) {
      setData({
        ...data,
        items: data.items.map((item) =>
          item.url === practiceUrl
            ? {
                ...item,
                lead: {
                  stage: d.stage ?? item.lead.stage,
                  rating: d.rating ?? item.lead.rating,
                  notes: d.notes ?? item.lead.notes,
                  lastEmailedAt: d.lastEmailedAt ?? item.lead.lastEmailedAt,
                },
              }
            : item
        ),
      });
    }
  }

  function startEditEmailed(url: string, current?: string) {
    setEditingEmailed(url);
    setEmailedDraft(toDatetimeLocalValue(current));
  }

  async function saveEmailed(url: string) {
    const iso = emailedDraft ? new Date(emailedDraft).toISOString() : null;
    await updateLead(url, { lastEmailedAt: iso });
    setEditingEmailed(null);
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-slate-400 text-sm">Stage:</span>
          <select
            value={stage}
            onChange={(e) => {
              setStage(e.target.value);
              setPage(1);
            }}
            className="select-console rounded-lg px-3 py-2 text-sm"
          >
            <option value="">All</option>
            {STAGES.map((s) => (
              <option key={s} value={s}>
                {LEAD_STAGE_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="text-slate-500 text-sm">
        Track lead stage, star rating, and last contact date. Click a star again to clear the rating.
      </p>

      {loading ? (
        <p className="text-slate-400 py-8">Loading…</p>
      ) : data ? (
        <>
          <p className="text-slate-500 text-sm">
            {data.total} practice{data.total !== 1 ? "s" : ""} with email
          </p>
          <div className="overflow-x-auto rounded-2xl border border-white/[0.08] bg-white/[0.02] ring-1 ring-white/[0.04]">
            <table className="w-full">
              <thead>
                <tr className="bg-white/[0.04] text-left text-sm text-slate-400">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Stage</th>
                  <th className="px-4 py-3 font-medium">Rating</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">Last emailed</th>
                  <th className="px-4 py-3 font-medium min-w-[10rem]">Activity</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {data.items.map((item) => (
                  <tr key={item.url} className="transition-colors hover:bg-white/[0.03]">
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/practices/${encodeURIComponent(item.slug)}`}
                        className="font-medium text-white hover:text-brand-400"
                      >
                        {item.name || "—"}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <LeadStagePicker
                        value={item.lead.stage}
                        onChange={(s) => updateLead(item.url, { stage: s })}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <StarRating
                        value={item.lead.rating}
                        onChange={(v) => updateLead(item.url, { rating: v })}
                      />
                    </td>
                    <td className="px-4 py-3 text-slate-300 text-sm">
                      {item.email ? (
                        <a href={`mailto:${item.email}`} className="text-brand-400 hover:underline">
                          {item.email}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">
                      {editingEmailed === item.url ? (
                        <div className="flex flex-col gap-1">
                          <input
                            type="datetime-local"
                            value={emailedDraft}
                            onChange={(e) => setEmailedDraft(e.target.value)}
                            className="rounded border border-white/[0.08] bg-white/[0.04] px-2 py-1 text-xs text-white"
                          />
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() => void saveEmailed(item.url)}
                              className="text-brand-400 hover:text-brand-300"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingEmailed(null)}
                              className="text-slate-500"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => startEditEmailed(item.url, item.lead.lastEmailedAt)}
                          className="text-left hover:text-brand-300"
                          title="Click to edit"
                        >
                          {formatEmailedAt(item.lead.lastEmailedAt)}
                        </button>
                      )}
                    </td>
                    <td
                      className="px-4 py-3 text-slate-400 text-xs max-w-[14rem]"
                      title={item.lead.notes || undefined}
                    >
                      {item.lead.notes ? truncateNote(item.lead.notes, 120) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/practices/${encodeURIComponent(item.slug)}`}
                        className="text-brand-400 hover:text-brand-300 text-sm"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.totalPages > 1 && (
            <div className="flex items-center gap-2 mt-4">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded border border-white/[0.08] bg-white/[0.06] px-3 py-1.5 text-sm text-slate-300 ring-1 ring-white/[0.04] transition-colors hover:bg-white/[0.09] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-slate-400 text-sm">
                Page {page} of {data.totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                disabled={page >= data.totalPages}
                className="rounded border border-white/[0.08] bg-white/[0.06] px-3 py-1.5 text-sm text-slate-300 ring-1 ring-white/[0.04] transition-colors hover:bg-white/[0.09] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
