import type { ColourMethod } from "@/lib/content-generator/validate";

function colourSection(
  method: ColourMethod,
  hex: string[],
  swatchCount: number,
  hasCurrentArtwork: boolean,
): string {
  const swatchLead = hasCurrentArtwork
    ? `Image 1 is the source photograph. Image 2 is the current artwork. The remaining ${swatchCount} image${swatchCount === 1 ? "" : "s"} ${swatchCount === 1 ? "is a colour swatch" : "are colour swatches"}, in order.`
    : `Image 1 is the source photograph. The next ${swatchCount} image${swatchCount === 1 ? "" : "s"} ${swatchCount === 1 ? "is a colour swatch" : "are colour swatches"}, in order.`;
  const paletteLead = hasCurrentArtwork
    ? "Image 1 is the source photograph. Image 2 is the current artwork. The following image is a colour palette reference, not part of the scene."
    : "Image 1 is the source photograph. The next image is a colour palette reference, not part of the scene.";
  const sourceLead = hasCurrentArtwork
    ? "Image 1 is the source photograph. Image 2 is the current artwork."
    : "Image 1 is the source photograph.";

  if (method === "samples") {
    const named =
      hex.length > 0 ? ` Named readings of those swatches, in order: ${hex.join(", ")}.` : "";
    return [
      "COLOUR TREATMENT",
      "Use the supplied swatch palette only.",
      "Limit the artwork to those colours. Do not introduce unrelated colours.",
      "Translate the photograph into clean flat colour blocks.",
      `${swatchLead}${named}`,
    ].join("\n");
  }

  if (method === "hex") {
    return [
      "COLOUR TREATMENT",
      "Use the supplied palette only.",
      "Limit the artwork to those colours. Do not introduce unrelated colours.",
      "Translate the photograph into clean flat colour blocks.",
      `${sourceLead} There is no swatch image.`,
      `Use only these HEX colours and no others: ${hex.join(", ")}.`,
    ].join("\n");
  }

  if (method === "palette") {
    return [
      "COLOUR TREATMENT",
      "Use the supplied palette only.",
      "Limit the artwork to those colours. Do not introduce unrelated colours.",
      "Translate the photograph into clean flat colour blocks.",
      paletteLead,
      `Use only these extracted colours and no others: ${hex.join(", ")}.`,
    ].join("\n");
  }

  return [
    "COLOUR TREATMENT",
    "Analyse the source photograph.",
    "Preserve its existing colour relationships.",
    "Simplify those colours into flat graphic blocks.",
    "Keep recognisable differences in materials, sky, landscape, water, vegetation, and surroundings.",
    "Do not invent unnecessary colours.",
    "Do not force a limit of 3 to 5 colours. This is not a reduced swatch palette.",
    `${sourceLead} There is no separate palette.`,
  ].join("\n");
}

export function composeArtworkPrompt(args: {
  masterPrompt: string;
  method: ColourMethod;
  hex: string[];
  mode: "original" | "refine";
  refinements: string[];
  instruction?: string;
  swatchCount: number;
  hasCurrentArtwork: boolean;
}): string {
  const parts = [
    args.masterPrompt.trim(),
    colourSection(args.method, args.hex, args.swatchCount, args.hasCurrentArtwork),
  ];

  if (args.mode === "refine") {
    const history =
      args.refinements.length > 0
        ? args.refinements.map((note, index) => `${index + 1}. ${note}`).join("\n")
        : "None.";
    const imageNote = args.hasCurrentArtwork
      ? "Image 1 is the original photograph. Image 2 is the current Master Artwork to adjust. Any images after that are colour references only."
      : "Image 1 is the original photograph.";
    parts.push(
      [
        "REFINEMENT",
        "This is an adjustment to the current artwork, not a new project.",
        imageNote,
        "Change only what the latest instruction asks. Keep the architecture, composition, and every other colour the same unless the instruction explicitly changes them.",
        "Previous refinement instructions, already applied, in order:",
        history,
        "Latest instruction:",
        (args.instruction ?? "").trim(),
      ].join("\n"),
    );
  }

  return parts.join("\n\n");
}
