# PRODUCT VIS V2 — CHANGELOG

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
