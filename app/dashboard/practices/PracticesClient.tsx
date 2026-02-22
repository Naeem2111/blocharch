"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Architect {
  url: string;
  name: string;
  website: string;
  email: string;
  address: string;
  contact: string;
  staff: string;
}

function slugFromUrl(url: string): string {
  const m = url.match(/\/practice\/([^/]+)\/?$/);
  return m ? m[1] : url;
}

export function PracticesClient() {
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{
    items: Architect[];
    total: number;
    page: number;
    totalPages: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    params.set("page", String(page));
    params.set("perPage", "25");
    fetch(`/api/practices?${params}`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [query, page]);

  return (
    <div>
      <div className="flex gap-3 mb-6">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && setQuery(q)}
          placeholder="Search by name, email, address..."
          className="flex-1 px-4 py-2.5 rounded-lg bg-slate-800/60 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500"
        />
        <button
          onClick={() => { setQuery(q); setPage(1); }}
          className="px-4 py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-600 text-white font-medium transition-colors"
        >
          Search
        </button>
      </div>

      {loading && (
        <p className="text-slate-400 py-8">Loading...</p>
      )}
      {!loading && data && (
        <>
          <p className="text-slate-500 text-sm mb-4">
            {data.total} practice{data.total !== 1 ? "s" : ""} found
          </p>
          <div className="overflow-x-auto rounded-xl border border-slate-700">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-800/80 text-left text-sm text-slate-400">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Contact</th>
                  <th className="px-4 py-3 font-medium">Staff</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {data.items.map((p) => (
                  <tr key={p.url} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-medium text-white">{p.name || "—"}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-300 text-sm">
                      {p.email ? (
                        <a
                          href={`mailto:${p.email}`}
                          className="text-cyan-400 hover:underline"
                        >
                          {p.email}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-300 text-sm">
                      {p.contact || "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-sm">
                      {p.staff || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/practices/${encodeURIComponent(slugFromUrl(p.url))}`}
                        className="text-cyan-400 hover:text-cyan-300 text-sm font-medium"
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
                className="px-3 py-1.5 rounded bg-slate-700 text-slate-300 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                Previous
              </button>
              <span className="text-slate-400 text-sm">
                Page {page} of {data.totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                disabled={page >= data.totalPages}
                className="px-3 py-1.5 rounded bg-slate-700 text-slate-300 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
