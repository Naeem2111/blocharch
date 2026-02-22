import path from "path";
import fs from "fs";

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

let cachedArchitects: Architect[] | null = null;

export function getArchitectsFilePath(): string {
  return path.join(process.cwd(), "architects.json");
}

export function loadArchitects(): Architect[] {
  if (cachedArchitects) return cachedArchitects;
  const filePath = getArchitectsFilePath();
  if (!fs.existsSync(filePath)) {
    return [];
  }
  const raw = fs.readFileSync(filePath, "utf-8");
  try {
    cachedArchitects = JSON.parse(raw) as Architect[];
    return cachedArchitects;
  } catch {
    return [];
  }
}

export function getArchitectByUrl(url: string): Architect | undefined {
  const architects = loadArchitects();
  return architects.find((a) => a.url === url);
}

export function getArchitectById(id: string): Architect | undefined {
  const architects = loadArchitects();
  const idx = architects.findIndex((a) => a.url === id || encodeURIComponent(a.url) === id);
  return idx >= 0 ? architects[idx] : undefined;
}

export function searchArchitects(params: {
  q?: string;
  page?: number;
  perPage?: number;
}): { items: Architect[]; total: number; page: number; totalPages: number } {
  const architects = loadArchitects();
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
