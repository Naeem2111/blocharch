# Product Requirements Document

# BLOCHARCH Content Generator — Phase 01

**Master Artwork Generator**

| Field | Value |
| --- | --- |
| Product | BLOCHARCH Content Generator |
| Phase | 01 — Master Artwork Generator |
| Status | Draft for build |
| Source brief | `public/brand/BLOCHARCH_Content_Generator_Phase_01_Naeem_FINAL.pdf` |
| Prepared for | Naeem |
| Brief date | 25 August 2026 |
| PRD date | 10 September 2026 |
| Primary AI provider | OpenAI |
| Host application | Blocharch Console (existing Next.js app) |

---

## 1. Summary

Phase 01 proves one BLOCHARCH workflow as a product, not a prompt:

**Source image → colour treatment → hidden Master Artwork prompt → AI generation → review → regenerate / refine → download.**

The operator never finds, copies, pastes, or edits the prompt. They never open ChatGPT. They never re-upload the same files just to try again.

This is not the full content platform. It is Generator 01 only. Later generators (captions, naming, sketches, other image types) are direction, not scope.

**Proof-of-concept question:** can the existing Master Artwork prompt become a clean, reliable image generator that another BLOCHARCH person can use without knowing how the prompt works?

If yes, Phase 01 is done. If no, do not add more generators.

---

## 2. Problem

Today, producing a BLOCHARCH Master Artwork requires a person to:

1. Find the correct Master Artwork prompt
2. Copy and paste it into ChatGPT
3. Upload the source photograph
4. Explain colour treatment
5. Re-state artwork rules (flat colour, architectural accuracy, 1:1, etc.)
6. Re-upload and re-explain everything when regenerating
7. Start a new conversation to make a small adjustment

That process is slow, inconsistent, and knowledge-locked to whoever remembers the prompt.

## 3. Outcome

A BLOCHARCH team member who has never used the prompt can:

1. Open the Content Generator
2. Select Master Artwork
3. Upload one architectural / site photograph
4. Choose a colour method
5. Generate artwork
6. Regenerate or refine without re-uploading
7. Download a high-resolution 1:1 Master Artwork

---

## 4. Users

| Role | Who | What they do in Phase 01 |
| --- | --- | --- |
| Operator | BLOCHARCH team member producing artwork | Upload, choose colours, generate, review, refine, download |
| Prompt owner | Person who maintains the Master Artwork prompt | Update generator name, prompt text, prompt version, and AI provider in a simple config location |
| Developer | Naeem | Build and operate Generator 01 inside the existing console |

No client-facing portal. No public generator. No multi-tenant permissions beyond existing console login.

**Assumption:** the generator lives behind the existing Blocharch Console login. Any signed-in internal user who can open the dashboard can use it unless product later restricts access.

---

## 5. Goals and non-goals

### Goals (must ship)

1. One generator: **Master Artwork**
2. Hidden, versioned Master Artwork prompt
3. Source image + four colour treatments
4. Generate, download, regenerate, refine, start again
5. Session context so the user does not re-upload or re-explain
6. Architecture that does not block Generator 02 later

### Non-goals (must not ship in Phase 01)

- Instagram / LinkedIn caption generation
- Social publishing
- Permanent image library / recent generations history
- AI fine-tuning or continuous learning
- Analytics, generator performance reporting
- Full Generator Recipe / Generator Builder
- All existing BLOCHARCH prompts
- Complex in-browser image editing (crop, layers, masks)
- Automated project management
- Multi-user permission systems beyond existing console auth
- Forcing every future generator onto OpenAI

---

## 6. Product vision (out of Phase 01, in for architecture)

Long-term, BLOCHARCH wants one content-generation platform. Each generator already knows:

- Which prompt to use
- What files / fields the user must supply
- Which AI provider to call
- What output to expect

Future generators may include architectural images, project artwork, renders, sketches/models, material content, Instagram captions, LinkedIn captions, project naming (with duplicate-name checks), and other repeatable workflows.

**Build rule:** get Generator 01 right. Learn from Generator 02. Formalise a universal “generator recipe” only after several workflows exist. Do not over-engineer a builder now. Do not hard-code the prompt so deeply that evolving it requires a rebuild.

---

## 7. User journey

```
Open Content Generator
        ↓
Select Master Artwork
        ↓
Upload source architectural image
        ↓
Choose colour treatment
        ↓
Supply colour inputs if required (hidden if not)
        ↓
Generate
        ↓
Review artwork
        ↓
Download  or  Regenerate  or  Refine  or  Start again
        ↓
If refine: type a natural-language instruction → apply → review
        ↓
Repeat regenerate / refine until satisfied
        ↓
Download final high-resolution artwork
        ↓
Done
```

The underlying prompt, model call, and artwork rules stay hidden.

---

## 8. Functional requirements

### 8.1 Generator selection

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-01 | The product is branded **BLOCHARCH Content Generator**. | P0 |
| FR-02 | Phase 01 exposes exactly one generator: **Master Artwork**. | P0 |
| FR-03 | The UI may show Master Artwork as a selectable generator (so later generators can appear beside it) without implementing those generators. | P1 |

### 8.2 Input 01 — source image

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-10 | User uploads **one** architectural or site photograph. | P0 |
| FR-11 | The upload is the primary visual reference for generation. | P0 |
| FR-12 | The generated artwork **must preserve**: architecture, proportions, massing, window sizes, openings, slab relationships, steps, visible furniture, camera position, perspective, and overall composition. | P0 |
| FR-13 | The generator **must not** redesign, distort, or reinterpret building geometry unless the user later asks for that in Refine. | P0 |
| FR-14 | Accept common image types: JPEG, PNG, WebP. Reject other types with a clear error. | P0 |
| FR-15 | Show a preview of the uploaded source image before generate. | P0 |
| FR-16 | Allow replacing the source image before first generate, or via Start Again after generate. | P0 |

**Assumption:** max upload size 20 MB unless OpenAI’s current image-input limit is lower; enforce the stricter limit and tell the user.

### 8.3 Input 02 — colour treatment

The user must choose **exactly one** of four methods.

| ID | Option | User supplies | Palette behaviour |
| --- | --- | --- | --- |
| FR-20 | **Upload colour samples** | Min 3 / max 5 swatch images | Artwork is limited to those colours. Do not invent unrelated colours. |
| FR-21 | **Enter HEX codes** | Min 3 / max 5 HEX values | Same as FR-20. Example set: `#0000DC`, `#D59FA0`, `#B7C8D0`. |
| FR-22 | **Upload colour palette** | One palette image | System analyses the image, extracts intended colours, then treats them as the controlled palette. |
| FR-23 | **Use colours from source image** | Nothing extra | Analyse the source photograph. Preserve natural colour character of architecture, materials, sky, landscape, water, vegetation, and surroundings. **Do not** force a 3–5 colour limit. |

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-24 | Only the fields for the selected option are visible. Option 4 shows no extra colour fields. | P0 |
| FR-25 | HEX inputs validate as `#RRGGBB` (case-insensitive). Invalid values block generate. | P0 |
| FR-26 | Colour sample uploads use the same image types as the source image. | P0 |
| FR-27 | For Options 1–3, generate is blocked until the minimum colour count is met. | P0 |
| FR-28 | For Options 1–3, the UI shows how many colours are currently supplied (e.g. 3/5). | P1 |
| FR-29 | For Option 3, show the extracted colours before generate so the operator can confirm the palette. If extraction fails, block generate and ask for another palette image or a different method. | P1 |

### 8.4 Conditional colour logic

The embedded prompt **must change behaviour** by selected option. This is not optional styling.

**Options 1, 2, 3**

- Use the supplied / extracted palette only
- Limit the artwork to that palette
- Do not introduce unrelated colours
- Translate the photograph into clean flat colour blocks

**Option 4**

- Analyse the source photograph
- Preserve existing colour relationships
- Simplify those colours into flat graphic blocks
- Keep recognisable material and environmental differences
- Do not invent unnecessary colours
- Do not force a 3–5 colour restriction

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-30 | The request sent to OpenAI includes the selected colour method and the colour inputs for that method. | P0 |
| FR-31 | Option 4 must not be implemented as “pick 3–5 colours from the photo.” | P0 |

### 8.5 Generation

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-40 | A single primary action: **Generate artwork**. | P0 |
| FR-41 | Generate is disabled until a source image is present and the selected colour method is valid. | P0 |
| FR-42 | The system composes: embedded Master Prompt + source image + colour method + colour inputs, then sends that to OpenAI. | P0 |
| FR-43 | The operator cannot view, copy, paste, or edit the prompt from the generator UI. | P0 |
| FR-44 | Show a clear in-progress state (generating). Disable Generate / Refine / Regenerate while a job is running. | P0 |
| FR-45 | On failure, show a readable error and keep all inputs so the user can retry. | P0 |
| FR-46 | Produce **one** high-resolution BLOCHARCH Master Artwork per successful job. | P0 |

### 8.6 Output quality (acceptance of the image)

The output must maintain:

- Source architecture, proportions, camera view, and perspective
- Flat colour treatment
- Sharp / hard-edged shadows
- Subtle outlines
- Simplified vegetation
- Simplified but accurate glass and water
- Clean graphic composition
- No unnecessary distortion
- No exaggerated cartoon appearance
- **1:1 square format**
- High-resolution output (highest quality the provider returns; do not downscale for download)

Visual benchmark: the 10 before/after examples in the source brief. Those examples are quality references only. They do not add features.

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-50 | Generated images are 1:1. | P0 |
| FR-51 | Download uses the highest available quality, not a compressed preview. | P0 |

These quality rules live in the embedded prompt. Product success is judged by a BLOCHARCH reviewer against the brief examples, not by an automated vision score in Phase 01.

### 8.7 Output controls

After a successful generation, four controls are always available:

| Control | Meaning | Must retain |
| --- | --- | --- |
| **Download** | Save the current artwork at full quality | Current image |
| **Regenerate** | Try again with **exactly the same** inputs | Source, colour method, colour inputs, prompt, settings |
| **Refine** | Current output is close; change something specific | All of the above **plus** current image, prior refinements, latest instruction |
| **Start again** | New job. Wipe session inputs and outputs | Nothing from the previous job |

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-60 | Download remains available after every generate and every refine. | P0 |
| FR-61 | Regenerate does not ask the user to re-upload anything. | P0 |
| FR-62 | Refine is a conversational bar under the generated image: “What would you like to change?” + **Apply refinement**. | P0 |
| FR-63 | Refine is an adjustment to the **current** artwork, not a new project. | P0 |
| FR-64 | Start Again returns the user to empty inputs (source + colour method unset / default). | P0 |
| FR-65 | Confirm Start Again if a generated image exists, so a finished result is not wiped accidentally. | P1 |

**Example refine instructions the system must handle as edits, not new generations:**

- Keep everything exactly the same but make the sky blue
- Reduce the amount of green
- Do not change the architecture
- Restore the original window proportions
- Make the shadows stronger
- Keep the building white
- Reduce the vegetation
- Use more pink in the background
- Make the artwork less cartoon-like
- Keep this composition and only adjust the colours

### 8.8 Session context

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-70 | During the active session the system remembers: original source image, original colour inputs, selected colour method, embedded prompt identity/version, current generated image, previous refinement requests, latest refinement instruction. | P0 |
| FR-71 | Phase 01 storage is **temporary session storage only**. No permanent library. | P0 |
| FR-72 | If technically useful, keep in-session versions of the current artwork so regenerate/refine/download can target the latest image. A user-facing history browser is optional (P2), not required. | P1 |
| FR-73 | Closing the tab or choosing Start Again discards the session. No promise that artwork is kept after logout. | P0 |
| FR-74 | The user must not re-explain BLOCHARCH style, architectural accuracy, or output format on regenerate or refine. | P0 |

### 8.9 Prompt configuration (admin / backend)

A full Generator Builder is out of scope. The prompt must still be editable without a code rewrite of the whole app.

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-80 | Store generator config in a simple backend/config location, not buried only in a UI component. | P0 |
| FR-81 | Authorised config fields: generator name, embedded prompt, prompt version, AI provider, basic generator settings (e.g. size / quality). | P0 |
| FR-82 | Phase 01 config UI can be basic (file, env, or a small admin form). A visual builder is not required. | P0 |
| FR-83 | Each generation records which prompt version was used (for debugging; no analytics product). | P1 |

---

## 9. Interface requirements

Keep the UI extremely simple. Suggested Phase 01 layout:

```
BLOCHARCH Content Generator
Master Artwork

Source image
  [ Upload image ]     (preview)

Colour treatment
  ( ) Upload colour samples
  ( ) Enter HEX codes
  ( ) Upload colour palette
  ( ) Use colours from source image

  [ only the matching fields for the selected option ]

[ Generate artwork ]

── after generate ──

[ generated 1:1 artwork ]

[ Download ]  [ Regenerate ]  [ Refine ]  [ Start again ]

What would you like to change?
[ Type your instruction here… ]  [ Apply refinement ]
```

| ID | Requirement | Priority |
| --- | --- | --- |
| UX-01 | One screen, one flow. No wizard with many pages unless mobile layout requires stacking. | P0 |
| UX-02 | Colour fields are conditional. Never show HEX, swatches, and palette upload at the same time unless that option is selected. | P0 |
| UX-03 | Match existing Blocharch Console visual language (dashboard shell, typography, dark theme). | P1 |
| UX-04 | Loading, empty, error, and success states are explicit. | P0 |
| UX-05 | Do not expose model names, token counts, or prompt text to the operator. | P0 |

---

## 10. Technical requirements

### 10.1 Placement

Build inside the existing Blocharch Console (Next.js + current auth), as a new dashboard area, e.g. `/dashboard/content-generator`.

Rationale: operators already log in here; Phase 01 should not invent a second app, identity system, or design language.

### 10.2 AI provider

| ID | Requirement | Priority |
| --- | --- | --- |
| TR-01 | Phase 01 uses **OpenAI** because that is where preferred Master Artwork quality is currently achieved. | P0 |
| TR-02 | Provider is a generator setting, not a hardcoded platform-wide choice. Future generators may use Gemini or others. | P0 |
| TR-03 | Output quality beats provider consistency. | P0 |
| TR-04 | API keys stay on the server. The browser never holds the OpenAI secret. | P0 |
| TR-05 | Use the current OpenAI image API that best preserves input-image fidelity for this style of edit/generation. Confirm model at implementation time; store it in generator config so it can change without a UI rewrite. | P0 |

### 10.3 Recommended request composition

Each generate / regenerate / refine call should send:

1. Embedded Master Artwork prompt (current version)
2. Colour-method instructions (Options 1–3 vs Option 4)
3. Source image
4. Colour swatches / palette image / HEX list when applicable
5. For refine: current generated image + ordered refinement notes + latest instruction

Regenerate = same payload as the last generate (or last successful generate before refinements, product default: **same inputs as the original generate, ignoring refinements**).

**Open point:** whether Regenerate after Refine should (A) replay the original generate, or (B) replay the latest refined state with no new instruction. Default for Phase 01: **(A) original generate inputs**, because the brief defines regenerate as “try again using exactly the same information.” Refine remains the path for incremental change. Document this in the UI with button helper text if it is unclear.

### 10.4 Session storage

Minimum viable:

- Server-side generation job with a session id
- Store source bytes, colour assets, HEX list, method, latest output bytes, and refinement log in memory or a short-lived temp store (disk / object storage with TTL)
- Do not add a Prisma image-library table in Phase 01

TTL assumption: keep session assets for **24 hours** or until Start Again / logout, whichever comes first.

### 10.5 Future-proofing without a builder

Use a small generator record, even if only one exists:

```
id: master-artwork
name: Master Artwork
provider: openai
model: <config>
prompt: <text>
promptVersion: <string>
output: { type: image, aspect: 1:1 }
inputs: [sourceImage, colourTreatment]
```

Generator 02 should be addable as another record + UI later, not as a fork of the whole app.

---

## 11. Non-functional requirements

| ID | Requirement |
| --- | --- |
| NFR-01 | A non-technical BLOCHARCH teammate can complete the full journey without training on prompts. |
| NFR-02 | Generate / refine should show progress immediately; typical OpenAI image jobs may take tens of seconds — communicate that, do not look frozen. |
| NFR-03 | Failed API calls never lose the user’s uploads. |
| NFR-04 | Downloads work in current Chrome / Edge / Safari. |
| NFR-05 | Secrets, prompts, and uploaded images are not logged in full in client-side consoles or public error messages. |
| NFR-06 | The UI stays usable on a laptop; mobile is acceptable stacked layout, not a design goal. |
| NFR-07 | One concurrent job per session in Phase 01. No queue UI. |

---

## 12. Success criteria

Phase 01 is successful when another BLOCHARCH team member can independently:

1. Open the platform
2. Select Master Artwork
3. Upload an architectural image
4. Choose the appropriate colour method
5. Supply colour information where necessary
6. Generate the artwork
7. Regenerate if the first output fails
8. Explain corrections in the refinement bar
9. Continue refining until satisfied
10. Download the final high-resolution artwork

**without** finding, copying, or pasting the prompt; opening ChatGPT; knowing prompt engineering; remembering artwork rules; re-uploading after every attempt; or starting a new conversation to make an adjustment.

### Development priority (build order)

The brief’s five functions are the only P0 product bar:

1. **Input** — source image and colour treatment are easy to provide
2. **Generation** — embedded prompt reliably produces Master Artwork
3. **Context** — session retains enough to avoid re-upload
4. **Refinement** — natural language adjusts the current artwork
5. **Download** — user retrieves the final high-res file

If those five work, Phase 01 is done.

---

## 13. Acceptance checklist

Use this as QA.

**Setup**

- [ ] Signed-in console user can open Content Generator
- [ ] Only Master Artwork is usable

**Inputs**

- [ ] Source image upload + preview
- [ ] Invalid file type rejected
- [ ] Option 1: 3–5 swatches required
- [ ] Option 2: 3–5 valid HEX codes required; invalid HEX blocked
- [ ] Option 3: one palette image; extra colour fields for other options hidden
- [ ] Option 4: no extra colour fields
- [ ] Generate disabled until inputs are valid

**Generate**

- [ ] Prompt not visible in the UI
- [ ] Loading state shown
- [ ] One 1:1 image returned
- [ ] Architecture / perspective still recognisable vs source (human review vs brief examples)
- [ ] Options 1–3 stay on palette; Option 4 is not forced to 3–5 colours

**After generate**

- [ ] Download saves full-quality image
- [ ] Regenerate keeps uploads and settings, produces a new image
- [ ] Refine applies a natural-language change without new uploads
- [ ] Further refines remember previous instructions
- [ ] Start Again clears the job after confirm
- [ ] Errors leave inputs intact

**Config**

- [ ] Prompt / version / provider can be changed without rewriting the generator UI

---

## 14. Out of scope (explicit)

Do not build these in Phase 01, even if easy:

- Caption generators, social posting, project naming
- Permanent BLOCHARCH image library or “Recent generations”
- Fine-tuning, eval harnesses, analytics dashboards
- Multi-image batch generate
- In-canvas editing (brush, erase, crop as a product)
- Client portal access
- Gemini (or any second provider) for this generator
- Full Generator Recipe Builder

---

## 15. Open questions

Resolve these during implementation if they block build. Defaults are listed so work can start.

| # | Question | Default if unanswered |
| --- | --- | --- |
| Q1 | Exact OpenAI model for best Master Artwork fidelity? | Current best image-edit/generation model; store in config |
| Q2 | Target pixel size (e.g. 1024, 1536, 2048)? | Highest square size the API allows without extra paid upscale product |
| Q3 | Who may edit the embedded prompt? | Same people who can access existing admin / env config |
| Q4 | After Refine, does Regenerate replay original generate or latest refine? | Original generate inputs (see §10.3) |
| Q5 | Should extracted palette colours for Option 3 be editable before generate? | Display only in P1; editing is P2 |
| Q6 | Filename pattern for download? | `blocharch-master-artwork-YYYYMMDD-HHMM.png` |
| Q7 | Is a sidebar nav item required in the console? | Yes: **Content Generator** |
| Q8 | Should the 10 brief examples appear in-app as a reference strip? | No for P0; optional help panel P2 |

---

## 16. Final principle

Phase 01 stays deliberately small.

```
Source image
    → Colour treatment
    → Master Artwork prompt
    → AI generation
    → Review
    → Regenerate or refine
    → Download
```

When that loop is reliable, it becomes the foundation for Generator 02. Do not build the rest of the BLOCHARCH AI ecosystem in this phase.
