import type { ClientPortalDeliverable } from "@/lib/client-portal-deliverables";

function linkKind(url: string | null, label?: string): "zoom" | "pinterest" | "link" {
  const value = `${url ?? ""} ${label ?? ""}`.toLowerCase();
  if (/\bzoom\b|zoom\.us|zoom\.com|zoomgov\.com/.test(value)) return "zoom";
  if (/pinterest|pin\.it/.test(value)) return "pinterest";
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

function LinkGlyph({ kind }: { kind: "zoom" | "pinterest" | "link" }) {
  if (kind === "pinterest") {
    return (
      <svg viewBox="0 0 24 24" className="h-9 w-9 shrink-0" aria-hidden>
        <path
          fill="#E60023"
          d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.099.12.112.225.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.401.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.354-.629-2.758-1.379l-.749 2.848c-.269 1.045-1.004 2.352-1.498 3.146 1.123.345 2.306.535 3.55.535 6.607 0 11.985-5.365 11.985-11.987C23.97 5.39 18.592.026 11.985.026L12.017 0z"
        />
      </svg>
    );
  }
  if (kind === "zoom") {
    return (
      <svg viewBox="0 0 24 24" className="h-9 w-9 shrink-0" aria-hidden>
        <rect width="24" height="24" rx="7" fill="#2D8CFF" />
        <path
          fill="#fff"
          d="M4.8 8.4c0-.8.6-1.4 1.4-1.4h7.2c.8 0 1.4.6 1.4 1.4v7.2c0 .8-.6 1.4-1.4 1.4H6.2c-.8 0-1.4-.6-1.4-1.4V8.4z"
        />
        <path fill="#fff" d="M16.2 10.1 19.6 8v8l-3.4-2.1v-3.8z" />
      </svg>
    );
  }
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-500 text-xs font-bold text-white">
      ↗
    </span>
  );
}

function ExternalIcon() {
  return (
    <svg className="h-3.5 w-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5M15 3h6m0 0v6m0-6L10.5 13.5"
      />
    </svg>
  );
}

export function PortalQuickLinks({ links }: { links: ClientPortalDeliverable[] }) {
  return (
    <section className="client-portal-card flex flex-col rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
      <p className="text-sm font-semibold text-white">Quick links</p>
      <p className="mt-1 text-xs text-white">Access important project resources.</p>
      <ul className="mt-3 space-y-2">
        {links.length === 0 ? (
          <li className="text-sm text-white">Links will appear here once they are added.</li>
        ) : null}
        {links.map((link, index) => {
          const parts = splitLinkLabel(link.label.replace(/^🔗\s*/, ""), link.url);
          const kind = linkKind(link.url, link.label);
          return (
            <li key={`${link.label}-${index}`}>
              <a
                href={link.url ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-xl border border-white/[0.1] bg-white/[0.03] px-3 py-2.5 hover:bg-white/[0.06]"
              >
                <LinkGlyph kind={kind} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-white">{parts.title}</span>
                  <span className="block truncate text-xs text-white">{parts.subtitle}</span>
                </span>
                <ExternalIcon />
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
