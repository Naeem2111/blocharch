import { loadMasterArtworkConfig } from "@/lib/content-generator/config";
import { composeArtworkPrompt } from "@/lib/content-generator/compose";
import { editImages, GenerationError } from "@/lib/content-generator/openai";
import {
  readSessionFile,
  saveSession,
  tryLockSession,
  unlockSession,
  writeSessionOutput,
  type GeneratorSession,
} from "@/lib/content-generator/session-store";
import { mimeForExt, type ImageExt } from "@/lib/content-generator/image-file";

function extOf(name: string): ImageExt {
  if (name.endsWith(".png")) return "png";
  if (name.endsWith(".webp")) return "webp";
  return "jpg";
}

export async function runArtworkJob(
  session: GeneratorSession,
  mode: "original" | "refine",
  instruction?: string,
): Promise<GeneratorSession> {
  if (!tryLockSession(session.id)) {
    throw new GenerationError("Artwork is already being generated. Wait for it to finish.", 409);
  }
  try {
    const config = await loadMasterArtworkConfig();
    if (config.provider !== "openai") {
      throw new GenerationError(
        "This generator is set to a provider Phase 01 cannot call yet. Set the provider back to openai in the generator config.",
        500,
      );
    }
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      throw new GenerationError(
        "Artwork generation is not configured yet. An admin needs to set the OpenAI key on the server.",
        503,
      );
    }
    if (mode === "refine") {
      const note = instruction?.trim() ?? "";
      if (!note) throw new GenerationError("Describe what you would like to change.", 400);
      if (note.length > 2000) {
        throw new GenerationError("Keep the refinement to 2000 characters or fewer.", 400);
      }
      if (!session.outputFile) {
        throw new GenerationError("Generate artwork before refining it.", 400);
      }
    }

    const prompt = composeArtworkPrompt({
      masterPrompt: config.prompt,
      method: session.method,
      hex: session.hex,
      mode,
      refinements: session.refinements,
      instruction,
      swatchCount: session.swatchFiles.length,
      hasCurrentArtwork: mode === "refine" && Boolean(session.outputFile),
    });

    const images: { bytes: Buffer; filename: string; mime: string }[] = [
      {
        bytes: await readSessionFile(session, session.sourceFile),
        filename: session.sourceFile,
        mime: mimeForExt(extOf(session.sourceFile)),
      },
    ];
    if (mode === "refine" && session.outputFile) {
      images.push({
        bytes: await readSessionFile(session, session.outputFile),
        filename: session.outputFile,
        mime: "image/png",
      });
    }
    if (session.method === "samples") {
      for (const name of session.swatchFiles) {
        images.push({
          bytes: await readSessionFile(session, name),
          filename: name,
          mime: mimeForExt(extOf(name)),
        });
      }
    }
    if (session.method === "palette" && session.paletteFile) {
      images.push({
        bytes: await readSessionFile(session, session.paletteFile),
        filename: session.paletteFile,
        mime: mimeForExt(extOf(session.paletteFile)),
      });
    }

    const output = await editImages({
      apiKey,
      prompt,
      images,
      model: config.model,
      size: config.output.size,
      quality: config.output.quality,
      inputFidelity: config.output.inputFidelity,
    });
    await writeSessionOutput(session, output);
    session.promptVersion = config.promptVersion;
    session.provider = config.provider;
    session.model = config.model;
    session.size = config.output.size;
    session.quality = config.output.quality;
    if (mode === "refine" && instruction?.trim()) {
      session.refinements = [...session.refinements, instruction.trim()];
    }
    session.running = false;
    session.runningSince = null;
    await saveSession(session);
    return session;
  } finally {
    unlockSession(session.id);
  }
}

export function artworkFilename(iso: string): string {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, "0");
  const stamp = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
  return `blocharch-master-artwork-${stamp}.png`;
}
