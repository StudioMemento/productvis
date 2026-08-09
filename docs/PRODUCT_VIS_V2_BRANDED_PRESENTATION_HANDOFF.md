# PRODUCT VIS V2 — BRANDED PRESENTATION MODE HANDOFF

## 1. Checkpoint purpose

V2 is the delivery layer for the complete Product VIS authoring foundation built through V1.9.

Its governing contract is:

> The editor authors the canonical product state. The V2 player presents that same state through a separate read-only surface.

V2 must not create a second renderer, a second configurator state, or a disconnected story implementation.

---

## 2. User outcome

A non-technical user can now:

1. import a GLB;
2. create a premium render;
3. author product options, infographics and a guided story;
4. apply a brand profile;
5. preview the result as a clean presentation;
6. export clean or branded frames;
7. download a portable viewer package;
8. share or host that package;
9. offer a controlled platform-native AR handoff.

The simple quick dock remains unchanged. Delivery controls are isolated in **Advanced → Publish**.

---

## 3. Protected architecture

### One canonical project

The editor, player, exported frame and package all consume the same schema-10 project.

```text
PROJECT STORE
├── model / studio / camera / motion
├── product structure / variants / infographics
├── presentations / exploded states / stories
└── experience profile
```

There is no translation into a second viewer-specific scene graph.

### One renderer

Presentation mode reuses:

- `RendererEngine`;
- `StudioSystem`;
- `ProductSession`;
- `CameraRig`;
- `StoryPlayer`;
- variant and infographic systems.

The player is a mode and UI boundary, not a duplicate app.

### Authoring-state restoration

Entering presentation mode captures a project snapshot.

Exiting:

- stops story playback;
- exits the experience runtime;
- restores camera interaction;
- reapplies the captured authoring state;
- returns to the editor shell.

This prevents preview playback from silently becoming an edit.

---

## 4. Experience runtime

`ExperienceRuntime` owns four phases:

```text
EDITOR
INTRO
ACTIVE
OUTRO
```

### Editor

Normal authoring state. Presentation shell hidden.

### Intro

Optional branded gate with logo, eyebrow, title, body and start action.

### Active

Guided story or free exploration. The author decides whether to expose:

- story navigation;
- play control;
- orbit;
- product options;
- infographics;
- share;
- AR;
- fullscreen;
- exit.

### Outro

Optional final state with restart, free exploration, exit and external CTA.

The runtime stores only presentation-phase state. Product state remains in the canonical project and existing story systems.

---

## 5. Advanced → Publish

### Brand block

- eyebrow;
- title;
- subtitle;
- accent;
- dark, light or automatic theme;
- embedded image logo.

Logo constraints:

```text
Accepted  PNG / JPEG / WebP / SVG
Encoding  Base64 image data URL
Limit     768 KB decoded payload
```

Unsupported or oversized data is removed by the grammar rather than passed into the player.

### Player block

- entry story;
- intro or direct entry;
- start label;
- autoplay;
- orbit permission;
- options;
- infographics;
- infographic display mode;
- step navigation;
- play control;
- fullscreen / share / AR / exit visibility.

### Intro / Outro block

Provides presentation copy without modifying product or story authoring.

### Export block

Controls optional presentation composition:

- brand overlay;
- infographic cards and connectors;
- story caption.

### Package / Share block

- local preview;
- portable package download;
- native file share when supported;
- hosted package URL;
- player bootstrap-link copy.

### AR block

- Android HTTPS GLB;
- Apple HTTPS USDZ;
- fallback URL;
- resize preference;
- optional compatible Android vertical placement;
- presentation AR-action visibility.

---

## 6. `.productvis-show` container

### Identity

```text
Magic               PVISSHOW1
Extension           .productvis-show
MIME                application/x-productvis-show
Container version   1
Project schema      10
Experience schema   1
```

### Binary layout

```text
[9 bytes magic]
[4 bytes unsigned little-endian header length]
[UTF-8 JSON header]
[original raw GLB bytes]
```

### Header content

- container/app/project/experience versions;
- creation and modification timestamps;
- asset metadata;
- sanitized experience profile;
- published project state.

### Asset policy

- raw embedded GLB;
- no base64 conversion;
- no recompression;
- maximum asset budget: 1 GiB;
- maximum header budget: 16 MiB;
- truncated payloads rejected.

### Published-state normalization

Published packages:

- enable automatic runtime quality;
- keep hidden-tab pause;
- disable recovery-draft persistence;
- clear editor-only anchor selection;
- enable story preview state;
- expose variants only when configured;
- resolve infographic visibility from the experience profile.

---

## 7. Local and remote opening

### Local package

The Project menu accepts `.productvis-show`.

Opening:

1. validates magic and container version;
2. migrates the embedded project;
3. restores the original GLB;
4. applies project state;
5. enters read-only presentation mode.

### Remote package

At boot, Product VIS reads:

```text
?experience=<package URL>
```

The package is fetched and opened through the same codec and application path as a local file.

Hosting contract:

- stable HTTPS URL recommended;
- same-origin or compatible CORS response;
- package must remain reachable by the player;
- no private authentication integration is included in V2.

---

## 8. Clean and branded frame boundaries

### Clean export

The V1.6 offscreen renderer remains unchanged in purpose:

- clones the active camera;
- renders to a temporary WebGL target;
- resolves Match or Fill framing;
- composites onto an output canvas;
- downloads PNG;
- never resizes the live renderer.

### Branded export

`PresentationFrameComposer` begins with `FrameExporter.captureFrame()` and then composes:

- brand mark / logo;
- eyebrow and title;
- current infographic graphics;
- current story and step caption.

The projection mapper translates NDC anchor positions through the exact export plan. It therefore respects:

- Match padding;
- Fill crop;
- viewport aspect;
- output dimensions.

### Explicit non-capture list

The following cannot leak into either output path:

- top bar;
- quick dock;
- Advanced panel;
- editor selection outline;
- authoring anchor helper;
- story editor transport;
- presentation navigation shell.

Branded elements appear only because the compositor redraws them intentionally.

---

## 9. Sharing contract

The share action creates a real `.productvis-show` `File`.

Runtime behavior:

```text
Web Share + file support
    → native share sheet

No supported file share
    → normal package download
```

The fallback is deterministic and keeps publishing usable on desktop browsers without file-sharing support.

A copied player link contains the hosted package URL in the `experience` query parameter. PRODUCT VIS does not upload or host the file itself.

---

## 10. AR handoff contract

### Android

Requires an explicit HTTPS GLB URL. Product VIS creates a Scene Viewer intent with:

- GLB file URL;
- `ar_preferred` mode;
- title;
- resize preference;
- optional vertical-placement preference;
- browser fallback URL.

### Apple

Requires an explicit HTTPS USDZ URL. Product VIS launches a hidden anchor with `rel="ar"` so compatible Apple devices can open AR Quick Look.

### Deliberate boundary

V2 does not:

- convert GLB to USDZ;
- upload assets;
- promise WebXR support across devices;
- treat a package URL as an AR model URL;
- expose AR unless a compatible target is authored.

---

## 11. State schema

Main project schema: `10`.

New root:

```js
experience: {
  schemaVersion: 1,
  // brand
  title, eyebrow, subtitle, accent, theme, logoDataUrl,
  // entry / player
  entryMode, startLabel, entryStoryId, autoplay, allowOrbit,
  showOptions, showInfographics, infographicMode,
  showStepNavigation, showPlayControl,
  showFullscreen, showShare, showAr, showExit,
  // gates
  intro: { enabled, title, body },
  outro: { enabled, title, body, ctaLabel, ctaUrl },
  // output
  export: { brandOverlay, infographics, storyCaption },
  // delivery
  share: { hostedPackageUrl, publicPlayerUrl },
  ar: { androidGlbUrl, iosUsdzUrl, fallbackUrl, title, resizable, verticalPlacement }
}
```

---

## 12. V2 acceptance checklist

### Player

- [ ] Present enters a read-only branded shell.
- [ ] Intro and direct-entry modes behave deterministically.
- [ ] Story playback uses the V1.9 story engine.
- [ ] Orbit permission is enforced.
- [ ] Viewer-facing options match authored product variants.
- [ ] Outro appears after a completed non-looping story.
- [ ] Exit restores the editor composition.

### Package

- [ ] `.productvis-show` round-trips schema 10.
- [ ] Embedded GLB bytes remain identical.
- [ ] Invalid magic and truncated assets are rejected.
- [ ] Local package open enters presentation mode.
- [ ] Remote bootstrap uses the same decode path.

### Export

- [ ] Clean output stays free of presentation graphics.
- [ ] Presentation output contains only enabled compositor layers.
- [ ] Infographic anchors remain aligned in Match and Fill.
- [ ] Live viewport size and camera are not mutated.

### Share / AR

- [ ] Native file share is used only when supported.
- [ ] Download fallback always remains available.
- [ ] Copied player links contain a hosted package URL.
- [ ] Android AR rejects non-HTTPS GLB targets.
- [ ] Apple AR rejects non-HTTPS USDZ targets.
- [ ] AR remains hidden or safely inactive without a valid target.

### Architecture

- [ ] One renderer.
- [ ] One project store.
- [ ] One story system.
- [ ] Advanced closed by default.
- [ ] Quick dock structurally unchanged.
- [ ] No timeline editor.

---

## 13. Post-V2 direction

After a connected preview accepts V2, future work should be deployment-oriented rather than expanding the editor blindly:

- hosted package storage and signed URLs;
- client / campaign templates;
- analytics and consent-aware engagement events;
- access-controlled experiences;
- CDN asset validation;
- server-side GLB → USDZ conversion pipeline;
- QR publishing and managed AR destinations;
- optional static/embed player bundle.

These are service and delivery layers. They should not destabilize the local-first renderer core.
