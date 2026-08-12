# PRODUCT VIS V2 — CHANGELOG

## V2.1A — Stability pass

### Added

- Fresh visible-product bounds refresh for every camera preset and Fit action.
- Aspect-aware box fitting against horizontal and vertical field of view.
- Robust framing bounds for pathological outlier vertices.
- Invalid-bounds rejection and camera bounds-source diagnostics.
- Box-depth-derived near/far clipping.
- Explicit material surface policies: Auto, Front, Double and Flip.
- Suggested-repair identity persisted separately from manual overrides.
- Transparent depth-writing and transparent double-sided diagnostics.
- Alpha blend and depth-risk counters in the material inspector.
- Pure-white, path-only Memento wordmark and matching favicon.
- Camera framing and robust-bounds source tests.

### Changed

- Package version is now `2.1.0-alpha.1`.
- Build marker is now `v2-1a-stability`.
- Auto always preserves the imported material side and is a portable explicit choice.
- The backface helper now writes targeted Double overrides instead of changing Auto behavior globally.
- Disabling suggested repair removes only suggested Double overrides; manual choices survive.
- Legacy `original` and `back` policies migrate to `auto` and `flip`.
- Hero, Front, Side, Top and Detail derive position from current visible product bounds.
- Top includes a small forward/right offset to avoid the orbit-control pole.
- Product normalization can ignore an extreme malformed export vertex.

### Preserved

- Project schema 10 and experience schema 1.
- V2 branded read-only presentation mode.
- One renderer and one canonical project state.
- Advanced closed by default.
- Local-first import, persistence, recovery and export.
- Existing variants, infographics, presentations and controlled stories.

### Deferred to the next checkpoints

- V2.1B persistent Light / Camera / Variants / Motion / Story shelf.
- V2.1C double-click focus, bokeh, GFX annotations and Shot strip.
- V2.1D semantic Material Sockets and texture-preserving configurator tint.
- V2.1E optimized starter product and asset library.

---

## Added

### Branded presentation mode

- Separate read-only presentation shell.
- Top-level Present action.
- Editor / Intro / Active / Outro runtime phases.
- Branded intro with logo, title, body and start action.
- Guided story navigation and playback controls.
- Optional viewer orbit.
- Optional product-options tray.
- Optional infographic overlay.
- Branded outro with restart, exploration, exit and CTA.
- Authoring-state snapshot and deterministic restoration on exit.

### Advanced → Publish

- Brand title, eyebrow and subtitle controls.
- Accent color and Dark / Light / Auto themes.
- Embedded image-logo authoring with a 768 KB safety budget.
- Entry-story selection.
- Intro or direct entry.
- Autoplay and orbit permissions.
- Viewer-control visibility settings.
- Intro and outro copy.
- Branded-export layer controls.
- Portable experience package actions.
- Hosted-package URL field.
- Player-link copy action.
- Android GLB, Apple USDZ and fallback AR fields.

### Portable experience package

- New `.productvis-show` extension.
- New `application/x-productvis-show` MIME type.
- `PVISSHOW1` binary magic.
- Raw GLB embedding after a versioned JSON header.
- Experience container version 1.
- Published-project normalization.
- Local experience opening.
- Remote experience bootstrap through `?experience=`.
- Web Share file handoff with download fallback.

### Branded export

- Presentation viewport PNG.
- Presentation 1920×1080 PNG.
- Presentation 2160×2700 PNG.
- Optional brand overlay.
- Optional infographic-card and connector composition.
- Optional current-story caption.
- NDC anchor mapping through Match and Fill export plans.

### AR handoff

- Android Scene Viewer intent builder.
- Android Scene Viewer web fallback URL.
- Apple AR Quick Look target builder.
- Platform resolver.
- HTTPS-only model-target validation.
- Optional resize and compatible vertical-placement preferences.

### State and tests

- Project schema version 10.
- Experience schema version 1.
- New experience grammar, runtime, codec, layout, compositor and AR modules.
- New V2 unit and architecture tests.
- New V2 Playwright smoke scenario.

## Changed

- `FrameExporter` now exposes reusable frame-capture, canvas-to-blob and download primitives.
- Export still uses the offscreen renderer and never resizes the live viewport.
- `CameraRig` now exposes a presentation interaction gate.
- Project migration now sanitizes the experience root.
- Project menu now opens and publishes experience packages.
- Export menu now separates clean and branded output.
- Drop handling accepts `.productvis-show` packages.
- Help copy and document metadata now describe V2.
- Support reports and project markers now report app version `2.0.0` and schema `10`.

## Preserved

- Child-proof quick dock.
- Advanced closed by default.
- Local-first GLB processing.
- Neutral studio rendering.
- Camera safety and material diagnostics.
- Project persistence and recovery.
- Product parts, anchors and visibility states.
- Commercial variants and saved configurations.
- Infographic authoring.
- Presentation states.
- Exploded states and animation chapters.
- Controlled product stories.
- Clean Match / Fill PNG export.
- No timeline editor.
- No duplicated renderer.

## Deliberately deferred

- Hosted storage service.
- Authentication and access control.
- Analytics and consent management.
- Server-generated public links or short URLs.
- Managed QR publishing.
- Cloud GLB optimization.
- GLB → USDZ conversion service.
- WebXR fallback renderer.
- Static embeddable micro-player bundle.
- Server-side branded video rendering.
