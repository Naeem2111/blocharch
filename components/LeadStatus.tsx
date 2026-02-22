"use client";

import { useState, useEffect } from "react";

const STAGES = [
  "cold",
  "no_reply",
  "positive_reply",
  "follow_up_interested",
  "negative_reply",
  "follow_up_not_interested",
] as const;

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
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        </button>
      ))}
    </div>
  );
}

export function LeadStatus({ slug }: { slug: string }) {
  const [stage, setStage] = useState("");
  const [rating, setRating] = useState(0);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/leads/${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then((d) => {
        setStage(d.stage || "cold");
        setRating(d.rating ?? 0);
        setNotes(d.notes || "");
      })
      .finally(() => setLoading(false));
  }, [slug]);

  async function update(updates: { stage?: string; rating?: number; notes?: string }) {
    setSaving(true);
    try {
      const res = await fetch(`/api/leads/${encodeURIComponent(slug)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        const d = await res.json();
        if (d.stage !== undefined) setStage(d.stage);
        if (d.rating !== undefined) setRating(d.rating);
        if (d.notes !== undefined) setNotes(d.notes);
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-slate-500 text-sm">Loading lead status…</p>;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-slate-500 text-xs font-medium uppercase tracking-wider mb-1">Pipeline stage</p>
        <select
          value={stage}
          onChange={(e) => update({ stage: e.target.value })}
          disabled={saving}
          className="px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm"
        >
          {STAGES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <div>
        <p className="text-slate-500 text-xs font-medium uppercase tracking-wider mb-1">Rating</p>
        <StarRating value={rating} onChange={(v) => update({ rating: v })} disabled={saving} />
      </div>
      <div>
        <p className="text-slate-500 text-xs font-medium uppercase tracking-wider mb-1">Notes</p>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => update({ notes })}
          disabled={saving}
          rows={3}
          className="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm resize-none"
          placeholder="Add notes…"
        />
      </div>
    </div>
  );
}
