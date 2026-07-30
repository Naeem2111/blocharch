import { getBestAddressFromFields } from "@/lib/address-display";
import { geocodeAndPersistArchitect } from "@/lib/geocode-architect";
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
  phone: string;
  description: string;
  years_active: string;
  staff: string;
  awards: string[];
}

export function getBestAddress(a: Architect): string | null {
  return getBestAddressFromFields(a.address, a.description);
}

const ACTIVE_WHERE = { deletedAt: null } as const;

export async function loadArchitects(): Promise<Architect[]> {
  const rows = await prisma.architect.findMany({
    where: ACTIVE_WHERE,
    orderBy: { name: "asc" },
  });
  return rows.map(mapArchitectRow);
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

function filterArchitectsByQuery(architects: Architect[], qRaw?: string): Architect[] {
  const q = (qRaw || "").trim().toLowerCase();
  if (!q) return architects;
  return architects.filter(
    (a) =>
      a.name?.toLowerCase().includes(q) ||
      a.description?.toLowerCase().includes(q) ||
      a.email?.toLowerCase().includes(q) ||
      a.address?.toLowerCase().includes(q) ||
      a.contact?.toLowerCase().includes(q) ||
      a.phone?.toLowerCase().includes(q)
  );
}

function paginateArchitects(
  architects: Architect[],
  params: { page?: number; perPage?: number }
): { items: Architect[]; total: number; page: number; totalPages: number } {
  const total = architects.length;
  const page = Math.max(1, params.page || 1);
  const perPage = Math.min(50, Math.max(10, params.perPage || 25));
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const start = (page - 1) * perPage;
  const items = architects.slice(start, start + perPage);
  return { items, total, page, totalPages };
}

export async function searchArchitects(params: {
  q?: string;
  page?: number;
  perPage?: number;
}): Promise<{ items: Architect[]; total: number; page: number; totalPages: number }> {
  const architects = filterArchitectsByQuery(await loadArchitects(), params.q);
  return paginateArchitects(architects, params);
}

export type DeletedArchitect = Architect & { deletedAt: string };

export async function loadDeletedArchitects(): Promise<DeletedArchitect[]> {
  const rows = await prisma.architect.findMany({
    where: { deletedAt: { not: null } },
    orderBy: { deletedAt: "desc" },
  });
  return rows.map((r) => ({
    ...mapArchitectRow(r),
    deletedAt: (r.deletedAt as Date).toISOString(),
  }));
}

export async function searchDeletedArchitects(params: {
  q?: string;
  page?: number;
  perPage?: number;
}): Promise<{ items: DeletedArchitect[]; total: number; page: number; totalPages: number }> {
  const architects = filterArchitectsByQuery(
    await loadDeletedArchitects(),
    params.q
  ) as DeletedArchitect[];
  return paginateArchitects(architects, params) as {
    items: DeletedArchitect[];
    total: number;
    page: number;
    totalPages: number;
  };
}

export type CreateManualPracticeInput = {
  name: string;
  email: string;
  contact?: string;
  phone?: string;
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
    where: { email: { equals: email, mode: "insensitive" }, deletedAt: null },
    select: { name: true },
  });
  if (duplicateEmail) {
    throw new Error(`A practice with this email already exists (${duplicateEmail.name})`);
  }

  const deletedEmail = await prisma.architect.findFirst({
    where: { email: { equals: email, mode: "insensitive" }, deletedAt: { not: null } },
    select: { name: true },
  });
  if (deletedEmail) {
    throw new Error(
      `A deleted practice with this email exists (${deletedEmail.name}). Restore it from Deleted practices.`
    );
  }

  const slug = await resolveUniquePracticeSlug(name);
  const url = manualPracticeUrl(slug);

  const row = await prisma.architect.create({
    data: {
      url,
      name,
      email,
      contact: input.contact?.trim() || null,
      phone: input.phone?.trim() || null,
      website: input.website?.trim() || null,
      address: input.address?.trim() || null,
      socials: [],
      awards: [],
    },
  });

  await getOrCreateLead(url);

  if (input.address?.trim()) {
    try {
      await geocodeAndPersistArchitect(row.id, input.address.trim(), name);
    } catch (err) {
      console.error("Failed to geocode manual practice on create", row.id, err);
    }
  }

  return {
    url: row.url,
    name: row.name,
    website: row.website || "",
    socials: row.socials,
    email: row.email || "",
    address: row.address || "",
    contact: row.contact || "",
    phone: row.phone || "",
    description: row.description || "",
    years_active: row.yearsActive || "",
    staff: row.staff || "",
    awards: row.awards,
    slug,
  };
}

export type UpdatePracticeInput = {
  name?: string;
  email?: string | null;
  contact?: string | null;
  phone?: string | null;
  website?: string | null;
  address?: string | null;
};

function mapArchitectRow(r: {
  url: string;
  name: string;
  website: string | null;
  socials: string[];
  email: string | null;
  address: string | null;
  contact: string | null;
  phone: string | null;
  description: string | null;
  yearsActive: string | null;
  staff: string | null;
  awards: string[];
}): Architect {
  return {
    url: r.url,
    name: r.name,
    website: r.website || "",
    socials: r.socials,
    email: r.email || "",
    address: r.address || "",
    contact: r.contact || "",
    phone: r.phone || "",
    description: r.description || "",
    years_active: r.yearsActive || "",
    staff: r.staff || "",
    awards: r.awards,
  };
}

export async function findArchitectBySlugOrUrl(
  id: string,
  opts?: { includeDeleted?: boolean }
): Promise<Architect | null> {
  const decoded = decodeURIComponent(id);
  const row = await prisma.architect.findFirst({
    where: {
      AND: [
        opts?.includeDeleted ? {} : ACTIVE_WHERE,
        {
          OR: [
            { url: decoded },
            { url: id },
            { url: { endsWith: `/practice/${decoded}` } },
            { url: { endsWith: `/practice/${id}` } },
          ],
        },
      ],
    },
  });
  return row ? mapArchitectRow(row) : null;
}

export async function updateArchitect(
  id: string,
  input: UpdatePracticeInput
): Promise<Architect & { slug: string }> {
  const existing = await findArchitectBySlugOrUrl(id);
  if (!existing) throw new Error("Practice not found");

  const updates: UpdatePracticeInput = {};

  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) throw new Error("Practice name cannot be empty");
    updates.name = name;
  }

  if (input.email !== undefined) {
    const email = input.email?.trim().toLowerCase() || "";
    if (email && !isValidEmail(email)) throw new Error("Enter a valid email address");
    if (email) {
      const duplicateEmail = await prisma.architect.findFirst({
        where: {
          email: { equals: email, mode: "insensitive" },
          deletedAt: null,
          NOT: { url: existing.url },
        },
        select: { name: true },
      });
      if (duplicateEmail) {
        throw new Error(`A practice with this email already exists (${duplicateEmail.name})`);
      }
    }
    updates.email = email || null;
  }

  if (input.contact !== undefined) {
    updates.contact = input.contact?.trim() || null;
  }
  if (input.phone !== undefined) {
    updates.phone = input.phone?.trim() || null;
  }
  if (input.website !== undefined) {
    updates.website = input.website?.trim() || null;
  }
  if (input.address !== undefined) {
    updates.address = input.address?.trim() || null;
  }

  const row = await prisma.architect.update({
    where: { url: existing.url },
    data: {
      ...(updates.name !== undefined ? { name: updates.name } : {}),
      ...(updates.email !== undefined ? { email: updates.email } : {}),
      ...(updates.contact !== undefined ? { contact: updates.contact } : {}),
      ...(updates.phone !== undefined ? { phone: updates.phone } : {}),
      ...(updates.website !== undefined ? { website: updates.website } : {}),
      ...(updates.address !== undefined ? { address: updates.address } : {}),
    },
  });

  if (updates.email) {
    await getOrCreateLead(existing.url);
  }

  if (updates.address !== undefined) {
    try {
      await geocodeAndPersistArchitect(row.id, updates.address ?? "", row.name);
    } catch (err) {
      console.error("Failed to geocode practice on address update", row.id, err);
    }
  }

  const architect = mapArchitectRow(row);
  return { ...architect, slug: slugFromPracticeUrl(architect.url) };
}

export async function deleteArchitect(
  id: string
): Promise<{ ok: true; slug: string; name: string }> {
  const existing = await findArchitectBySlugOrUrl(id);
  if (!existing) throw new Error("Practice not found");

  await prisma.architect.update({
    where: { url: existing.url },
    data: { deletedAt: new Date() },
  });
  return {
    ok: true,
    slug: slugFromPracticeUrl(existing.url),
    name: existing.name,
  };
}

export async function restoreArchitect(
  id: string
): Promise<Architect & { slug: string }> {
  const decoded = decodeURIComponent(id);
  const row = await prisma.architect.findFirst({
    where: {
      deletedAt: { not: null },
      OR: [
        { url: decoded },
        { url: id },
        { url: { endsWith: `/practice/${decoded}` } },
        { url: { endsWith: `/practice/${id}` } },
      ],
    },
  });
  if (!row) {
    const active = await findArchitectBySlugOrUrl(id);
    if (active) throw new Error("Practice is not deleted");
    throw new Error("Practice not found");
  }

  const updated = await prisma.architect.update({
    where: { url: row.url },
    data: { deletedAt: null },
  });

  return {
    ...mapArchitectRow(updated),
    slug: slugFromPracticeUrl(updated.url),
  };
}
