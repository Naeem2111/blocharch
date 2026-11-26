/** Shared ops client contact parsing and API response shape. */

import { parseClientDeliverables } from "@/lib/client-portal-deliverables";

export type ClientContactInput = {
	id?: string;
	name: string;
	title: string | null;
	email: string | null;
};

export type ClientContactRow = {
	id: string;
	name: string;
	title: string | null;
	email: string | null;
	sortOrder: number;
};

export function parseContactsFromBody(
	body: unknown,
): ClientContactInput[] | undefined {
	if (body == null || typeof body !== "object" || !("contacts" in body))
		return undefined;
	const raw = (body as { contacts: unknown }).contacts;
	if (!Array.isArray(raw)) return [];
	const out: ClientContactInput[] = [];
	for (const row of raw) {
		if (row == null || typeof row !== "object") continue;
		const idRaw = (row as { id?: unknown }).id;
		const id = typeof idRaw === "string" && idRaw.trim() ? idRaw.trim() : undefined;
		const name = String((row as { name?: unknown }).name ?? "").trim();
		const titleRaw = (row as { title?: unknown }).title;
		const title =
			titleRaw != null && String(titleRaw).trim()
				? String(titleRaw).trim().slice(0, 120)
				: null;
		const emailRaw = (row as { email?: unknown }).email;
		const email =
			emailRaw != null && String(emailRaw).trim()
				? String(emailRaw).trim()
				: null;
		if (!name && !email && !title) continue;
		out.push({ id, name: name || "Office lead", title, email });
	}
	return out;
}

/** Build contacts from legacy single contactPerson + email (PITR / old exports). */
export function contactsFromLegacy(client: {
	contactPerson?: string | null;
	email?: string | null;
	contacts?: { name: string; title?: string | null; email: string | null; sortOrder?: number }[];
}): ClientContactInput[] {
	if (client.contacts?.length) {
		return [...client.contacts]
			.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
			.map((c) => ({
				name: c.name.trim() || "Office lead",
				title: c.title?.trim() || null,
				email: c.email?.trim() || null,
			}));
	}
	const name = client.contactPerson?.trim();
	const email = client.email?.trim() || null;
	if (!name && !email) return [];
	return [{ name: name || "Office lead", title: null, email }];
}

export function serializeContacts(
	contacts: {
		id: string;
		name: string;
		title?: string | null;
		email: string | null;
		sortOrder: number;
	}[],
): ClientContactRow[] {
	return [...contacts]
		.sort((a, b) => a.sortOrder - b.sortOrder)
		.map((c) => ({
			id: c.id,
			name: c.name,
			title: c.title?.trim() || null,
			email: c.email,
			sortOrder: c.sortOrder,
		}));
}

type ClientWithRelations = {
	id: string;
	name: string;
	companyName: string | null;
	software: string | null;
	phone: string | null;
	country: string | null;
	logoUrl: string | null;
	logoBgColor: string | null;
	logoTextTone: string | null;
	status: string;
	slug: string | null;
	publicPortalEnabled: boolean;
	notes: string | null;
	clientLinks?: unknown;
	contacts: {
		id: string;
		name: string;
		title?: string | null;
		email: string | null;
		sortOrder: number;
	}[];
	commercial: {
		pricingTier: string;
		tierPercent: number;
		laneCostGbp: { toNumber?: () => number } | number;
		overtimeBillingGbp: { toNumber?: () => number } | number;
		activeLaneCount: number;
	} | null;
	_count: { projects: number };
};

function num(v: { toNumber?: () => number } | number): number {
	return typeof v === "number" ? v : Number(v);
}

export function mapClientToJson(c: ClientWithRelations) {
	return {
		id: c.id,
		name: c.name,
		companyName: c.companyName,
		software: c.software,
		contacts: serializeContacts(c.contacts),
		phone: c.phone,
		country: c.country,
		logoUrl: c.logoUrl,
		logoBgColor: c.logoBgColor,
		logoTextTone: c.logoTextTone,
		status: c.status,
		slug: c.slug ?? null,
		publicPortalEnabled: c.publicPortalEnabled ?? false,
		notes: c.notes,
		clientLinks: parseClientDeliverables(c.clientLinks),
		projectCount: c._count.projects,
		commercial: c.commercial
			? {
					pricingTier: c.commercial.pricingTier,
					tierPercent: c.commercial.tierPercent,
					laneCostGbp: num(c.commercial.laneCostGbp),
					overtimeBillingGbp: num(c.commercial.overtimeBillingGbp),
					activeLaneCount: c.commercial.activeLaneCount,
				}
			: null,
	};
}

export const clientInclude = {
	commercial: true,
	contacts: { orderBy: { sortOrder: "asc" as const } },
	_count: { select: { projects: true } },
} as const;
