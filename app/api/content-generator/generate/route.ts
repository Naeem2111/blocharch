import { NextResponse, type NextRequest } from "next/server";
import { loadMasterArtworkConfig } from "@/lib/content-generator/config";
import { jobResponse, requireContentUser, imageUrlFor } from "@/lib/content-generator/http";
import { runArtworkJob } from "@/lib/content-generator/run";
import { createSession, sweepExpiredSessions } from "@/lib/content-generator/session-store";
import {
  isColourMethod,
  isValidHex,
  MAX_IMAGE_BYTES,
  normalizeHex,
  parseHexList,
} from "@/lib/content-generator/validate";
import { sniffImage, type ImageExt } from "@/lib/content-generator/image-file";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function readImage(
  value: FormDataEntryValue | null,
  label: string,
): Promise<{ bytes: Buffer; ext: ImageExt } | NextResponse> {
  if (!(value instanceof File) || value.size === 0) {
    return NextResponse.json({ error: `${label} is required.` }, { status: 400 });
  }
  if (value.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: `${label} must be 20 MB or smaller.` }, { status: 400 });
  }
  const bytes = Buffer.from(await value.arrayBuffer());
  const ext = sniffImage(bytes);
  if (!ext) {
    return NextResponse.json(
      { error: `${label} must be a JPEG, PNG, or WebP image.` },
      { status: 400 },
    );
  }
  return { bytes, ext };
}

function isImage(value: { bytes: Buffer; ext: ImageExt } | NextResponse): value is { bytes: Buffer; ext: ImageExt } {
  return !(value instanceof NextResponse);
}

export async function POST(request: NextRequest) {
  const auth = await requireContentUser(request);
  if (auth instanceof NextResponse) return auth;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "The upload could not be read. Use images of 20 MB or smaller." }, { status: 400 });
  }

  const methodRaw = String(form.get("method") ?? "");
  if (!isColourMethod(methodRaw)) {
    return NextResponse.json({ error: "Choose a colour treatment." }, { status: 400 });
  }

  const source = await readImage(form.get("source"), "The source image");
  if (!isImage(source)) return source;

  let hex: string[] = [];
  let swatches: { bytes: Buffer; ext: ImageExt }[] = [];
  let palette: { bytes: Buffer; ext: ImageExt } | null = null;

  if (methodRaw === "samples") {
    const files = form.getAll("swatches").filter((entry): entry is File => entry instanceof File);
    if (files.length < 3 || files.length > 5) {
      return NextResponse.json({ error: "Upload 3 to 5 colour samples." }, { status: 400 });
    }
    for (const file of files) {
      const swatch = await readImage(file, "A colour sample");
      if (!isImage(swatch)) return swatch;
      swatches.push(swatch);
    }
    const named = parseOptionalHex(form.get("hex"));
    if (named instanceof NextResponse) return named;
    hex = named.length === swatches.length ? named : [];
  } else if (methodRaw === "hex") {
    let values: string[] = [];
    try {
      const parsed = JSON.parse(String(form.get("hex") ?? "[]")) as unknown;
      if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== "string")) {
        return NextResponse.json({ error: "Enter 3 to 5 HEX colours, like #0000DC." }, { status: 400 });
      }
      values = parsed;
    } catch {
      return NextResponse.json({ error: "Enter 3 to 5 HEX colours, like #0000DC." }, { status: 400 });
    }
    const result = parseHexList(values);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    hex = result.hex;
  } else if (methodRaw === "palette") {
    const uploaded = await readImage(form.get("palette"), "The colour palette");
    if (!isImage(uploaded)) return uploaded;
    palette = uploaded;
    const result = parseHexList(readHexArray(form.get("hex")), { min: 3, max: 8 });
    if (!result.ok) {
      return NextResponse.json(
        {
          error:
            "Could not read enough colours from that palette. Upload a clearer palette image, or choose another colour method.",
        },
        { status: 400 },
      );
    }
    hex = result.hex;
  }

  void sweepExpiredSessions();

  let config;
  try {
    config = await loadMasterArtworkConfig();
  } catch (error) {
    return jobResponse(error, null);
  }

  let session;
  try {
    session = await createSession({
      userId: auth.user.id,
      promptVersion: config.promptVersion,
      provider: config.provider,
      model: config.model,
      size: config.output.size,
      quality: config.output.quality,
      method: methodRaw,
      hex,
      source,
      swatches,
      palette,
    });
  } catch (error) {
    return jobResponse(error, null);
  }

  try {
    const done = await runArtworkJob(session, "original");
    return NextResponse.json({
      sessionId: done.id,
      imageUrl: imageUrlFor(done.id, done.outputUpdatedAt || done.updatedAt),
    });
  } catch (error) {
    return jobResponse(error, session.id);
  }
}

function readHexArray(value: FormDataEntryValue | null): string[] {
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

function parseOptionalHex(value: FormDataEntryValue | null): string[] | NextResponse {
  const values = readHexArray(value);
  if (values.length === 0) return [];
  if (values.length > 5 || values.some((item) => !isValidHex(item))) {
    return NextResponse.json({ error: "Colour sample readings must be HEX codes like #0000DC." }, { status: 400 });
  }
  return values.map(normalizeHex);
}
