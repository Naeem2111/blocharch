import Link from "next/link";
import { loadArchitects } from "@/lib/architects";

export default async function DashboardPage() {
  const architects = loadArchitects();
  const total = architects.length;
  const withEmail = architects.filter((a) => a.email?.trim()).length;

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-2xl font-semibold text-white mb-2">Dashboard</h1>
      <p className="text-slate-400 text-sm mb-8">
        Overview of your architect directory data from architects.json.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5">
          <p className="text-slate-400 text-sm font-medium">Total practices</p>
          <p className="text-3xl font-semibold text-white mt-1">{total}</p>
          <p className="text-xs text-slate-500 mt-1">In directory</p>
        </div>
        <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5">
          <p className="text-slate-400 text-sm font-medium">With email</p>
          <p className="text-3xl font-semibold text-cyan-400 mt-1">{withEmail}</p>
          <p className="text-xs text-slate-500 mt-1">Ready for outreach</p>
        </div>
        <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5">
          <p className="text-slate-400 text-sm font-medium">With website</p>
          <p className="text-3xl font-semibold text-amber-400 mt-1">
            {architects.filter((a) => a.website?.trim()).length}
          </p>
          <p className="text-xs text-slate-500 mt-1">Has website URL</p>
        </div>
        <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5">
          <p className="text-slate-400 text-sm font-medium">Source</p>
          <p className="text-lg font-semibold text-slate-200 mt-1">architects.json</p>
          <p className="text-xs text-slate-500 mt-1">Base data</p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link
          href="/dashboard/practices"
          className="block bg-slate-800/60 border border-slate-700 rounded-xl p-5 hover:border-cyan-500/50 transition-colors"
        >
          <h3 className="text-white font-semibold mb-1">Browse practices</h3>
          <p className="text-slate-400 text-sm">
            Search and filter all architect & landscape practices from the directory.
          </p>
        </Link>
        <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5">
          <h3 className="text-white font-semibold mb-1">Scraper</h3>
          <p className="text-slate-400 text-sm mb-3">
            Run <code className="text-cyan-400">python scrape_architects.py</code> to
            update architects.json.
          </p>
          <p className="text-slate-500 text-xs">
            Data is read directly from architects.json in the project root.
          </p>
        </div>
      </div>
    </div>
  );
}
