# PRODUCT VIS V2 — BRANDED PRESENTATION MODE


> **GitHub compact edition:** this repository contains fewer than 100 files for direct browser upload. Historical V1–V1.9 documentation has been consolidated into `docs/PRODUCT_VIS_RELEASE_ARCHIVE_V1_TO_V1_9.md`. Application source, tests, runtime assets, and V2 documentation are unchanged.

PRODUCT VIS is a local-first realtime product renderer, configurator authoring environment and guided presentation system for self-contained GLB assets.

V2 completes the bridge from **authoring** to **delivery**.

The editor from V1 remains the source of truth. V2 publishes that same project state into a separate read-only presentation surface rather than cloning the renderer or rebuilding the configurator in a second application.

The central product decision is:

> Author once. Present, package, share and hand off to AR without losing the canonical product state.

---

## The V2 workflow

```text
IMPORT GLB
    ↓
CREATE THE RENDER / VARIANTS / INFOGRAPHICS / STORY
    ↓
ADVANCED → PUBLISH
    ↓
BRAND THE EXPERIENCE
    ↓
PREVIEW READ-ONLY PRESENTATION
    ↓
DOWNLOAD .productvis-show
    ↓
HOST OR SHARE THE PACKAGE
    ↓
OPTIONAL ANDROID / APPLE AR HANDOFF
```

The normal quick dock remains child-proof. Publishing and branded-delivery controls live only in **Advanced → Publish**.

---

# 1. Two deliberate surfaces

## Authoring surface

The existing Product VIS editor remains responsible for:

- GLB import and normalization;
- realtime studio rendering;
- product transforms and camera control;
- material diagnostics and repairs;
- product parts and visibility states;
- commercial variants;
- anchors and infographic cards;
- presentation states;
- exploded states and controlled stories;
- `.productvis` project persistence;
- clean PNG export.

## Presentation surface

The V2 player is a read-only mode driven by the same renderer and project state.

It can expose only the controls selected by the author:

- branded intro;
- guided story playback;
- previous / next step navigation;
- optional product orbit;
- optional product variants;
- optional infographics;
- fullscreen;
- package sharing;
- AR handoff;
- branded outro and CTA.

Entering presentation mode snapshots the editor state. Exiting restores the authoring composition rather than leaving the project in an accidental playback state.

---

# 2. Advanced → Publish

The Publish workspace controls the delivery profile.

## Brand

- eyebrow;
- experience title;
- subtitle;
- accent color;
- Dark / Light / Auto theme;
- embedded PNG, JPEG, WebP or SVG logo up to 768 KB.

## Player

- selected entry story;
- branded intro or direct entry;
- custom start-button label;
- autoplay;
- orbit permission;
- product-options visibility;
- infographic visibility and mode;
- story-step navigation;
- playback control visibility;
- fullscreen, share, AR and exit actions.

## Intro and outro

The intro can carry a logo, title, supporting copy and start action.

The outro can offer:

- restart;
- free exploration;
- exit;
- optional external CTA.

## Branded export

Presentation PNGs may independently include:

- brand overlay;
- currently visible infographic cards and connector paths;
- current story / step caption.

Clean exports remain clean. Presentation graphics are composed only when the branded export action is selected.

## Package and share

- preview the read-only experience;
- download a portable `.productvis-show` package;
- use native file sharing where supported;
- provide a hosted package URL;
- copy a player bootstrap URL.

## AR handoff

The author may provide:

- an HTTPS GLB URL for Android Scene Viewer;
- an HTTPS USDZ URL for Apple AR Quick Look;
- an optional browser fallback URL;
- resizable and vertical-placement preferences where supported.

PRODUCT VIS does not pretend to convert GLB to USDZ in the browser. The correct platform asset must be hosted explicitly.

---

# 3. Portable `.productvis-show` package

V2 introduces a dedicated delivery container:

```text
Extension    .productvis-show
MIME         application/x-productvis-show
Magic        PVISSHOW1
```

Binary layout:

```text
PVISSHOW1 magic bytes
32-bit little-endian JSON-header length
Versioned JSON header
Original raw GLB bytes
```

The package includes:

- schema-10 published project state;
- experience profile;
- variants, infographics, presentations and stories;
- original GLB bytes;
- asset metadata;
- app and container versions.

The published copy deliberately disables crash-recovery persistence and clears editor-only selections while preserving the viewer-facing state.

The GLB is not converted to base64 and is not recompressed.

---

# 4. Hosted read-only player

A hosted Product VIS build can open a remote package with:

```text
?experience=<encoded HTTPS .productvis-show URL>
```

Example flow:

```text
Host Product VIS V2
Host product.productvis-show
Open Product VIS with the package URL in ?experience=
```

The package host must allow the player origin to fetch it. Same-origin hosting is the simplest deployment.

V2 does not include a backend, database, account system or cloud upload service. It produces the portable experience and the deterministic player bootstrap contract.

---

# 5. Reliable clean and branded export

Both export paths reuse the independent offscreen renderer established in V1.6.

## Clean PNG

```text
Active camera
    ↓
Offscreen WebGL render
    ↓
Match / Fill framing
    ↓
PNG
```

## Presentation PNG

```text
Clean offscreen frame
    ↓
Brand layout
    ↓
Projected infographic graphics
    ↓
Current story caption
    ↓
PNG
```

The branded compositor uses the active export framing plan, so projected product anchors remain aligned after Match padding or Fill cropping.

The editor UI, quick dock, Advanced panel, selection helper and presentation transport are never captured as a screenshot.

---

# 6. Project schema 10

The main project schema is now `10`.

New root state:

```js
experience: {
  schemaVersion: 1,
  title,
  eyebrow,
  subtitle,
  accent,
  theme,
  logoDataUrl,
  entryMode,
  startLabel,
  entryStoryId,
  autoplay,
  allowOrbit,
  showOptions,
  showInfographics,
  infographicMode,
  showStepNavigation,
  showPlayControl,
  showFullscreen,
  showShare,
  showAr,
  showExit,
  intro: { enabled, title, body },
  outro: { enabled, title, body, ctaLabel, ctaUrl },
  export: { brandOverlay, infographics, storyCaption },
  share: { hostedPackageUrl, publicPlayerUrl },
  ar: {
    androidGlbUrl,
    iosUsdzUrl,
    fallbackUrl,
    title,
    resizable,
    verticalPlacement
  }
}
```

Projects from prior supported schemas migrate through the existing sanitization boundary.

---

# 7. Deploy on Vercel

1. Unzip the project.
2. Import the extracted folder into Vercel, or push it to a connected Git repository.
3. Vercel should detect Vite.
4. Build command: `npm run check`.
5. Output directory: `dist`.
6. No backend or environment variable is required for local authoring and package playback.

For remote package bootstrapping, host the `.productvis-show` file at a stable HTTPS URL with compatible cross-origin headers.

## Local development

Node.js 20.19+ or 22.12+ is required by the pinned toolchain.

```bash
npm install
npm run dev
```

Production gate:

```bash
npm run check
```

Browser smoke tests:

```bash
npx playwright install chromium
npm run test:smoke
```

---

# 8. Source architecture

New V2 presentation modules:

```text
src/presentation/ExperienceGrammar.js
src/presentation/ExperienceRuntime.js
src/presentation/ExperienceFileCodec.js
src/presentation/PresentationFrameLayout.js
src/presentation/PresentationFrameComposer.js
src/presentation/ARHandoff.js
```

Their responsibilities remain separate:

- Grammar sanitizes and bounds the authored experience profile.
- Runtime owns editor / intro / active / outro phases.
- FileCodec owns the binary delivery container.
- FrameLayout maps projected anchors into Match / Fill exports.
- FrameComposer builds branded PNGs from the clean offscreen render.
- ARHandoff creates platform-specific launch targets from explicit hosted assets.

There is still one renderer, one project state and one story system.

---

# 9. Validation

Source-level validation for this checkpoint covers:

- schema-10 migration;
- experience-profile sanitization;
- safe embedded-logo handling;
- `.productvis-show` binary round-trip;
- byte-identical embedded GLB recovery;
- deterministic intro / active / outro phases;
- Android and Apple AR URL contracts;
- Match-layout projection mapping;
- clean versus branded export boundaries;
- authoring-to-presentation state restoration;
- no second renderer;
- no timeline editor.

See `docs/PRODUCT_VIS_V2_VALIDATION.md` for the exact pass report and environment limitations.
