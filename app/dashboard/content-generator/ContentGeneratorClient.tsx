"use client";

import { useRef, useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { dominantColours } from "@/lib/content-generator/palette";
import {
  isAllowedImageName,
  isValidHex,
  MAX_IMAGE_BYTES,
  parseHexList,
  type ColourMethod,
} from "@/lib/content-generator/validate";

type Swatch = { file: File; url: string; hex: string | null };
type PaletteFile = { file: File; url: string };

const METHODS: { id: ColourMethod; label: string; hint: string }[] = [
  {
    id: "samples",
    label: "Upload colour samples",
    hint: "3 to 5 swatch images. The artwork stays inside those colours.",
  },
  {
    id: "hex",
    label: "Enter HEX codes",
    hint: "3 to 5 colours, for example #0000DC.",
  },
  {
    id: "palette",
    label: "Upload colour palette",
    hint: "One palette image. Confirm the colours it finds before generating.",
  },
  {
    id: "source",
    label: "Use colours from source image",
    hint: "Keep the photograph’s own colours. No extra colour fields.",
  },
];

async function coloursFromFile(file: File): Promise<string[]> {
  const bitmap = await createImageBitmap(file);
  try {
    const maxEdge = 120;
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Could not read that image.");
    context.drawImage(bitmap, 0, 0, width, height);
    return dominantColours(context.getImageData(0, 0, width, height).data);
  } finally {
    bitmap.close();
  }
}

function fileProblem(file: File): string | null {
  if (!isAllowedImageName(file.name, file.type)) return "Use a JPEG, PNG, or WebP image.";
  if (file.size > MAX_IMAGE_BYTES) return "Images must be 20 MB or smaller.";
  return null;
}

export function ContentGeneratorClient() {
  const sourceInputRef = useRef<HTMLInputElement>(null);
  const swatchInputRef = useRef<HTMLInputElement>(null);
  const paletteInputRef = useRef<HTMLInputElement>(null);
  const sessionIdRef = useRef<string | null>(null);
  const artworkRef = useRef<string | null>(null);

  const [method, setMethod] = useState<ColourMethod | null>(null);
  const [source, setSource] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [swatches, setSwatches] = useState<Swatch[]>([]);
  const [hexes, setHexes] = useState(["", "", "", "", ""]);
  const [palette, setPalette] = useState<PaletteFile | null>(null);
  const [extracted, setExtracted] = useState<string[]>([]);
  const [paletteNote, setPaletteNote] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [artworkUrl, setArtworkUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState<"generate" | "regenerate" | "refine" | "reset" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refineText, setRefineText] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);

  sessionIdRef.current = sessionId;
  artworkRef.current = artworkUrl;
  const locked = Boolean(artworkUrl) || busy !== null;

  function forgetDraftSession() {
    if (artworkRef.current) return;
    const id = sessionIdRef.current;
    if (!id) return;
    sessionIdRef.current = null;
    setSessionId(null);
    void fetch(`/api/content-generator/sessions/${id}`, { method: "DELETE" });
  }

  function replaceSource(file: File | null) {
    forgetDraftSession();
    setSourceUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return file ? URL.createObjectURL(file) : null;
    });
    setSource(file);
    setError(null);
  }

  async function onSource(file: File | undefined) {
    if (!file) return;
    const problem = fileProblem(file);
    if (problem) {
      setError(problem);
      return;
    }
    replaceSource(file);
  }

  async function onSwatches(list: FileList | null) {
    if (!list?.length) return;
    const incoming = Array.from(list);
    const room = 5 - swatches.length;
    if (room <= 0) {
      setError("Colour samples are limited to 5.");
      return;
    }
    forgetDraftSession();
    if (incoming.length > room) {
      setError("Only 5 colour samples can be used. Extra files were not added.");
    } else {
      setError(null);
    }
    const accepted: Swatch[] = [];
    for (const file of incoming.slice(0, room)) {
      const problem = fileProblem(file);
      if (problem) {
        setError(problem);
        continue;
      }
      let hex: string | null = null;
      try {
        hex = (await coloursFromFile(file))[0] ?? null;
      } catch {
        hex = null;
      }
      accepted.push({ file, url: URL.createObjectURL(file), hex });
    }
    if (accepted.length) setSwatches((current) => [...current, ...accepted]);
  }

  function removeSwatch(index: number) {
    forgetDraftSession();
    setSwatches((current) => {
      const next = [...current];
      const [removed] = next.splice(index, 1);
      if (removed) URL.revokeObjectURL(removed.url);
      return next;
    });
  }

  async function onPalette(file: File | undefined) {
    if (!file) return;
    const problem = fileProblem(file);
    if (problem) {
      setPaletteNote(problem);
      return;
    }
    forgetDraftSession();
    setPalette((current) => {
      if (current) URL.revokeObjectURL(current.url);
      return { file, url: URL.createObjectURL(file) };
    });
    setExtracted([]);
    setPaletteNote(null);
    setExtracting(true);
    setError(null);
    try {
      const colours = await coloursFromFile(file);
      setExtracted(colours);
      if (colours.length < 3) {
        setPaletteNote(
          "Could not find enough colours in that palette. Upload a clearer palette image, or choose another colour method.",
        );
      }
    } catch {
      setExtracted([]);
      setPaletteNote("Could not read that palette image. Try another file, or choose another colour method.");
    } finally {
      setExtracting(false);
    }
  }

  function requirement(): string | null {
    if (!source) return "Upload a source image to continue.";
    if (!method) return "Choose a colour treatment.";
    if (method === "samples") {
      if (swatches.length < 3) return `Add at least 3 colour samples (${swatches.length}/5).`;
    }
    if (method === "hex") {
      const parsed = parseHexList(hexes);
      if (!parsed.ok) return parsed.error;
    }
    if (method === "palette") {
      if (!palette) return "Upload a colour palette image.";
      if (extracting) return "Reading colours from the palette…";
      if (paletteNote) return paletteNote;
      if (extracted.length < 3) return "Could not find enough colours in that palette.";
    }
    return null;
  }

  async function applyJob(response: Response) {
    const data = (await response.json().catch(() => ({}))) as {
      error?: string;
      sessionId?: string;
      imageUrl?: string;
    };
    if (response.status === 404) setSessionId(null);
    else if (typeof data.sessionId === "string") setSessionId(data.sessionId);
    if (!response.ok) {
      setError(
        data.error || "The artwork could not be generated. Your photo and colours are still here — try again.",
      );
      return;
    }
    if (data.imageUrl) {
      setArtworkUrl(data.imageUrl);
      setError(null);
    }
  }

  async function onGenerate() {
    if (busy || requirement() || !source || !method) return;
    setBusy("generate");
    setError(null);
    try {
      if (sessionId && !artworkUrl) {
        const response = await fetch(`/api/content-generator/sessions/${sessionId}/regenerate`, {
          method: "POST",
        });
        await applyJob(response);
        return;
      }
      const form = new FormData();
      form.set("source", source);
      form.set("method", method);
      if (method === "samples") {
        for (const swatch of swatches) form.append("swatches", swatch.file);
        const named = swatches.map((swatch) => swatch.hex).filter((hex): hex is string => Boolean(hex));
        if (named.length === swatches.length) form.set("hex", JSON.stringify(named));
      }
      if (method === "hex") {
        const parsed = parseHexList(hexes);
        if (!parsed.ok) return;
        form.set("hex", JSON.stringify(parsed.hex));
      }
      if (method === "palette" && palette) {
        form.set("palette", palette.file);
        form.set("hex", JSON.stringify(extracted));
      }
      const response = await fetch("/api/content-generator/generate", { method: "POST", body: form });
      await applyJob(response);
    } catch {
      setError("The artwork could not be generated. Your photo and colours are still here — try again.");
    } finally {
      setBusy(null);
    }
  }

  async function onRegenerate() {
    if (busy || !sessionId) return;
    setBusy("regenerate");
    setError(null);
    try {
      const response = await fetch(`/api/content-generator/sessions/${sessionId}/regenerate`, {
        method: "POST",
      });
      await applyJob(response);
    } catch {
      setError("The artwork could not be generated. Your photo and colours are still here — try again.");
    } finally {
      setBusy(null);
    }
  }

  async function onRefine() {
    const instruction = refineText.trim();
    if (busy || !sessionId || !instruction) return;
    setBusy("refine");
    setError(null);
    try {
      const response = await fetch(`/api/content-generator/sessions/${sessionId}/refine`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction }),
      });
      await applyJob(response);
      if (response.ok) setRefineText("");
    } catch {
      setError("The artwork could not be updated. Your photo and colours are still here — try again.");
    } finally {
      setBusy(null);
    }
  }

  async function onReset() {
    setBusy("reset");
    const id = sessionIdRef.current;
    if (id) {
      await fetch(`/api/content-generator/sessions/${id}`, { method: "DELETE" }).catch(() => undefined);
    }
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    for (const swatch of swatches) URL.revokeObjectURL(swatch.url);
    if (palette) URL.revokeObjectURL(palette.url);
    sessionIdRef.current = null;
    artworkRef.current = null;
    setSessionId(null);
    setArtworkUrl(null);
    setSource(null);
    setSourceUrl(null);
    setSwatches([]);
    setHexes(["", "", "", "", ""]);
    setPalette(null);
    setExtracted([]);
    setPaletteNote(null);
    setMethod(null);
    setRefineText("");
    setError(null);
    setConfirmReset(false);
    setBusy(null);
  }

  const missing = requirement();
  const running = busy === "generate" || busy === "regenerate" || busy === "refine";
  const hexCount = hexes.map((value) => value.trim()).filter((value) => isValidHex(value)).length;

  return (
    <div className="mt-6 space-y-6">
      <section className="card-tool rounded-2xl p-5 sm:p-6">
        <h2 className="text-sm font-medium text-slate-200">Generator</h2>
        <label className="mt-3 flex cursor-default items-start gap-3 rounded-xl border border-brand-500/40 bg-brand-500/10 px-4 py-3">
          <input type="radio" name="generator" checked readOnly className="mt-1" />
          <span>
            <span className="block text-sm font-semibold text-white">Master Artwork</span>
            <span className="mt-1 block text-sm text-slate-400">
              Flat-colour artwork from one architectural photograph.
            </span>
          </span>
        </label>
      </section>

      <section className="card-tool rounded-2xl p-5 sm:p-6">
        <h2 className="text-sm font-medium text-slate-200">Source image</h2>
        <p className="mt-1 text-sm text-slate-400">One architectural or site photograph.</p>
        <div className="mt-4 flex flex-wrap items-start gap-4">
          <input
            ref={sourceInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
            className="sr-only"
            disabled={locked}
            onChange={(event) => {
              void onSource(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
          <button
            type="button"
            className="btn-secondary rounded-lg px-4 py-2 text-sm font-medium text-slate-100 disabled:opacity-50"
            disabled={locked}
            onClick={() => sourceInputRef.current?.click()}
          >
            {source ? "Replace image" : "Upload image"}
          </button>
          {source && !artworkUrl ? (
            <button
              type="button"
              className="rounded-lg px-3 py-2 text-sm text-slate-300 hover:text-white"
              onClick={() => replaceSource(null)}
            >
              Remove
            </button>
          ) : null}
        </div>
        {sourceUrl ? (
          <img
            src={sourceUrl}
            alt="Uploaded source photograph"
            className="mt-4 max-h-80 w-full rounded-xl border border-white/10 object-contain"
          />
        ) : (
          <p className="mt-4 rounded-xl border border-dashed border-white/15 px-4 py-8 text-center text-sm text-slate-500">
            No source image yet.
          </p>
        )}
      </section>

      <section className="card-tool rounded-2xl p-5 sm:p-6">
        <h2 className="text-sm font-medium text-slate-200">Colour treatment</h2>
        <fieldset className="mt-3 space-y-2" disabled={locked}>
          <legend className="sr-only">Colour treatment</legend>
          {METHODS.map((option) => (
            <label
              key={option.id}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 ${
                method === option.id ? "border-brand-500/40 bg-brand-500/10" : "border-white/10"
              }`}
            >
              <input
                type="radio"
                name="colour-method"
                className="mt-1"
                checked={method === option.id}
                onChange={() => {
                  forgetDraftSession();
                  setMethod(option.id);
                  setError(null);
                }}
              />
              <span>
                <span className="block text-sm font-medium text-white">{option.label}</span>
                <span className="mt-0.5 block text-sm text-slate-400">{option.hint}</span>
              </span>
            </label>
          ))}
        </fieldset>

        {method === "samples" ? (
          <div className="mt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-slate-300">Colour samples</p>
              <p className="text-sm tabular-nums text-slate-400">{swatches.length}/5</p>
            </div>
            <input
              ref={swatchInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
              multiple
              className="sr-only"
              disabled={locked}
              onChange={(event) => {
                void onSwatches(event.target.files);
                event.target.value = "";
              }}
            />
            <button
              type="button"
              className="btn-secondary mt-3 rounded-lg px-4 py-2 text-sm font-medium text-slate-100 disabled:opacity-50"
              disabled={locked || swatches.length >= 5}
              onClick={() => swatchInputRef.current?.click()}
            >
              Add swatches
            </button>
            {swatches.length > 0 ? (
              <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
                {swatches.map((swatch, index) => (
                  <li key={swatch.url} className="rounded-xl border border-white/10 p-2">
                    <img src={swatch.url} alt="" className="aspect-square w-full rounded-lg object-cover" />
                    <p className="mt-2 truncate text-xs text-slate-400">{swatch.hex ?? "Swatch"}</p>
                    <button
                      type="button"
                      className="mt-1 text-xs text-slate-300 hover:text-white disabled:opacity-50"
                      disabled={locked}
                      onClick={() => removeSwatch(index)}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {method === "hex" ? (
          <div className="mt-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-slate-300">HEX colours</p>
              <p className="text-sm tabular-nums text-slate-400">{hexCount}/5</p>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-5">
              {hexes.map((value, index) => {
                const invalid = value.trim().length > 0 && !isValidHex(value);
                return (
                  <label key={index} className="block">
                    <span className="sr-only">Colour {index + 1}</span>
                    <input
                      value={value}
                      disabled={locked}
                      placeholder="#0000DC"
                      spellCheck={false}
                      onChange={(event) => {
                        forgetDraftSession();
                        const next = [...hexes];
                        next[index] = event.target.value;
                        setHexes(next);
                        setError(null);
                      }}
                      className={`field-console w-full rounded-lg px-3 py-2 font-mono text-sm uppercase outline-none ${
                        invalid ? "border-red-400/70" : ""
                      }`}
                    />
                  </label>
                );
              })}
            </div>
          </div>
        ) : null}

        {method === "palette" ? (
          <div className="mt-4">
            <input
              ref={paletteInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
              className="sr-only"
              disabled={locked}
              onChange={(event) => {
                void onPalette(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
            <button
              type="button"
              className="btn-secondary rounded-lg px-4 py-2 text-sm font-medium text-slate-100 disabled:opacity-50"
              disabled={locked}
              onClick={() => paletteInputRef.current?.click()}
            >
              {palette ? "Replace palette" : "Upload palette"}
            </button>
            {palette ? (
              <img
                src={palette.url}
                alt="Uploaded colour palette"
                className="mt-4 max-h-48 rounded-xl border border-white/10 object-contain"
              />
            ) : null}
            {extracting ? <p className="mt-3 text-sm text-slate-400">Reading colours from the palette…</p> : null}
            {extracted.length > 0 ? (
              <div className="mt-3">
                <p className="text-sm text-slate-300">{extracted.length} colours</p>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {extracted.map((colour) => (
                    <li
                      key={colour}
                      className="flex items-center gap-2 rounded-full border border-white/10 py-1 pl-1 pr-3 text-xs text-slate-200"
                    >
                      <span className="h-5 w-5 rounded-full border border-white/20" style={{ backgroundColor: colour }} />
                      {colour}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {paletteNote ? <p className="mt-3 text-sm text-red-300">{paletteNote}</p> : null}
          </div>
        ) : null}
      </section>

      {!artworkUrl ? (
        <div>
          <button
            type="button"
            className="btn-brand-primary rounded-lg px-5 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            disabled={Boolean(missing) || running}
            onClick={() => void onGenerate()}
          >
            {running ? "Generating artwork…" : "Generate artwork"}
          </button>
          {running ? (
            <p className="mt-3 text-sm text-slate-300" role="status">
              Generating Master Artwork. This usually takes up to a minute.
            </p>
          ) : missing ? (
            <p className="mt-3 text-sm text-slate-400">{missing}</p>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200" role="alert">
          {error}
        </p>
      ) : null}

      {artworkUrl ? (
        <section className="card-tool rounded-2xl p-5 sm:p-6">
          <h2 className="text-sm font-medium text-slate-200">Master Artwork</h2>
          {running ? (
            <p className="mt-2 text-sm text-slate-300" role="status">
              {busy === "refine" ? "Applying refinement." : "Generating another version."} This usually takes up to a
              minute.
            </p>
          ) : null}
          <img
            src={artworkUrl}
            alt="Generated Master Artwork"
            className="mt-4 aspect-square w-full rounded-xl border border-white/10 bg-black/20 object-contain"
          />
          <div className="mt-4 flex flex-wrap gap-2">
            <a
              href={`/api/content-generator/sessions/${sessionId}/image?download=1`}
              className="btn-brand-primary rounded-lg px-4 py-2 text-sm"
            >
              Download
            </a>
            <button
              type="button"
              className="btn-secondary rounded-lg px-4 py-2 text-sm font-medium text-slate-100 disabled:opacity-50"
              disabled={running}
              onClick={() => void onRegenerate()}
            >
              Regenerate
            </button>
            <button
              type="button"
              className="btn-secondary rounded-lg px-4 py-2 text-sm font-medium text-slate-100 disabled:opacity-50"
              disabled={running}
              onClick={() => {
                if (!refineText.trim()) {
                  document.getElementById("refine")?.focus();
                  return;
                }
                void onRefine();
              }}
            >
              Refine
            </button>
            <button
              type="button"
              className="btn-secondary rounded-lg px-4 py-2 text-sm font-medium text-slate-100 disabled:opacity-50"
              disabled={running}
              onClick={() => setConfirmReset(true)}
            >
              Start again
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Regenerate tries again with the original photo and colours. It does not replay refinements.
          </p>
          <form
            className="mt-4"
            onSubmit={(event) => {
              event.preventDefault();
              void onRefine();
            }}
          >
            <label htmlFor="refine" className="text-sm font-medium text-slate-200">
              What would you like to change?
            </label>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <input
                id="refine"
                value={refineText}
                disabled={running}
                placeholder="Type your instruction here…"
                onChange={(event) => setRefineText(event.target.value)}
                className="field-console min-w-0 flex-1 rounded-lg px-3 py-2 text-sm outline-none"
              />
              <button
                type="submit"
                className="btn-brand-primary rounded-lg px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                disabled={running || !refineText.trim()}
              >
                Apply refinement
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <ConfirmDialog
        open={confirmReset}
        title="Start again?"
        body="This clears the source image, colour treatment, and the artwork from this session."
        confirmLabel="Start again"
        cancelLabel="Keep artwork"
        busy={busy === "reset"}
        onConfirm={() => void onReset()}
        onClose={() => {
          if (busy !== "reset") setConfirmReset(false);
        }}
      />
    </div>
  );
}
