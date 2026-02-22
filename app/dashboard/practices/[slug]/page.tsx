import { notFound } from "next/navigation";
import Link from "next/link";
import { loadArchitects } from "@/lib/architects";
import { LeadStatus } from "@/components/LeadStatus";

function slugFromUrl(url: string): string {
  const m = url.match(/\/practice\/([^/]+)\/?$/);
  return m ? m[1] : "";
}

export default async function PracticeDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const architects = loadArchitects();
  const decoded = decodeURIComponent(slug);
  const practice = architects.find(
    (a) =>
      slugFromUrl(a.url) === decoded ||
      slugFromUrl(a.url) === slug ||
      a.url.endsWith("/" + decoded) ||
      a.url.endsWith("/" + slug)
  );

  if (!practice) notFound();

  return (
    <div className="max-w-4xl mx-auto">
      <Link
        href="/dashboard/practices"
        className="inline-flex items-center text-slate-400 hover:text-white text-sm mb-6"
      >
        ← Back to practices
      </Link>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-slate-800/60 border border-slate-700 rounded-xl overflow-hidden">
        <div className="p-6 border-b border-slate-700">
          <h1 className="text-2xl font-semibold text-white">{practice.name}</h1>
          {practice.website && (
            <a
              href={practice.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan-400 hover:underline text-sm mt-1 inline-block"
            >
              {practice.website}
            </a>
          )}
        </div>
        <div className="p-6 space-y-4">
          {practice.email && (
            <div>
              <p className="text-slate-500 text-xs font-medium uppercase tracking-wider mb-1">
                Email
              </p>
              <a
                href={`mailto:${practice.email}`}
                className="text-cyan-400 hover:underline"
              >
                {practice.email}
              </a>
            </div>
          )}
          {practice.contact && (
            <div>
              <p className="text-slate-500 text-xs font-medium uppercase tracking-wider mb-1">
                Contact
              </p>
              <p className="text-slate-200">{practice.contact}</p>
            </div>
          )}
          {practice.address && (
            <div>
              <p className="text-slate-500 text-xs font-medium uppercase tracking-wider mb-1">
                Address
              </p>
              <p className="text-slate-200">{practice.address}</p>
            </div>
          )}
          {(practice.years_active || practice.staff) && (
            <div className="flex gap-8">
              {practice.years_active && (
                <div>
                  <p className="text-slate-500 text-xs font-medium uppercase tracking-wider mb-1">
                    Years active
                  </p>
                  <p className="text-slate-200">{practice.years_active}</p>
                </div>
              )}
              {practice.staff && (
                <div>
                  <p className="text-slate-500 text-xs font-medium uppercase tracking-wider mb-1">
                    Staff
                  </p>
                  <p className="text-slate-200">{practice.staff}</p>
                </div>
              )}
            </div>
          )}
          {practice.description && (
            <div>
              <p className="text-slate-500 text-xs font-medium uppercase tracking-wider mb-1">
                Description
              </p>
              <p className="text-slate-300 text-sm leading-relaxed">
                {practice.description}
              </p>
            </div>
          )}
          {practice.socials && practice.socials.length > 0 && (
            <div>
              <p className="text-slate-500 text-xs font-medium uppercase tracking-wider mb-1">
                Social links
              </p>
              <div className="flex flex-wrap gap-2">
                {practice.socials.map((s) => (
                  <a
                    key={s}
                    href={s}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan-400 hover:underline text-sm"
                  >
                    {s}
                  </a>
                ))}
              </div>
            </div>
          )}
          <div className="pt-2">
            <p className="text-slate-500 text-xs font-medium uppercase tracking-wider mb-1">
              Source
            </p>
            <a
              href={practice.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-400 hover:text-cyan-400 text-sm"
            >
              {practice.url}
            </a>
          </div>
        </div>
      </div>
        </div>
        <div className="lg:col-span-1">
          <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-6 sticky top-4">
            <h2 className="text-lg font-semibold text-white mb-4">Lead status</h2>
            <LeadStatus slug={decoded} />
          </div>
        </div>
      </div>
    </div>
  );
}
