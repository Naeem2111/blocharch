import type { RecruitmentExperience } from "@prisma/client";
import type { RecruitmentAnswer, RecruitmentDocument } from "@/lib/recruitment/constants";

const SOFTWARE_LABELS: { match: RegExp; label: string }[] = [
  { match: /auto\s*cad|autocad/i, label: "AutoCAD" },
  { match: /archi\s*cad|archicad/i, label: "ArchiCAD" },
  { match: /revit/i, label: "Revit" },
  { match: /sketchup/i, label: "SketchUp" },
  { match: /\brhino\b|rhinoceros/i, label: "Rhino" },
  { match: /vectorworks/i, label: "Vectorworks" },
  { match: /photoshop/i, label: "Photoshop" },
  { match: /illustrator/i, label: "Illustrator" },
  { match: /indesign/i, label: "InDesign" },
  { match: /lumion/i, label: "Lumion" },
  { match: /enscape/i, label: "Enscape" },
  { match: /twinmotion/i, label: "Twinmotion" },
  { match: /v-?ray/i, label: "V-Ray" },
  { match: /corona/i, label: "Corona" },
  { match: /blender/i, label: "Blender" },
  { match: /3ds?\s*max/i, label: "3ds Max" },
  { match: /cinema\s*4d/i, label: "Cinema 4D" },
  { match: /microstation/i, label: "MicroStation" },
];

export function parsePhone(raw: string | null | undefined): {
  e164: string | null;
  ambiguous: boolean;
} {
  const text = raw?.trim() ?? "";
  if (!text) return { e164: null, ambiguous: false };
  const digits = text.replace(/\D/g, "");
  if (text.startsWith("+") && digits.length >= 8 && digits.length <= 15) {
    return { e164: `+${digits}`, ambiguous: false };
  }
  if (/^00\d/.test(text.replace(/\s/g, "")) && digits.length >= 10 && digits.length <= 17) {
    const international = digits.replace(/^00/, "");
    if (international.length >= 8 && international.length <= 15) {
      return { e164: `+${international}`, ambiguous: false };
    }
  }
  return { e164: null, ambiguous: digits.length > 0 };
}

export function whatsAppHref(e164: string | null): string | null {
  if (!e164) return null;
  return `https://wa.me/${e164.replace(/\D/g, "")}`;
}

function experienceBand(years: number): RecruitmentExperience {
  if (years < 3) return "under_3";
  if (years < 5) return "from_3_under_5";
  if (years < 10) return "from_5_under_10";
  return "ten_plus";
}

export function parseExperience(raw: string | null | undefined): {
  band: RecruitmentExperience;
  years: number | null;
} {
  const text = raw?.trim() ?? "";
  if (!text) return { band: "not_specified", years: null };
  const numbers = Array.from(text.matchAll(/(\d+(?:\.\d+)?)/g)).map((match) => Number(match[1]));
  if (numbers.length === 0 || numbers.some((value) => !Number.isFinite(value))) {
    return { band: "not_specified", years: null };
  }
  const bands = numbers.map(experienceBand);
  if (new Set(bands).size > 1) return { band: "not_specified", years: null };
  return { band: bands[0]!, years: Math.min(...numbers) };
}

export function normaliseSoftware(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  const parts = raw
    .split(/[,;/|\n]|\band\b/i)
    .map((part) => part.trim())
    .filter(Boolean);
  const labels: string[] = [];
  for (const part of parts) {
    const known = SOFTWARE_LABELS.find((item) => item.match.test(part));
    const label = known?.label ?? part.replace(/\s+/g, " ");
    if (!labels.some((existing) => existing.toLowerCase() === label.toLowerCase())) labels.push(label);
  }
  return labels;
}

export function driveFileId(url: string): string | null {
  const file = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (file) return file[1]!;
  const query = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (query) return query[1]!;
  const open = url.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/);
  return open?.[1] ?? null;
}

function documentKind(question: string): RecruitmentDocument["kind"] {
  const text = question.toLowerCase();
  if (/passport|identity|id\s*document|national id/.test(text)) return "identity";
  if (/\bcv\b|resume|curriculum/.test(text)) return "cv";
  if (/portfolio/.test(text)) return "portfolio";
  return "other";
}

const HEADER_ALIASES: Record<string, string> = {
  name: "name",
  "full name": "name",
  "athlete name": "name",
  "your name": "name",
  email: "email",
  "email address": "email",
  phone: "phone",
  mobile: "phone",
  "mobile number": "phone",
  "phone number": "phone",
  "contact number": "phone",
  whatsapp: "phone",
  "whatsapp number": "phone",
  location: "location",
  city: "location",
  "where are you based": "location",
  "current location": "location",
  software: "software",
  programmes: "software",
  programs: "software",
  "software used": "software",
  "which software": "software",
  experience: "experience",
  "years of experience": "experience",
  "years experience": "experience",
  availability: "availability",
  "when can you start": "availability",
  services: "services",
  "services offered": "services",
};

export function headerKey(header: string): string | null {
  const normalised = header.trim().toLowerCase().replace(/\s+/g, " ").replace(/[?:*]+$/g, "").trim();
  if (/^application id$/.test(normalised)) return "applicationId";
  if (/^timestamp$|^submitted/.test(normalised)) return "submittedAt";
  const alias = HEADER_ALIASES[normalised];
  if (alias) return alias;
  // The live form uses full questions, not the short labels above.
  if (/city\s*&\s*country/.test(normalised)) return "location";
  if (/what software are you proficient in/.test(normalised)) return "software";
  if (/how many years of experience/.test(normalised)) return "experience";
  if (/what services can you confidently deliver/.test(normalised)) return "services";
  if (/typical monthly availability/.test(normalised)) return "availability";
  if (/available fulltime|160\s*hrs/.test(normalised)) return "fullTime";
  if (/realistically start/.test(normalised)) return "start";
  if (/current professional position/.test(normalised)) return "position";
  return null;
}

export function answersFromRow(headers: string[], row: string[]): RecruitmentAnswer[] {
  const answers: RecruitmentAnswer[] = [];
  headers.forEach((header, index) => {
    const question = header.trim();
    if (!question || headerKey(question) === "applicationId") return;
    const answer = (row[index] ?? "").trim();
    if (!answer) return;
    answers.push({ question, answer });
  });
  return answers;
}

export function documentsFromAnswers(answers: RecruitmentAnswer[]): RecruitmentDocument[] {
  const documents: RecruitmentDocument[] = [];
  for (const answer of answers) {
    const urls = answer.answer.match(/https?:\/\/[^\s,]+/g) ?? [];
    const driveUrls = urls.filter((url) => /drive\.google|docs\.google/.test(url));
    if (driveUrls.length === 0) continue;
    const kind = documentKind(answer.question);
    driveUrls.forEach((url, index) => {
      documents.push({
        label: driveUrls.length > 1 ? `${answer.question} ${index + 1}` : answer.question,
        url,
        fileId: driveFileId(url),
        kind,
        restricted: kind === "identity",
      });
    });
  }
  return documents;
}

export function fieldFromAnswers(answers: RecruitmentAnswer[], key: string): string | null {
  for (const answer of answers) {
    if (headerKey(answer.question) === key) return answer.answer;
  }
  return null;
}

export function parseSubmittedAt(raw: string | null): Date | null {
  if (!raw?.trim()) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
