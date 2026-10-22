import { readFile } from "fs/promises";
import path from "path";

export type GeneratorConfig = {
  id: "master-artwork";
  name: string;
  provider: string;
  model: string;
  promptVersion: string;
  prompt: string;
  output: {
    type: "image";
    aspect: "1:1";
    size: string;
    quality: string;
    inputFidelity: "high" | "low" | null;
  };
};

export async function loadMasterArtworkConfig(): Promise<GeneratorConfig> {
  const file = path.join(process.cwd(), "data", "generators", "master-artwork.json");
  let parsed: GeneratorConfig;
  try {
    parsed = JSON.parse(await readFile(file, "utf8")) as GeneratorConfig;
  } catch {
    throw new Error("The Master Artwork generator config could not be read.");
  }
  if (parsed.id !== "master-artwork" || !parsed.prompt?.trim() || !parsed.promptVersion?.trim()) {
    throw new Error("The Master Artwork generator config is incomplete.");
  }
  const fidelity = parsed.output?.inputFidelity;
  return {
    ...parsed,
    name: parsed.name?.trim() || "Master Artwork",
    provider: (process.env.CONTENT_GENERATOR_PROVIDER?.trim() || parsed.provider || "openai").toLowerCase(),
    model: process.env.CONTENT_GENERATOR_MODEL?.trim() || parsed.model,
    promptVersion: parsed.promptVersion.trim(),
    prompt: parsed.prompt,
    output: {
      type: "image",
      aspect: "1:1",
      size: process.env.CONTENT_GENERATOR_SIZE?.trim() || parsed.output?.size || "2048x2048",
      quality: process.env.CONTENT_GENERATOR_QUALITY?.trim() || parsed.output?.quality || "high",
      inputFidelity: fidelity === "low" || fidelity === "high" ? fidelity : "high",
    },
  };
}
