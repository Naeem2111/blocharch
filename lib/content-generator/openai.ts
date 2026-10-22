const OPENAI_EDITS_URL = "https://api.openai.com/v1/images/edits";

export class GenerationError extends Error {
  status: number;

  constructor(message: string, status = 502) {
    super(message);
    this.name = "GenerationError";
    this.status = status;
  }
}

function publicGenerationError(status: number, body: string): string {
  let message = "";
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string } };
    message = parsed.error?.message?.trim() ?? "";
  } catch {
    message = "";
  }
  const lower = message.toLowerCase();
  if (status === 401 || lower.includes("api key") || lower.includes("incorrect api key")) {
    return "Artwork generation is not configured correctly. An admin needs to check the OpenAI key.";
  }
  if (lower.includes("billing") || lower.includes("quota") || lower.includes("insufficient")) {
    return "The image service is unavailable right now because the usage limit was reached. Try again later.";
  }
  if (status === 429 || lower.includes("rate limit")) {
    return "The image service is busy. Wait a moment and try again.";
  }
  if (lower.includes("size") || lower.includes("quality") || lower.includes("model")) {
    return "The image service rejected the generator settings. An admin can change the model, size, or quality in the generator config.";
  }
  if (!message || message.length > 240 || lower.includes("master artwork") || lower.includes("prompt")) {
    return "The artwork could not be generated. Your photo and colours are still here — try again.";
  }
  return message;
}

export async function editImages(args: {
  apiKey: string;
  prompt: string;
  images: { bytes: Buffer; filename: string; mime: string }[];
  model: string;
  size: string;
  quality: string;
  inputFidelity: "high" | "low" | null;
}): Promise<Buffer> {
  const form = new FormData();
  form.set("model", args.model);
  form.set("prompt", args.prompt);
  form.set("size", args.size);
  form.set("quality", args.quality);
  form.set("output_format", "png");
  form.set("background", "opaque");
  form.set("n", "1");
  if (args.inputFidelity) form.set("input_fidelity", args.inputFidelity);
  for (const image of args.images) {
    form.append("image[]", new Blob([new Uint8Array(image.bytes)], { type: image.mime }), image.filename);
  }

  let response: Response;
  try {
    response = await fetch(OPENAI_EDITS_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${args.apiKey}` },
      body: form,
      signal: AbortSignal.timeout(180_000),
    });
  } catch {
    throw new GenerationError(
      "The image service did not respond in time. Your photo and colours are still here — try again.",
      504,
    );
  }

  const body = await response.text();
  if (!response.ok) {
    throw new GenerationError(publicGenerationError(response.status, body), response.status === 401 ? 503 : 502);
  }

  let parsed: { data?: { b64_json?: string; url?: string }[] };
  try {
    parsed = JSON.parse(body) as { data?: { b64_json?: string; url?: string }[] };
  } catch {
    throw new GenerationError("The artwork could not be generated. Your photo and colours are still here — try again.");
  }
  const first = parsed.data?.[0];
  if (first?.b64_json) return Buffer.from(first.b64_json, "base64");
  if (first?.url) {
    const image = await fetch(first.url, { signal: AbortSignal.timeout(60_000) });
    if (!image.ok) {
      throw new GenerationError("The artwork could not be retrieved. Try again.");
    }
    return Buffer.from(await image.arrayBuffer());
  }
  throw new GenerationError("The artwork could not be generated. Your photo and colours are still here — try again.");
}
