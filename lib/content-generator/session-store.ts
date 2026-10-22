import { mkdir, readFile, readdir, rm, writeFile, rename } from "fs/promises";
import path from "path";
import type { ColourMethod } from "@/lib/content-generator/validate";
import type { ImageExt } from "@/lib/content-generator/image-file";

const ROOT = path.join(process.cwd(), "data", "content-generator-sessions");
const TTL_MS = 24 * 60 * 60 * 1000;
const ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const inflight = new Set<string>();

export type GeneratorSession = {
  id: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  generatorId: "master-artwork";
  promptVersion: string;
  provider: string;
  model: string;
  size: string;
  quality: string;
  method: ColourMethod;
  hex: string[];
  sourceFile: string;
  swatchFiles: string[];
  paletteFile: string | null;
  refinements: string[];
  outputFile: string | null;
  outputUpdatedAt: string | null;
  running: boolean;
  runningSince: string | null;
};

export function isSessionId(id: string): boolean {
  return ID_RE.test(id);
}

function sessionDir(id: string): string {
  if (!isSessionId(id)) throw new Error("Invalid session.");
  const dir = path.resolve(ROOT, id);
  if (!dir.startsWith(path.resolve(ROOT) + path.sep)) throw new Error("Invalid session.");
  return dir;
}

async function writeJson(file: string, data: unknown): Promise<void> {
  const tmp = `${file}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(data));
  await rename(tmp, file);
}

export async function sweepExpiredSessions(): Promise<void> {
  let entries;
  try {
    entries = await readdir(ROOT, { withFileTypes: true });
  } catch {
    return;
  }
  const cutoff = Date.now() - TTL_MS;
  await Promise.all(
    entries.map(async (entry) => {
      if (!entry.isDirectory() || !isSessionId(entry.name)) return;
      try {
        const raw = await readFile(path.join(ROOT, entry.name, "meta.json"), "utf8");
        const meta = JSON.parse(raw) as { updatedAt?: string; createdAt?: string };
        const stamp = Date.parse(meta.updatedAt || meta.createdAt || "");
        if (Number.isFinite(stamp) && stamp < cutoff) {
          await rm(path.join(ROOT, entry.name), { recursive: true, force: true });
        }
      } catch {
        // Leave unreadable folders for a later sweep.
      }
    }),
  );
}

export async function createSession(input: {
  userId: string;
  promptVersion: string;
  provider: string;
  model: string;
  size: string;
  quality: string;
  method: ColourMethod;
  hex: string[];
  source: { bytes: Buffer; ext: ImageExt };
  swatches: { bytes: Buffer; ext: ImageExt }[];
  palette: { bytes: Buffer; ext: ImageExt } | null;
}): Promise<GeneratorSession> {
  await mkdir(ROOT, { recursive: true });
  const id = crypto.randomUUID();
  const dir = sessionDir(id);
  await mkdir(dir, { recursive: true });
  try {
    const sourceFile = `source.${input.source.ext}`;
    await writeFile(path.join(dir, sourceFile), input.source.bytes);
    const swatchFiles: string[] = [];
    for (let index = 0; index < input.swatches.length; index += 1) {
      const swatch = input.swatches[index];
      const name = `swatch-${index}.${swatch.ext}`;
      await writeFile(path.join(dir, name), swatch.bytes);
      swatchFiles.push(name);
    }
    let paletteFile: string | null = null;
    if (input.palette) {
      paletteFile = `palette.${input.palette.ext}`;
      await writeFile(path.join(dir, paletteFile), input.palette.bytes);
    }
    const now = new Date().toISOString();
    const session: GeneratorSession = {
      id,
      userId: input.userId,
      createdAt: now,
      updatedAt: now,
      generatorId: "master-artwork",
      promptVersion: input.promptVersion,
      provider: input.provider,
      model: input.model,
      size: input.size,
      quality: input.quality,
      method: input.method,
      hex: input.hex,
      sourceFile,
      swatchFiles,
      paletteFile,
      refinements: [],
      outputFile: null,
      outputUpdatedAt: null,
      running: false,
      runningSince: null,
    };
    await writeJson(path.join(dir, "meta.json"), session);
    return session;
  } catch (error) {
    await rm(dir, { recursive: true, force: true });
    throw error;
  }
}

export async function readSession(id: string, userId: string): Promise<GeneratorSession | null> {
  if (!isSessionId(id)) return null;
  try {
    const raw = await readFile(path.join(sessionDir(id), "meta.json"), "utf8");
    const session = JSON.parse(raw) as GeneratorSession;
    if (session.userId !== userId) return null;
    const stamp = Date.parse(session.updatedAt || session.createdAt);
    if (!Number.isFinite(stamp) || Date.now() - stamp > TTL_MS) {
      await deleteSession(id, userId);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export async function saveSession(session: GeneratorSession): Promise<void> {
  session.updatedAt = new Date().toISOString();
  await writeJson(path.join(sessionDir(session.id), "meta.json"), session);
}

export async function readSessionFile(session: GeneratorSession, name: string): Promise<Buffer> {
  const base = path.basename(name);
  if (base !== name || name.includes("..")) throw new Error("Invalid file.");
  return readFile(path.join(sessionDir(session.id), base));
}

export async function writeSessionOutput(session: GeneratorSession, bytes: Buffer): Promise<void> {
  const name = "output.png";
  await writeFile(path.join(sessionDir(session.id), name), bytes);
  session.outputFile = name;
  session.outputUpdatedAt = new Date().toISOString();
}

export async function deleteSession(id: string, userId: string): Promise<boolean> {
  if (!isSessionId(id)) return false;
  try {
    const raw = await readFile(path.join(sessionDir(id), "meta.json"), "utf8");
    const meta = JSON.parse(raw) as { userId?: string };
    if (meta.userId !== userId) return false;
  } catch {
    return false;
  }
  inflight.delete(id);
  await rm(sessionDir(id), { recursive: true, force: true });
  return true;
}

export function tryLockSession(id: string): boolean {
  if (inflight.has(id)) return false;
  inflight.add(id);
  return true;
}

export function unlockSession(id: string): void {
  inflight.delete(id);
}
