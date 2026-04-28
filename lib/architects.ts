import { getBestAddressFromFields } from "@/lib/address-display";
import { prisma } from "@/lib/prisma";

export interface Architect {
  url: string;
  name: string;
  website: string;
  socials: string[];
  email: string;
  address: string;
  contact: string;
  description: string;
  years_active: string;
  staff: string;
  awards: string[];
}

export function getBestAddress(a: Architect): string | null {
  return getBestAddressFromFields(a.address, a.description);
}

export async function loadArchitects(): Promise<Architect[]> {
  const rows = await prisma.architect.findMany({
    orderBy: { name: "asc" },
  });
  return rows.map((r) => ({
    url: r.url,
    name: r.name,
    website: r.website || "",
    socials: r.socials,
    email: r.email || "",
    address: r.address || "",
    contact: r.contact || "",
    description: r.description || "",
    years_active: r.yearsActive || "",
    staff: r.staff || "",
    awards: r.awards,
  }));
}

export async function getArchitectByUrl(url: string): Promise<Architect | undefined> {
  const architects = await loadArchitects();
  return architects.find((a) => a.url === url);
}

export async function getArchitectById(id: string): Promise<Architect | undefined> {
  const architects = await loadArchitects();
  const idx = architects.findIndex((a) => a.url === id || encodeURIComponent(a.url) === id);
  return idx >= 0 ? architects[idx] : undefined;
}

export async function searchArchitects(params: {
  q?: string;
  page?: number;
  perPage?: number;
}): Promise<{ items: Architect[]; total: number; page: number; totalPages: number }> {
  const architects = await loadArchitects();
  let filtered = architects;

  const q = (params.q || "").trim().toLowerCase();
  if (q) {
    filtered = architects.filter(
      (a) =>
        a.name?.toLowerCase().includes(q) ||
        a.description?.toLowerCase().includes(q) ||
        a.email?.toLowerCase().includes(q) ||
        a.address?.toLowerCase().includes(q) ||
        a.contact?.toLowerCase().includes(q)
    );
  }

  const total = filtered.length;
  const page = Math.max(1, params.page || 1);
  const perPage = Math.min(50, Math.max(10, params.perPage || 25));
  const totalPages = Math.ceil(total / perPage);
  const start = (page - 1) * perPage;
  const items = filtered.slice(start, start + perPage);

  return { items, total, page, totalPages };
}
