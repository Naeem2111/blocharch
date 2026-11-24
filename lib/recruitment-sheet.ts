import { googleAccessToken, isGoogleDriveConfigured } from "@/lib/google-drive";

const DEFAULT_SHEET_ID = "1VQwMTTruINqDtrViRcd3bjx0cxJhRnlmxFmM-AKowww";
const DEFAULT_SHEET_GID = 838227526;
const SHEET_TITLE = "Form responses 1";

export type RecruitApplicant = {
  rowNumber: number;
  submittedAt: string;
  fullName: string;
  email: string;
  emailAlt: string;
  phone: string;
  city: string;
  years: string;
  fullTime: string;
  experience: string;
  kit: string;
  position: string;
  portfolioUrl: string;
  cvUrl: string;
};

export function recruitmentSheetId(): string {
  return process.env.RECRUITMENT_SHEET_ID?.trim() || DEFAULT_SHEET_ID;
}

function recruitmentSheetGid(): number {
  const raw = Number(process.env.RECRUITMENT_SHEET_GID?.trim() || DEFAULT_SHEET_GID);
  return Number.isFinite(raw) ? raw : DEFAULT_SHEET_GID;
}

export function isRecruitmentSheetConfigured(): boolean {
  return isGoogleDriveConfigured();
}

function cell(row: string[], index: number): string {
  return (row[index] ?? "").trim();
}

function toApplicant(row: string[], rowNumber: number): RecruitApplicant | null {
  const fullName = cell(row, 1);
  if (!fullName) return null;
  const email = cell(row, 2);
  const emailAlt = cell(row, 27);
  return {
    rowNumber,
    submittedAt: cell(row, 0),
    fullName,
    email,
    emailAlt: emailAlt && emailAlt.toLowerCase() !== email.toLowerCase() ? emailAlt : "",
    phone: cell(row, 3),
    city: cell(row, 5),
    years: cell(row, 12),
    fullTime: cell(row, 22),
    experience: cell(row, 11),
    kit: cell(row, 24),
    position: cell(row, 31),
    portfolioUrl: cell(row, 8),
    cvUrl: cell(row, 10),
  };
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

async function readViaApi(): Promise<string[][] | null> {
  if (!isGoogleDriveConfigured()) return null;
  const token = await googleAccessToken();
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(recruitmentSheetId())}/values/${encodeURIComponent(SHEET_TITLE)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  if (!res.ok) return null;
  const data = (await res.json()) as { values?: string[][] };
  return data.values ?? null;
}

async function readViaCsv(): Promise<string[][]> {
  const url = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(recruitmentSheetId())}/export?format=csv&gid=${recruitmentSheetGid()}`;
  const res = await fetch(url, { cache: "no-store", redirect: "follow" });
  if (!res.ok) {
    throw new Error("The recruitment sheet could not be read. Share it so the dashboard Google account can view it.");
  }
  const text = await res.text();
  if (text.includes("accounts.google.com") || text.trim().startsWith("<!")) {
    throw new Error("The recruitment sheet is private. Share it with the dashboard Google account.");
  }
  return parseCsv(text);
}

export async function listRecruitApplicants(): Promise<RecruitApplicant[]> {
  const grid = (await readViaApi()) ?? (await readViaCsv());
  return grid
    .slice(1)
    .map((row, index) => toApplicant(row, index + 2))
    .filter((row): row is RecruitApplicant => row != null);
}

export async function deleteRecruitmentRow(rowNumber: number): Promise<void> {
  if (!Number.isInteger(rowNumber) || rowNumber < 2) {
    throw new Error("That applicant row is not on the sheet.");
  }
  if (!isGoogleDriveConfigured()) {
    throw new Error("Google is not connected, so the sheet row cannot be deleted.");
  }
  const token = await googleAccessToken();
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(recruitmentSheetId())}:batchUpdate`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: recruitmentSheetGid(),
                dimension: "ROWS",
                startIndex: rowNumber - 1,
                endIndex: rowNumber,
              },
            },
          },
        ],
      }),
    },
  );
  if (res.ok) return;
  const data = (await res.json().catch(() => ({}))) as { error?: { message?: string; status?: string } };
  const message = data.error?.message || "";
  if (res.status === 403 || /insufficient/i.test(message)) {
    throw new Error(
      "Google needs Sheets access. An admin must open /api/google/oauth/start, sign in again, and share the recruitment sheet with that Google account.",
    );
  }
  throw new Error(message || "The sheet row could not be deleted.");
}
