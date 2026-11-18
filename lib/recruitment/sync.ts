import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import {
  answersFromRow,
  documentsFromAnswers,
  fieldFromAnswers,
  headerKey,
  normaliseSoftware,
  parseExperience,
  parsePhone,
  parseSubmittedAt,
} from "@/lib/recruitment/parse";

const STALE_MS = 5 * 60 * 1000;
const STUCK_SYNC_MS = 10 * 60 * 1000;

type SheetConfig = {
  sheetId: string;
  tab: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
};

export function recruitmentSheetConfig(): SheetConfig | null {
  const rawId = process.env.RECRUITMENT_SHEET_ID?.trim();
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN?.trim();
  if (!rawId || !clientId || !clientSecret || !refreshToken) return null;
  const fromUrl = rawId.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return {
    sheetId: fromUrl?.[1] ?? rawId,
    tab: process.env.RECRUITMENT_SHEET_TAB?.trim() || "",
    clientId,
    clientSecret,
    refreshToken,
  };
}

async function accessToken(config: SheetConfig): Promise<string> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: config.refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const data = (await response.json()) as { access_token?: string; error?: string; error_description?: string };
  if (!response.ok || !data.access_token) {
    throw new Error(
      data.error_description ||
        data.error ||
        "Google did not return a token. Reconnect Google access so it includes Sheets.",
    );
  }
  return data.access_token;
}

function rangeFor(tab: string, cells: string): string {
  if (!tab) return cells;
  const title = tab.replace(/'/g, "''");
  return `'${title}'!${cells}`;
}

async function sheetsFetch(token: string, url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text.slice(0, 400) || `Google Sheets returned ${response.status}`);
  }
  return response.json() as Promise<Record<string, unknown>>;
}

async function readGrid(token: string, config: SheetConfig): Promise<string[][]> {
  const range = encodeURIComponent(rangeFor(config.tab, "A1:ZZ"));
  const data = await sheetsFetch(
    token,
    `https://sheets.googleapis.com/v4/spreadsheets/${config.sheetId}/values/${range}`,
  );
  const values = data.values;
  if (!Array.isArray(values)) return [];
  return values.map((row) => (Array.isArray(row) ? row.map((cell) => String(cell ?? "")) : []));
}

async function writeCells(
  token: string,
  config: SheetConfig,
  updates: { range: string; values: string[][] }[],
) {
  if (updates.length === 0) return;
  await sheetsFetch(
    token,
    `https://sheets.googleapis.com/v4/spreadsheets/${config.sheetId}/values:batchUpdate`,
    {
      method: "POST",
      body: JSON.stringify({
        valueInputOption: "RAW",
        data: updates.map((update) => ({ range: rangeFor(config.tab, update.range), values: update.values })),
      }),
    },
  );
}

function columnLetters(index: number): string {
  let n = index + 1;
  let letters = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    letters = String.fromCharCode(65 + rem) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}

async function ensureApplicationIds(token: string, config: SheetConfig, grid: string[][]) {
  if (grid.length === 0) return grid;
  const headers = [...(grid[0] ?? [])];
  let idIndex = headers.findIndex((header) => headerKey(header) === "applicationId");
  const updates: { range: string; values: string[][] }[] = [];
  if (idIndex < 0) {
    idIndex = headers.length;
    headers.push("Application ID");
    updates.push({ range: `${columnLetters(idIndex)}1`, values: [["Application ID"]] });
  }
  const next = grid.map((row, index) => {
    if (index === 0) return headers;
    const copy = [...row];
    while (copy.length <= idIndex) copy.push("");
    if (!copy[idIndex]?.trim()) {
      const id = randomUUID();
      copy[idIndex] = id;
      updates.push({ range: `${columnLetters(idIndex)}${index + 1}`, values: [[id]] });
    }
    return copy;
  });
  await writeCells(token, config, updates);
  return next;
}

export async function syncRecruitmentSheet(options?: { force?: boolean }) {
  const config = recruitmentSheetConfig();
  const existing = await prisma.recruitmentSyncState.upsert({
    where: { id: "default" },
    create: { id: "default", status: config ? "connected" : "disconnected" },
    update: {},
  });
  if (!config) {
    await prisma.recruitmentSyncState.update({
      where: { id: "default" },
      data: { status: "disconnected", lastError: "Set RECRUITMENT_SHEET_ID and Google OAuth credentials." },
    });
    return { ok: false as const, error: "Sheet is not connected." };
  }
  const fresh =
    !options?.force &&
    existing.status === "connected" &&
    existing.lastSuccessAt &&
    Date.now() - existing.lastSuccessAt.getTime() < STALE_MS;
  if (fresh) return { ok: true as const, skipped: true };
  const stuck =
    existing.status === "syncing" && Date.now() - existing.updatedAt.getTime() < STUCK_SYNC_MS;
  if (stuck && !options?.force) return { ok: true as const, skipped: true };

  await prisma.recruitmentSyncState.update({
    where: { id: "default" },
    data: { status: "syncing", lastError: null },
  });

  try {
    const token = await accessToken(config);
    const grid = await ensureApplicationIds(token, config, await readGrid(token, config));
    const headers = grid[0] ?? [];
    const idIndex = headers.findIndex((header) => headerKey(header) === "applicationId");
    const suppressed = new Set(
      (await prisma.recruitmentSuppression.findMany({ select: { sourceApplicationId: true } })).map(
        (row) => row.sourceApplicationId,
      ),
    );
    const seen = new Set<string>();

    for (const row of grid.slice(1)) {
      const sourceApplicationId = row[idIndex]?.trim();
      if (!sourceApplicationId || suppressed.has(sourceApplicationId)) continue;
      if (seen.has(sourceApplicationId)) continue;
      seen.add(sourceApplicationId);
      const answers = answersFromRow(headers, row);
      if (answers.length === 0) continue;
      const name = fieldFromAnswers(answers, "name") || "Unnamed applicant";
      const email = fieldFromAnswers(answers, "email");
      const phoneRaw = fieldFromAnswers(answers, "phone");
      const phone = parsePhone(phoneRaw);
      const softwareRaw = fieldFromAnswers(answers, "software");
      const experienceRaw = fieldFromAnswers(answers, "experience");
      const experience = parseExperience(experienceRaw);
      const imported = {
        fullName: name.slice(0, 200),
        email: email?.slice(0, 200) ?? null,
        phoneRaw: phoneRaw?.slice(0, 80) ?? null,
        phoneE164: phone.e164,
        location: fieldFromAnswers(answers, "location")?.slice(0, 200) ?? null,
        software: normaliseSoftware(softwareRaw),
        softwareRaw,
        experience: experience.band,
        experienceRaw,
        experienceYears: experience.years,
        availabilitySubmitted: fieldFromAnswers(answers, "availability"),
        services: fieldFromAnswers(answers, "services"),
        answers,
        documents: documentsFromAnswers(answers),
        submittedAt: parseSubmittedAt(fieldFromAnswers(answers, "submittedAt")),
        removedFromSourceAt: null,
      };
      await prisma.recruitmentApplication.upsert({
        where: { sourceApplicationId },
        create: { sourceApplicationId, ...imported },
        update: imported,
      });
    }

    if (grid.length <= 1) {
      await prisma.recruitmentApplication.updateMany({
        where: { removedFromSourceAt: null },
        data: { removedFromSourceAt: new Date() },
      });
    } else if (seen.size > 0) {
      await prisma.recruitmentApplication.updateMany({
        where: {
          sourceApplicationId: { notIn: Array.from(seen) },
          removedFromSourceAt: null,
        },
        data: { removedFromSourceAt: new Date() },
      });
    }

    await prisma.recruitmentSyncState.update({
      where: { id: "default" },
      data: { status: "connected", lastSuccessAt: new Date(), lastError: null },
    });
    return { ok: true as const, imported: seen.size };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed";
    await prisma.recruitmentSyncState.update({
      where: { id: "default" },
      data: { status: "failed", lastError: message.slice(0, 2000) },
    });
    return { ok: false as const, error: message };
  }
}

export async function recruitmentSyncSummary() {
  const state = await prisma.recruitmentSyncState.findUnique({ where: { id: "default" } });
  return {
    configured: recruitmentSheetConfig() != null,
    status: state?.status ?? "disconnected",
    lastSuccessAt: state?.lastSuccessAt?.toISOString() ?? null,
    lastError: state?.lastError ?? null,
  };
}
