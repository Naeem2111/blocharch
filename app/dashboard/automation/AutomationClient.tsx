"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const STAGES = [
  "cold",
  "no_reply",
  "positive_reply",
  "follow_up_interested",
  "negative_reply",
  "follow_up_not_interested",
] as const;

interface LeadItem {
  url: string;
  name: string;
  email: string;
  contact: string;
  slug: string;
  lead: { stage: string; rating: number; notes?: string; lastEmailedAt?: string };
}

interface Template {
  id: string;
  name: string;
  subject: string;
  body: string;
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
          onClick={() => onChange(n)}
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
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState("intro");
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());
  const [activating, setActivating] = useState(false);
  const [activationResult, setActivationResult] = useState<string | null>(null);

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

  useEffect(() => {
    fetch("/api/templates")
      .then((r) => r.json())
      .then(setTemplates);
  }, []);

  async function updateLead(practiceUrl: string, updates: { stage?: string; rating?: number; notes?: string }) {
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

  function toggleSelect(url: string) {
    setSelectedUrls((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  }

  function toggleSelectAll() {
    if (!data) return;
    if (selectedUrls.size === data.items.length) {
      setSelectedUrls(new Set());
    } else {
      setSelectedUrls(new Set(data.items.map((i) => i.url)));
    }
  }

  async function activateWorkflow() {
    setActivating(true);
    setActivationResult(null);
    try {
      const res = await fetch("/api/workflow/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          practiceUrls: selectedUrls.size > 0 ? Array.from(selectedUrls) : undefined,
          templateId: selectedTemplate,
          markAsContacted: true,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setActivationResult(`Processed ${json.processed} leads. ${json.webhookCalled ? "Webhook called." : "Set N8N_WEBHOOK_URL to send to n8n."}`);
        setSelectedUrls(new Set());
        if (data) setData({ ...data, items: [...data.items] }); // refresh
      } else {
        setActivationResult(`Error: ${json.error || "Unknown"}`);
      }
    } catch (e) {
      setActivationResult(`Error: ${String(e)}`);
    } finally {
      setActivating(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Stage filter + workflow */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-slate-400 text-sm">Stage:</span>
          <select
            value={stage}
            onChange={(e) => { setStage(e.target.value); setPage(1); }}
            className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white ring-1 ring-black/20"
          >
            <option value="">All</option>
            {STAGES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="h-6 w-px bg-white/[0.08]" />
        <div className="flex items-center gap-2">
          <span className="text-slate-400 text-sm">Template:</span>
          <select
            value={selectedTemplate}
            onChange={(e) => setSelectedTemplate(e.target.value)}
            className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white ring-1 ring-black/20"
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={activateWorkflow}
          disabled={activating}
          className="rounded-lg bg-gradient-to-r from-brand-500 to-brand-600 px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-brand/25 transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {activating ? "Processing…" : "Activate workflow"}
        </button>
        {activationResult && (
          <span className="text-slate-400 text-sm">{activationResult}</span>
        )}
      </div>

      <p className="text-slate-500 text-sm">
        Select leads to email (or leave unselected to process first 50 with email). Activate will apply the chosen
        template and mark them as contacted. Set <code className="text-brand-400">N8N_WEBHOOK_URL</code> in .env to send
        to n8n. When n8n sends mail, it can POST to <code className="text-brand-400">/api/n8n/lead-event</code> so notes
        and &quot;last emailed&quot; update here (see workflow file).
      </p>

      {/* Leads table */}
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
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={data.items.length > 0 && selectedUrls.size === data.items.length}
                      onChange={toggleSelectAll}
                      className="rounded border-white/20 bg-white/[0.03] accent-brand-500"
                    />
                  </th>
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
                      <input
                        type="checkbox"
                        checked={selectedUrls.has(item.url)}
                        onChange={() => toggleSelect(item.url)}
                        className="rounded border-white/20 bg-white/[0.03] accent-brand-500"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/practices/${encodeURIComponent(item.slug)}`}
                        className="font-medium text-white hover:text-brand-400"
                      >
                        {item.name || "—"}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={item.lead.stage}
                        onChange={(e) => updateLead(item.url, { stage: e.target.value })}
                        className="rounded border border-white/[0.08] bg-white/[0.06] px-2 py-1 text-sm text-white ring-1 ring-white/[0.04]"
                      >
                        {STAGES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
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
                    <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap" title={item.lead.lastEmailedAt}>
                      {formatEmailedAt(item.lead.lastEmailedAt)}
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
