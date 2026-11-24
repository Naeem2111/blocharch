"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RECRUIT_DRAFT_KEY, type RecruitDraft } from "@/lib/recruitment-draft";

type Applicant = RecruitDraft & {
  rowNumber: number;
  submittedAt: string;
  emailAlt: string;
  city: string;
  years: string;
  fullTime: string;
  experience: string;
  kit: string;
  position: string;
  portfolioUrl: string;
  cvUrl: string;
  onboarded: boolean;
};

function suggestCode(fullName: string): string {
  const parts = fullName.split(/\s+/).filter(Boolean);
  const letters = parts.map((part) => part[0] ?? "").join("");
  const code = (letters.length >= 2 ? letters : fullName.slice(0, 3)).toUpperCase().replace(/[^A-Z0-9]/g, "");
  return code.slice(0, 6);
}

function suggestUsername(email: string, fullName: string): string {
  const local = email.split("@")[0]?.toLowerCase().replace(/[^a-z0-9._-]/g, "") ?? "";
  if (local.length >= 2) return local.slice(0, 32);
  return fullName.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.|\.$/g, "").slice(0, 32);
}

export function RecruitmentClient() {
  const router = useRouter();
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyRow, setBusyRow] = useState<number | null>(null);

  const load = useCallback(async () => {
    const response = await fetch("/api/ops/recruitment", { cache: "no-store" });
    const body = (await response.json().catch(() => ({}))) as { applicants?: Applicant[]; error?: string };
    if (!response.ok) {
      setError(body.error || "Could not load recruitment.");
      setApplicants([]);
    } else {
      setError("");
      setApplicants(body.applicants ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function importApplicant(applicant: Applicant) {
    const email = applicant.email || applicant.emailAlt;
    const draft: RecruitDraft = {
      fullName: applicant.fullName,
      email,
      phone: applicant.phone,
      athleteCode: suggestCode(applicant.fullName),
      username: suggestUsername(email, applicant.fullName),
    };
    sessionStorage.setItem(RECRUIT_DRAFT_KEY, JSON.stringify(draft));
    router.push("/dashboard/ops/athletes");
  }

  async function rejectApplicant(applicant: Applicant) {
    const confirmed = window.confirm(
      `Reject ${applicant.fullName}? This removes the application from Recruitment and deletes that row in the Google Sheet. An athlete account that was already created stays.`,
    );
    if (!confirmed) return;
    setBusyRow(applicant.rowNumber);
    setError("");
    const response = await fetch("/api/ops/recruitment/reject", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rowNumber: applicant.rowNumber }),
    });
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    setBusyRow(null);
    if (!response.ok) {
      setError(body.error || "Could not delete that sheet row.");
      return;
    }
    setApplicants((current) => current.filter((row) => row.rowNumber !== applicant.rowNumber));
  }

  if (loading) return <p className="text-sm text-slate-400">Loading applications…</p>;

  return (
    <div className="space-y-3">
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {applicants.length === 0 && !error ? (
        <p className="text-sm text-slate-400">No applications left on the recruitment sheet.</p>
      ) : null}
      {applicants.map((applicant) => (
        <article key={applicant.rowNumber} className="card-tool rounded-xl p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-white">{applicant.fullName}</h2>
              <p className="mt-1 text-sm text-slate-300">
                {applicant.email || "No email"}
                {applicant.emailAlt ? ` · form also has ${applicant.emailAlt}` : ""}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {[applicant.city, applicant.phone, applicant.position].filter(Boolean).join(" · ") || "No contact details"}
              </p>
              <p className="mt-2 text-xs text-slate-400">
                Experience: {applicant.experience || "—"}
                {applicant.years ? ` · ${applicant.years}` : ""}
              </p>
              <p className="mt-1 text-xs text-slate-400">Full-time 160h: {applicant.fullTime || "—"}</p>
              <p className="mt-1 text-xs text-slate-400">Own computer and licenses: {applicant.kit || "—"}</p>
              <div className="mt-2 flex flex-wrap gap-3 text-xs">
                {applicant.portfolioUrl ? (
                  <a className="text-sky-300 hover:underline" href={applicant.portfolioUrl} target="_blank" rel="noreferrer">
                    Portfolio
                  </a>
                ) : null}
                {applicant.cvUrl ? (
                  <a className="text-sky-300 hover:underline" href={applicant.cvUrl} target="_blank" rel="noreferrer">
                    CV
                  </a>
                ) : null}
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              {applicant.onboarded ? (
                <span className="rounded-lg border border-emerald-500/40 px-3 py-2 text-xs font-semibold text-emerald-300">
                  Onboarded
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => importApplicant(applicant)}
                  className="btn-brand-primary rounded-lg px-3 py-2 text-sm"
                >
                  Import
                </button>
              )}
              <button
                type="button"
                disabled={busyRow === applicant.rowNumber}
                onClick={() => void rejectApplicant(applicant)}
                className="rounded-lg border border-red-500/40 px-3 py-2 text-sm text-red-300 hover:bg-red-500/10 disabled:opacity-50"
              >
                {busyRow === applicant.rowNumber ? "Rejecting…" : "Reject"}
              </button>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
