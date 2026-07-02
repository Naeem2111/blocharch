import { getBestAddressFromFields } from "@/lib/address-display";
import { getOrCreateLead } from "@/lib/leads";
import { prisma } from "@/lib/prisma";
import {
  isValidEmail,
  manualPracticeUrl,
  resolveUniquePracticeSlug,
  slugFromPracticeUrl,
} from "@/lib/practice-url";

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

export type CreateManualPracticeInput = {
  name: string;
  email: string;
  contact?: string;
  website?: string;
  address?: string;
};

export async function createManualPractice(
  input: CreateManualPracticeInput
): Promise<Architect & { slug: string }> {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (!name) throw new Error("Practice name is required");
  if (!email) throw new Error("Email is required");
  if (!isValidEmail(email)) throw new Error("Enter a valid email address");

  const duplicateEmail = await prisma.architect.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { name: true },
  });
  if (duplicateEmail) {
    throw new Error(`A practice with this email already exists (${duplicateEmail.name})`);
  }

  const slug = await resolveUniquePracticeSlug(name);
  const url = manualPracticeUrl(slug);

  const row = await prisma.architect.create({
    data: {
      url,
      name,
      email,
      contact: input.contact?.trim() || null,
      website: input.website?.trim() || null,
      address: input.address?.trim() || null,
      socials: [],
      awards: [],
    },
  });

  await getOrCreateLead(url);

  return {
    url: row.url,
    name: row.name,
    website: row.website || "",
    socials: row.socials,
    email: row.email || "",
    address: row.address || "",
    contact: row.contact || "",
    description: row.description || "",
    years_active: row.yearsActive || "",
    staff: row.staff || "",
    awards: row.awards,
    slug,
  };
}
