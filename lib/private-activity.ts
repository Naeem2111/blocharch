import type { Prisma, PrismaClient } from "@prisma/client";
import { PRIVATE_STAGE_LABELS } from "@/lib/private-constants";
import {
  allDesignPhases,
  findDesignPhase,
  type PhaseStructure,
} from "@/lib/private-phase-structure";
import { parseStageDateMap, type StageDateMap } from "@/lib/private-stage-dates";

type Db = PrismaClient | Prisma.TransactionClient;

export type PrivateActivityKind =
  | "note"
  | "stage"
  | "file"
  | "action"
  | "action_done"
  | "description"
  | "date";

export async function recordPrivateActivity(
  db: Db,
  input: {
    projectId: string;
    title: string;
    body?: string | null;
    kind?: PrivateActivityKind;
    sourceKey?: string | null;
    clientVisible?: boolean;
  },
) {
  const sourceKey = input.sourceKey?.trim() || null;
  if (sourceKey) {
    const existing = await db.privateProjectUpdate.findUnique({ where: { sourceKey } });
    if (existing) return existing;
  }
  return db.privateProjectUpdate.create({
    data: {
      projectId: input.projectId,
      title: input.title.slice(0, 200),
      body: input.body?.trim() ? input.body.trim().slice(0, 2000) : null,
      kind: input.kind ?? "note",
      sourceKey,
      clientVisible: input.clientVisible ?? true,
      occurredAt: new Date(),
    },
  });
}

export function designPhaseLabel(structure: PhaseStructure, key: string | null | undefined): string {
  if (!key) return "this stage";
  const found = findDesignPhase(structure, key);
  if (found) return found.phase.name;
  const byKey = allDesignPhases(structure).find((phase) => phase.builtInKey === key || phase.id === key);
  if (byKey) return byKey.name;
  if (key in PRIVATE_STAGE_LABELS) return PRIVATE_STAGE_LABELS[key as keyof typeof PRIVATE_STAGE_LABELS];
  return key.replace(/_/g, " ");
}

function formatUkDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatRange(range: { from: string | null; to: string | null } | undefined): string | null {
  if (!range?.from && !range?.to) return null;
  const from = formatUkDate(range.from);
  const to = formatUkDate(range.to);
  if (from && to && from !== to) return `${from} – ${to}`;
  return from ?? to;
}

export function targetDateActivityLines(
  beforeRaw: unknown,
  afterRaw: unknown,
  structure: PhaseStructure,
): string[] {
  const before = parseStageDateMap(beforeRaw) ?? {};
  const after = parseStageDateMap(afterRaw) ?? {};
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const lines: string[] = [];
  for (const key of Array.from(keys)) {
    const previous = before[key as keyof StageDateMap];
    const next = after[key as keyof StageDateMap];
    if ((previous?.from ?? null) === (next?.from ?? null) && (previous?.to ?? null) === (next?.to ?? null)) {
      continue;
    }
    const label = designPhaseLabel(structure, key);
    const when = formatRange(next);
    lines.push(when ? `Target date for ${label} is now ${when}.` : `Target date for ${label} was cleared.`);
  }
  return lines;
}

export function dueDateActivityLine(before: Date | null, after: Date | null): string | null {
  const previous = before ? before.toISOString().slice(0, 10) : null;
  const next = after ? after.toISOString().slice(0, 10) : null;
  if (previous === next) return null;
  const formatted = formatUkDate(next);
  return formatted ? `Target date is now ${formatted}.` : "Target date was cleared.";
}
