# PRODUCT VIS — CONSOLIDATED RELEASE ARCHIVE (V1 → V1.9)

This file consolidates the historical handoffs, changelogs, and validation reports that were previously stored as many separate files.

The consolidation exists only to keep the GitHub web-upload edition below GitHub's 100-file drag-and-drop limit. Runtime source, tests, public assets, V2 documentation, and deployment configuration remain separate and unchanged.

Historical SHA-256 manifest files are not reproduced here because their original path-level checksums no longer describe this compact repository layout.

---


---

## Archived source: `PRODUCT_VIS_V1_1_FOUNDATION_HANDOFF.md`

# PRODUCT VIS V1.1 — FOUNDATION HANDOFF

**Checkpoint type:** behavior-preserving refactor  
**Baseline:** PRODUCT VIS V1.0  
**Next allowed milestone:** V1.2 Neutral Studio Core  
**Rule:** do not mix V1.2 rendering changes into this checkpoint.

---

## 1. Objective

Create a stable architecture around the working V1 product loop:

```text
IMPORT → NORMALIZE → GROUND → FRAME → STYLE → EXPORT
```

V1.1 must make future complexity safer without redesigning the current interface or changing the current renderer target.

## 2. Foundation delivered

### Build layer

- Vite project with exact dependency versions.
- Three.js `0.185.1` installed locally rather than loaded at runtime from a CDN.
- Draco and Basis/KTX2 decoder assets copied into a Three.js-versioned public path during Vite configuration.
- Bundled `dist` build for Vercel, gated by the dependency-independent source test suite.
- Exact top-level versions; the first connected install must generate and commit `package-lock.json` before the checkpoint is tagged.

### State layer

`ProjectStore` contains one serializable project state:

```text
project.model
project.studio
project.camera
project.motion
project.render
session
ui
```

Simple presets and direct controls now update the same state values. Runtime Three.js objects remain inside the services that own them.

### Engine boundaries

- `RendererEngine` — WebGL renderer, camera, composer, bloom and quality DPR.
- `StudioSystem` — current V1 environment, cyclorama, lights, floor and contact shadow.
- `ProductSession` — imported asset lifecycle, stable transform rig, normalization, grounding, stats and material overrides.
- `CameraRig` — OrbitControls, framing, presets and camera tween.
- `MotionController` — glTF clips, loop, speed and turntable.
- `FrameExporter` — export sizing, render/restore and PNG naming.
- `UIController` — DOM events and DOM presentation only.
- `AppController` — the only coordinator between UI, state and engine services.

## 3. Stable transform grammar

```text
ProductSessionRoot      world placement and grounding
└── UserTransformRoot  user orientation and scale
    └── MotionRoot     turntable and future controlled motion
        └── NormalizationRoot  automatic fit correction
            └── ImportedAsset  original GLB scene
```

The imported asset is no longer directly rewritten for every responsibility. This is the base required for future pivot correction, configurator states, animation chapters and project persistence.

## 4. Acceptance checklist

### Core loop

- [ ] Demo product appears on first load.
- [ ] A valid self-contained GLB imports through picker and drag/drop.
- [ ] Draco, Meshopt and KTX2 paths resolve from the deployed build.
- [ ] Imported model is normalized, centered, grounded and framed.
- [ ] Original materials restore after Clay, Chrome or Matte.
- [ ] Studio, Soft, Noir, Gallery and Sunset behave like V1.0.
- [ ] Hero, Front, Side, Top and Detail work.
- [ ] Embedded animation playback, loop and speed work.
- [ ] Turntable remains independent from user orientation.
- [ ] Viewport, landscape, square and portrait PNG export work.

### Safety

- [ ] No browser console errors on first load.
- [ ] No runtime CDN requests for Three.js or decoder code.
- [ ] Reset is deterministic.
- [ ] Repeated model imports dispose the previous model.
- [ ] Mobile control sheet still opens and closes.
- [ ] Fullscreen returns to the same layout.

### Architecture

- [ ] `npm run test:unit` passes.
- [ ] `npm run build` passes.
- [ ] `npm run test:smoke` passes on desktop and mobile Chromium.
- [ ] UI modules do not import or directly mutate Three.js renderer objects.
- [ ] Presets are data objects rather than duplicated control branches.

## 5. Known V1 visual issues intentionally retained

These are not V1.1 regressions and must be solved only after the checkpoint is accepted:

- visible limbo and large background sphere;
- generic radial contact shadow;
- exposure/bloom combinations that can clip white products;
- camera can enter geometry or move beneath the stage;
- no material classification for alpha, transmission or intentional double-sided surfaces.

## 6. Safe V1.2 entry sequence

After V1.1 passes:

1. Add a feature flag named `neutralStudioV2`.
2. Build an independent `EnvironmentManager` beside the existing studio.
3. Separate `scene.environment` from the visible backdrop.
4. Add calibrated White, Gray and Black backdrop values.
5. Replace the visible cyclorama with an invisible ground reference.
6. Add geometry-aware contact-shadow rendering as a separate module.
7. Disable bloom by default and recalibrate exposure.
8. Test with the fixed golden model kit.
9. Keep the existing V1 studio available behind the flag until visual acceptance.

Do not remove the current studio until V1.2 passes its white/gray/black, grounding, white-product and black-product tests.

## 7. Rollback point

The original static V1 deployment ZIP remains the immutable rollback artifact. V1.1 should receive its own tag and deployment only after the acceptance checklist passes.


---

## Archived source: `PRODUCT_VIS_V1_2_NEUTRAL_STUDIO_HANDOFF.md`

# PRODUCT VIS V1.2 — NEUTRAL STUDIO HANDOFF

## 1. Checkpoint purpose

V1.2 is the first visual renderer upgrade built on the protected V1.1 architecture.

Its purpose is narrow:

> Remove the visible stage, separate lighting from the background, ground the product with its real footprint, and establish one calibrated render baseline before camera and material repair begins.

No configurator system, hotspot layer, camera collision system or material repair logic is mixed into this checkpoint.

---

## 2. Product result

The default path is now:

```text
IMPORT GLB
    ↓
NORMALIZE + CENTER + SNAP TO Y=0
    ↓
APPLY NEUTRAL PMREM / IBL
    ↓
GENERATE FOOTPRINT CONTACT SHADOW
    ↓
CHOOSE BACKDROP TONE
    ↓
CHOOSE CAMERA / MATERIAL
    ↓
EXPORT
```

The background is no longer a 3D object. The ground is no longer a visible limbo. The product is the only visual subject.

---

## 3. Locked system boundaries

### EnvironmentManager

Owns only:

- procedural neutral `RoomEnvironment`;
- PMREM generation;
- `scene.environment`;
- environment intensity;
- environment rotation;
- environment disposal.

It does not own the visible background.

### BackdropManager

Owns only:

- `scene.background`;
- one neutral perceptual tone from near-black to off-white.

It does not mutate PMREM, lights, exposure or materials.

### LightRig

Owns only:

- neutral key light;
- neutral fill light;
- neutral rim light;
- target placement from model bounds.

It does not cast the legacy directional shadow map.

### GroundSystem

Owns only:

- the invisible world `Y=0` presentation contract;
- contact-shadow visibility;
- shadow quality and refresh policy.

### ContactShadowRenderer

Owns only:

- the isolated product depth pass;
- depth render targets;
- separable blur passes;
- transparent shadow projection;
- model-footprint framing;
- cached and throttled refresh;
- renderer-state restoration.

### ProductSession

Owns:

- model normalization;
- automatic ground snap;
- user scale and offset;
- object orientation;
- material treatment;
- contact-shadow layer assignment.

It does not create studio geometry.

---

## 4. Render pipeline

```text
MAIN FRAME
──────────
Camera update
Product transform update
Embedded animation / turntable update
Orbit controls update
Studio tween update
Contact shadow update when dirty or dynamic
Direct render when bloom = 0
Composer render only when bloom > 0

CONTACT SHADOW FRAME
────────────────────
Hide shadow plane
Render product depth on isolated layer
Blur horizontal
Blur vertical
Optional second quality blur
Restore render target, clear color, alpha,
background, override material and visibility
Render main frame
```

The contact-shadow plane uses the model’s X/Z footprint. Its negative Y scale flips the plane for the presentation camera while Z scale controls its actual depth. This detail is protected by an architecture test.

---

## 5. State schema changes

Project schema is now `2`.

```js
studio: {
  preset: 'light',
  backdropTone: 0.82,
  exposure: 0.98,
  environment: 1.18,
  environmentRotation: Math.PI * 0.08,
  key: 2.35,
  fill: 0.78,
  rim: 1.8,
  bloom: 0,
  shadow: 0.52,
  shadowSoftness: 0.58,
  floorEnabled: true,
  shadowsEnabled: true,
  postEnabled: true
}
```

Backdrop stops are intentionally lighting-identical:

```text
White  0.965
Light  0.820
Gray   0.480
Dark   0.160
Black  0.025
```

Changing among these stops may change only `backdropTone` and the active preset ID.

---

## 6. Quality budgets

```text
FAST
Contact shadow 256 × 256
1 blur pass
Dynamic refresh cap 16 fps
Pixel ratio cap 1.0

BALANCED
Contact shadow 512 × 512
1 blur pass
Dynamic refresh cap 24 fps
Pixel ratio cap 1.45

QUALITY
Contact shadow 768 × 768
2 blur passes
Dynamic refresh cap 30 fps
Pixel ratio cap 2.0
```

Static models do not rebuild the contact shadow every frame.

---

## 7. V1.2 acceptance checklist

### Scene

- [ ] No visible cyclorama.
- [ ] No visible background sphere.
- [ ] No wall/floor seam.
- [ ] No radial fake shadow disc.
- [ ] Background can move continuously from off-white to near-black.

### Lighting

- [ ] Reflections remain consistent while changing backdrop tone.
- [ ] White products retain highlight shape.
- [ ] Black products retain edge separation.
- [ ] Bloom is zero after boot and reset.
- [ ] Bloom does not run a post pass while its strength is zero.

### Grounding

- [ ] Imported model minimum Y is approximately zero.
- [ ] Contact shadow follows wheels, feet, legs and asymmetrical bases.
- [ ] Contact shadow changes after scale or 90-degree object rotation.
- [ ] Raised objects produce a weaker separated shadow rather than a fixed disc.
- [ ] The shadow plane itself is not visible.

### Interaction

- [ ] White, Light, Gray, Dark and Black buttons work.
- [ ] Continuous backdrop slider works.
- [ ] HUD and intro copy remain readable on light and dark fields.
- [ ] Camera presets, material treatments, import, motion and export remain wired.
- [ ] Desktop and mobile control layouts remain navigable.

### Reliability

- [ ] Repeated model import leaves one Product Session Root.
- [ ] No runtime CDN dependency exists in production source.
- [ ] `npm run check` passes on a connected machine.
- [ ] `npm run test:smoke` passes after Playwright Chromium installation.

---

## 8. Reference test set

Before accepting the deployed checkpoint, test at least:

1. the current modified car GLB;
2. one white glossy product;
3. one black matte product;
4. one metallic object;
5. one object with four separated feet;
6. one tall narrow object;
7. one very wide object;
8. the included `foundation-cube.glb`.

For each model, capture White, Gray and Black backdrops plus Hero and Detail cameras.

---

## 9. Known boundaries

The following are not V1.2 defects; they are explicitly deferred:

- camera can still orbit below the ideal presentation envelope;
- camera can still enter a large or hollow product;
- one-sided geometry viewed from inside can still appear transparent;
- malformed alpha modes are not repaired;
- glass sorting is not diagnosed;
- no global `DoubleSide` conversion is performed;
- the environment is procedural PMREM, not yet a user-selectable `.hdr` library;
- no reflective floor is included.

---

## 10. Safe V1.3 entry point

Create V1.3 as isolated additions around this accepted renderer:

```text
CameraRig
├── PresentationConstraints
├── InspectMode
└── AdaptiveClipping

ProductSession
└── MaterialInspector
    ├── Opaque classification
    ├── Alpha mode report
    ├── Side report
    ├── Glass report
    └── Targeted repair overrides
```

Do not modify `EnvironmentManager`, `BackdropManager` or `ContactShadowRenderer` while implementing the first camera/material safety pass unless a V1.2 regression test proves that change is required.

---

## 11. Rollback rule

Keep the accepted V1.1 deployment and this V1.2 deployment available as separate Vercel checkpoints.

If V1.3 breaks import, grounding, background independence or contact shadows, roll back to V1.2 and fix the new module in isolation. Do not repair V1.3 by re-merging systems into `AppController`.


---

## Archived source: `PRODUCT_VIS_V1_3_CAMERA_MATERIAL_SAFETY_HANDOFF.md`

# PRODUCT VIS V1.3 — CAMERA & MATERIAL SAFETY HANDOFF

## 1. Checkpoint purpose

V1.3 is the first safety pass after the neutral studio foundation.

Its role is specific:

> Keep the default camera in a clean presentation envelope and surface material-side risks without globally breaking shading.

This checkpoint does **not** attempt to become a full DCC camera system or a full material editor. It introduces guardrails, diagnostics and a selective repair path.

---

## 2. What V1.3 changes for the user

The default experience is now:

```text
IMPORT GLB
    ↓
NORMALIZE + GROUND + FIT
    ↓
PRESENTATION CAMERA SAFETY ENVELOPE
    ↓
OPTIONAL INSPECT MODE FOR CLOSER REVIEW
    ↓
MATERIAL DIAGNOSTICS SUMMARY
    ↓
OPTIONAL TARGETED BACKFACE REPAIR
    ↓
EXPORT
```

In practice:

- the default camera is harder to push inside the product;
- the camera is kept above the presentation ground in Presentation mode;
- the near/far planes adapt to product size and current distance;
- transparent / alpha / glass / double-sided counts are visible in the UI;
- thin-shell and alpha-cutout candidates can be selectively repaired;
- glass is reported for review, but is **not** blindly forced double-sided.

---

## 3. Locked system boundaries

### CameraRig

Now owns:

- `presentation` and `inspect` camera modes;
- minimum safe distance;
- maximum distance budget;
- above-ground orbit safety;
- padded-bounds shell escape when the presentation camera enters the product;
- adaptive near/far clipping;
- camera safety diagnostics for UI.

It still does **not** become a scene editor camera.

### ProductSession

Still owns:

- normalization;
- grounding;
- scale / offset / rotate transforms;
- material treatment mode;
- shadow-layer membership.

It now also owns:

- material diagnostics state;
- targeted backface-repair state;
- per-mesh material presentation assignment.

### MaterialDiagnostics

New dedicated module that classifies materials into a simple runtime review model:

- transparent;
- alpha-mask;
- alpha-blend;
- glass-like;
- double-sided;
- targeted backface-repair candidate.

It is intentionally a **diagnostic** layer, not a full material authoring layer.

---

## 4. Camera safety behavior

### Presentation mode

Default mode.

Rules:

- clamp minimum distance based on model radius and bounds;
- keep the camera above the presentation ground;
- keep orbit within a clean presentation polar envelope;
- prevent the camera from remaining inside the padded product bounds;
- keep target height inside a useful presentation band;
- adapt near/far clipping from product scale and current camera distance.

### Inspect mode

Optional override for close review.

Rules:

- relax the minimum safe distance;
- widen the orbit envelope;
- keep adaptive clipping active;
- keep diagnostics visible so the user understands the mode state.

Inspect is for review, Presentation is for clean output.

---

## 5. Material safety behavior

### Diagnostics

The Object panel now exposes:

- transparent count;
- alpha-mask count;
- glass count;
- double-sided count;
- backface-repair candidate count;
- one short diagnostic note.

### Targeted backface repair

The toggle does **not** set every material to `DoubleSide`.

Instead it only affects materials that are classified as safer candidates, mainly:

- thin-shell-like surfaces;
- alpha-cutout / flat presentation surfaces.

Glass-like materials are reported, but deliberately excluded from forced repair to avoid creating worse rendering artifacts.

### Material overrides

Clay / Chrome / Matte overrides now preserve side intent more safely by using front-side and double-sided variants instead of one global side assumption.

---

## 6. State schema changes

Project schema is now `3`.

Added state:

```js
model: {
  backfaceRepairEnabled: false
}

camera: {
  mode: 'presentation'
}
```

This keeps the safety mode and repair state versioned alongside existing render state.

---

## 7. UI additions

### Camera panel

Added:

- `Inspect mode` toggle;
- `Camera safety` status card;
- live readouts for min distance and near/far clipping.

### Object panel

Added:

- `Material diagnostics` card;
- `Targeted backface repair` toggle;
- material classification summary.

The rest of the shell remains intentionally close to V1.2.

---

## 8. V1.3 acceptance checklist

### Camera

- [ ] Default Hero / Front / Side / Top / Detail presets stay outside the product shell.
- [ ] Presentation mode does not let the camera sit below the ground contract.
- [ ] Fit returns to a usable framing after aggressive orbiting.
- [ ] Near clipping no longer slices the product under normal presentation use.
- [ ] Inspect mode allows a closer review than Presentation mode.

### Materials

- [ ] Diagnostics update when a new GLB is imported.
- [ ] Opaque products remain visually unchanged with repair OFF.
- [ ] Targeted repair does not globally double-side every material.
- [ ] Thin-shell fixtures survive override materials more safely.
- [ ] Glass is still reported but not blanket-repaired.

### Reliability

- [ ] State schema reports `3`.
- [ ] `node --test tests/*.test.mjs` passes.
- [ ] DOM bindings remain complete.
- [ ] No new CDN dependency is introduced.

---

## 9. Best validation asset set

To validate V1.3 properly, test with:

1. one opaque hard-surface product;
2. one vehicle with glass and visible interior;
3. one thin-shell or alpha-cutout product;
4. one animated product;
5. one awkward-pivot / extreme-scale product.

For each asset, test:

- Presentation mode + Hero;
- Presentation mode + Detail;
- Inspect mode close-up;
- Original material;
- Clay override;
- backface repair OFF / ON when relevant.

---

## 10. Next checkpoint

V1.4 should stay focused on **simple UX polish**, not core rendering changes:

- simplified quick controls;
- clearer top/bottom action layout;
- easy background / lighting presets;
- Advanced closed by default;
- first-time-user friction reduction.


---

## Archived source: `PRODUCT_VIS_V1_4_SIMPLE_UX_HANDOFF.md`

# PRODUCT VIS V1.4 — SIMPLE UX HANDOFF

## 1. Checkpoint purpose

V1.4 turns the protected renderer foundation into an app that can be used without understanding a renderer.

The checkpoint contract is:

> A first-time user can import a GLB, create a useful product shot and export it without opening Advanced or reading instructions.

V1.4 is a UX architecture pass. It does not replace the neutral studio, contact-shadow system, camera safety or material diagnostics created in earlier checkpoints.

---

## 2. Primary workflow

```text
IMPORT GLB
    ↓
CHOOSE BACKGROUND
White / Gray / Black
    ↓
CHOOSE LIGHT
Soft / Balanced / Contrast
    ↓
CHOOSE CAMERA
Hero / Front / Side / Top / Detail / Fit
    ↓
OPTIONAL TURNTABLE
    ↓
EXPORT
```

The full control panel is now explicitly named **Advanced** and is closed on boot.

---

## 3. Visible product shell

### Simplified top bar

Permanent actions are limited to:

- PRODUCT VIS identity;
- active model status;
- Import GLB;
- Export.

Help and Reset moved to the Advanced footer. They remain available without competing with the main task.

### Quick dock

The bottom dock owns the first-use path:

- `BG`: White, Gray, Black;
- `LIGHT`: Soft, Balanced, Contrast;
- `CAM`: camera presets and Fit;
- Turntable;
- Advanced.

Desktop keeps all five camera presets visible. Mobile prioritizes Hero, Front and Detail plus Fit; the complete camera set remains in Advanced.

### Responsive behavior

- wide screens: single-row centered dock;
- medium screens: full-width two-row dock;
- mobile: full-width two-row dock above the safe area;
- Advanced: right-side panel on desktop, bottom sheet on mobile;
- no document-level horizontal overflow;
- type and controls reduce without removing the essential path.

---

## 4. Simple and Advanced state contract

Simple controls and Advanced controls use the same project state.

### Backdrop channel

```js
studio: {
  preset: 'gray',
  backdropPreset: 'gray',
  backdropTone: 0.48
}
```

Backdrop buttons update only the visible backdrop channel.

Moving the continuous backdrop slider:

- cancels the backdrop tween;
- sets `preset` and `backdropPreset` to `null`;
- leaves lighting untouched.

### Lighting channel

```js
studio: {
  lightingPreset: 'balanced',
  exposure: 0.98,
  environment: 1.18,
  environmentRotation: Math.PI * 0.08,
  key: 2.35,
  fill: 0.78,
  rim: 1.8,
  bloom: 0,
  shadow: 0.52,
  shadowSoftness: 0.58
}
```

Changing an Advanced lighting slider:

- cancels the lighting tween;
- sets `lightingPreset` to `null`;
- leaves the backdrop untouched.

Closing Advanced never mutates either channel.

---

## 5. Lighting presets

### Soft

Purpose: broad illumination, gentle form and low contrast.

- stronger environment and fill;
- lower key and rim;
- softer, lighter contact shadow;
- zero bloom.

### Balanced

Purpose: default neutral product presentation.

- protected V1.2 calibration;
- readable white, dark and metallic products;
- zero bloom.

### Contrast

Purpose: stronger edge separation and more cinematic definition.

- reduced ambient environment;
- stronger key and rim;
- lower fill;
- denser contact shadow;
- zero bloom.

These are controlled render presets, not color filters.

---

## 6. Preserved V1.3 safety

Advanced still contains:

- Presentation / Inspect camera mode;
- camera safety diagnostics;
- adaptive near/far clipping readout;
- material diagnostics;
- targeted backface repair;
- object normalization controls;
- material treatments;
- quality controls;
- embedded animation controls.

No safety feature was removed to simplify the first-use layer.

---

## 7. State schema

Project schema is now `4`.

Added or formalized:

```js
studio.backdropPreset
studio.lightingPreset
```

The legacy `studio.preset` remains as an alias for backdrop state so earlier integrations have a stable migration path.

---

## 8. Acceptance checklist

### First-use path

- [ ] Advanced is closed after boot.
- [ ] Import and Export are immediately visible.
- [ ] White, Gray and Black are available without opening Advanced.
- [ ] Soft, Balanced and Contrast are available without opening Advanced.
- [ ] Hero and Fit are available without opening Advanced.
- [ ] Turntable can be toggled without opening Advanced.
- [ ] Quick Turntable and the Advanced Turntable checkbox stay synchronized.

### State synchronization

- [ ] Background presets never overwrite lighting state.
- [ ] Lighting presets never overwrite backdrop state.
- [ ] Advanced backdrop edits clear only the active backdrop preset.
- [ ] Advanced lighting edits clear only the active lighting preset.
- [ ] Reset restores Gray / Balanced / Hero / Original / Turntable OFF.
- [ ] Closing Advanced does not change the image.

### Responsive layout

- [ ] 1440 px desktop uses the centered one-row dock.
- [ ] 900 px uses the two-row dock with all simple groups visible.
- [ ] 390 px mobile exposes background, light, camera, Fit, Turntable and Advanced.
- [ ] 320 px remains usable without document overflow.
- [ ] Mobile Advanced opens as a bottom sheet and closes cleanly.

---

## 9. Protected next step

V1.5 should deepen Advanced without redesigning the simple path.

Safe scope:

- environment rotation;
- fill-light control;
- shadow opacity and softness;
- camera target controls;
- explicit material diagnostic list;
- independent group resets;
- clearer custom-state indicators.

Do not move these controls into the permanent quick dock.


---

## Archived source: `PRODUCT_VIS_V1_5_ADVANCED_CONTROLS_HANDOFF.md`

# PRODUCT VIS V1.5 — ADVANCED CONTROLS HANDOFF

## 1. Checkpoint purpose

V1.5 deepens the optional professional layer without contaminating the simple workflow established in V1.4.

The checkpoint contract is:

> Every advanced value maps to the same project state used by the quick presets, closing Advanced does not change the image, simple presets remain usable after granular edits, and each group has one deterministic reset.

V1.5 does not add saved projects, configurator states, infographic hotspots or camera sequences. Those remain later modules.

---

## 2. Preserved simple path

The permanent workflow remains:

```text
IMPORT GLB
    ↓
BACKGROUND  White / Gray / Black
    ↓
LIGHT       Soft / Balanced / Contrast
    ↓
CAMERA      Hero / Front / Side / Top / Detail / Fit
    ↓
OPTIONAL TURNTABLE
    ↓
EXPORT
```

The V1.4 quick-dock DOM was retained unchanged. Advanced is closed at boot and does not mutate state when opened or closed.

---

## 3. Advanced architecture

Advanced contains four predictable pages:

```text
LOOK      Visible field, lighting, ground, shadow, quality
OBJECT    Transform, material treatment, diagnostics, side policy
CAMERA    Presets, lens, target, safety, interaction behavior
MOTION    Embedded animation and turntable
```

Each page begins with:

- a state indicator;
- a human-readable preset or custom label;
- a group-specific reset button.

The Advanced button receives a small custom-state signal when at least one group has moved beyond a named/default state.

---

## 4. Look group

### Backdrop channel

Owned state:

```js
studio.preset
studio.backdropPreset
studio.backdropTone
```

Manual backdrop movement:

- cancels only the backdrop tween;
- clears only the backdrop preset IDs;
- leaves lighting, ground and camera untouched.

### Lighting channel

Owned state:

```js
studio.lightingPreset
studio.exposure
studio.environment
studio.environmentRotation
studio.key
studio.fill
studio.rim
studio.bloom
studio.shadow
studio.shadowSoftness
```

Manual lighting movement:

- cancels only the lighting tween;
- clears only `lightingPreset`;
- preserves the visible backdrop.

### Ground channel

Added:

```js
studio.groundOffset
```

Ground offset moves the contact-shadow ground contract independently from the product’s own vertical offset. The geometry-aware shadow renderer is reframed after the ground changes.

### Look reset

`resetLookGroup()` restores:

- Gray backdrop;
- Balanced lighting;
- ground offset `0`;
- grounding ON;
- contact shadow ON;
- post-processing ON;
- the runtime default quality profile.

On smaller or lower-memory devices, the runtime quality default can remain Balanced without falsely presenting the group as custom.

---

## 5. Object group

### Transform state

V1.5 formalizes rotation in project state:

```js
model.rotation = { x: 0, y: 0, z: 0 }
```

The existing scale, vertical offset and 90-degree orientation controls remain intact.

### Material diagnostics

`MaterialDiagnostics` assigns stable runtime IDs to unique material objects and reports:

- original side;
- transparency;
- alpha mask;
- alpha blend;
- glass-like classification;
- double-sided state;
- safe backface-repair candidacy.

The list prioritizes repaired or risky materials and limits the visible list to 64 rows to protect panel performance.

### Explicit side policy

New serializable state:

```js
model.materialSideOverrides = {
  "2": "double",
  "7": "original"
}
```

Allowed policies:

- `auto`: remove the explicit override and use automatic safety behavior;
- `original`: force the imported side intent;
- `front`;
- `back`;
- `double`.

The global automatic repair toggle still applies only to safe thin-shell / alpha-cutout candidates. Glass remains excluded from blanket repair.

### Material treatments

Clay, Chrome and Matte use front, back and double-sided protected variants. An override therefore remains meaningful after switching away from Original materials.

### Object reset

`resetObjectGroup()` restores:

- scale `1`;
- vertical offset `0`;
- rotation `0 / 0 / 0`;
- Original treatment;
- automatic repair OFF;
- no explicit side overrides.

---

## 6. Camera group

### Normalized target state

Added:

```js
camera.target = { x: 0, y: 0.47, z: 0 }
```

Target values are normalized against current product bounds:

- X and Z: `-1 … 1` across half of the product bounds;
- Y: `0 … 1` from product minimum to maximum height.

This keeps target controls useful across products with radically different real-world scales. When product bounds change after scale, vertical offset, centering or rotation, CameraRig remaps the normalized target and shifts the camera by the same delta so the composition follows the product instead of drifting away.

### Preset behavior

Each camera preset owns:

- direction;
- distance multiplier;
- normalized target.

Applying a preset updates both camera pose and target state. Manually changing the target, using Fit, or finishing a free orbit clears the active preset and marks the Camera group custom.

### Safety

V1.3 safety remains active:

- Presentation / Inspect modes;
- minimum safe distance;
- above-ground camera constraint;
- padded-bounds shell escape;
- adaptive near/far clipping.

V1.5 additionally keeps normalized target values inside the appropriate Presentation or Inspect composition envelope.

### Camera reset

`resetCameraGroup()` restores:

- 50 mm;
- damping `0.08`;
- auto orbit OFF;
- horizon lock ON;
- Presentation mode;
- Hero preset and Hero target.

---

## 7. Motion group

`MotionController.reset()` now provides one deterministic runtime reset:

- mixer time `0`;
- clip `0` selected when available;
- playback paused;
- loop ON;
- speed `1`;
- turntable OFF;
- turntable speed `0.3`;
- motion-root rotation reset.

The quick Turntable button and Advanced Turntable checkbox continue to share the same state.

---

## 8. Reset contract

The global Reset is composed from the same four public group resets:

```js
resetAll() {
  resetLookGroup();
  resetObjectGroup();
  resetCameraGroup();
  resetMotionGroup();
}
```

There is no duplicated hidden reset implementation.

This is important for V1.6 persistence: a project loaded from disk and a project returned to defaults must converge to the same versioned state.

---

## 9. State schema

Project schema is now `5`.

Added or formalized:

```js
model.rotation
model.materialSideOverrides
studio.groundOffset
camera.target
```

Existing schema fields remain stable, including:

```js
studio.preset              // legacy backdrop alias
studio.backdropPreset
studio.lightingPreset
camera.mode
model.backfaceRepairEnabled
```

---

## 10. Acceptance checklist

### Simple path

- [ ] Quick-dock structure remains unchanged from V1.4.
- [ ] Advanced is closed after boot.
- [ ] White / Gray / Black and Soft / Balanced / Contrast still work.
- [ ] Closing Advanced leaves the visible frame unchanged.

### Look

- [ ] Environment intensity and rotation update independently.
- [ ] Fill light is user-controllable.
- [ ] Ground offset moves the contact-shadow contract.
- [ ] Shadow opacity and softness update the cached shadow system.
- [ ] Manual edits show CUSTOM without breaking quick presets.
- [ ] Reset Look returns the full group to deterministic defaults.

### Object

- [ ] Diagnostics populate after every model import.
- [ ] Automatic repair remains candidate-only.
- [ ] Glass is never blanket forced double-sided.
- [ ] Per-material side policy works in Original and override treatments.
- [ ] Reset Object clears all explicit overrides and transform state.

### Camera

- [ ] Target X / Y / Z works across differently sized products.
- [ ] Manual target edits clear the camera preset.
- [ ] Presentation and Inspect safety remain active.
- [ ] Reset Camera returns to Hero / 50 mm / default target.

### Motion

- [ ] Reset Motion returns animation and turntable to one known state.
- [ ] Quick and Advanced Turntable controls remain synchronized.

### Reliability

- [ ] Project state is serializable at schema `5`.
- [ ] Every group reset changes both runtime and UI state.
- [ ] No document-level horizontal overflow occurs down to 320 px.
- [ ] Unit and architecture tests pass before production build.

---

## 11. Protected next step

V1.6 should add persistence and export reliability without redesigning V1.5:

- versioned `.productvis` save/load;
- schema migration support;
- saved looks;
- exact viewport/export framing parity;
- offscreen export target;
- optional local recent projects.

Configurator modules remain deferred until V1.6 is stable.


---

## Archived source: `PRODUCT_VIS_V1_6_PERSISTENCE_RELIABLE_EXPORT_HANDOFF.md`

# PRODUCT VIS V1.6 — PERSISTENCE & RELIABLE EXPORT HANDOFF

## 1. Checkpoint purpose

V1.6 completes the protected V1 product foundation.

Its purpose is narrow and structural:

> A user must be able to save the real product and the real shot, reopen it later without the original GLB beside it, migrate older state safely, and export the visible composition without disturbing the editor.

This checkpoint does not add configurator logic. It protects the renderer before variants, hotspots, chapters and branded presentation systems are introduced.

---

## 2. Product result

The complete V1 path is now:

```text
IMPORT GLB
    ↓
NORMALIZE + GROUND
    ↓
BUILD LOOK / OBJECT / CAMERA / MOTION STATE
    ↓
SAVE .productvis
Versioned state + saved looks + raw GLB
    ↓
OPEN / MIGRATE / RESTORE
    ↓
EXPORT MATCH OR FILL
Offscreen — live viewport untouched
```

A first-time user can still use only the quick dock. A professional can open Advanced. Both paths write to one project state, and that state is now portable.

---

## 3. `.productvis` file contract

### Binary layout

```text
OFFSET  SIZE  CONTENT
0       8     ASCII magic: PVISPRJ1
8       4     Unsigned little-endian JSON header length
12      N     UTF-8 JSON header
12+N    M     Original raw GLB bytes
```

### Header responsibilities

The header owns:

- container version;
- Product VIS app version;
- project schema version;
- created / modified timestamps;
- source viewport dimensions;
- asset name, MIME type and byte length;
- complete sanitized project state;
- embedded saved looks.

### Asset responsibilities

The asset payload is:

- the original GLB bytes, byte-for-byte; or
- an explicit `procedural-demo` marker when the default demo object is saved.

The codec does not:

- base64 encode the GLB;
- depend on a remote URL;
- upload the product;
- mutate or recompress the product file.

### Decoder safeguards

The decoder rejects:

- invalid or oversized headers;
- truncated containers;
- declared asset lengths larger than the available payload;
- containers created by a newer unsupported container version;
- non-Product VIS headers.

Legacy JSON project shapes remain readable as migration input, but they cannot contain an embedded GLB.

---

## 4. Project schema 6

Schema 6 formalizes the state needed for an exact session continuation.

### Metadata

```js
meta: {
  id,
  title,
  createdAt,
  updatedAt
}
```

Older projects without an ID receive a stable ID when opened.

### Model

```js
model: {
  name,
  fileSize,
  procedural,
  materialMode,
  userScale,
  userOffset,
  rotation,
  positionXZ,
  backfaceRepairEnabled,
  materialSideOverrides
}
```

`positionXZ` closes the final transform gap left by Center and non-origin products.

### Camera

```js
camera: {
  preset,
  focalLength,
  target,
  pose,
  damping,
  autoRotate,
  horizonLocked,
  mode
}
```

The pose is stored relative to product bounds:

```js
pose: {
  target,        // normalized product target
  direction,     // normalized camera direction
  distance,      // product-radius multiple
  up,
  sourceAspect
}
```

This allows a shot to survive viewport and product-scale changes more reliably than storing raw world coordinates alone.

### Motion

```js
motion: {
  clipIndex,
  playing,
  loop,
  speed,
  time,
  turntable,
  turntableSpeed,
  turntableAngle
}
```

The accumulated turntable angle is restored rather than restarting the object at zero.

### Render

```js
render: {
  quality,
  exportFraming // 'match-viewport' | 'fill'
}
```

---

## 5. Migration boundary

`ProjectMigration` is the single authority for project shape upgrades and sanitization.

It migrates sequentially through the known V1 schemas:

```text
V1 → V2 → V3 → V4 → V5 → V6
```

The migration layer:

- fills newly introduced state;
- infers compatible backdrop / lighting presets where possible;
- clamps unsafe numeric ranges;
- rejects unknown enum values by returning protected defaults;
- caps per-material override entries;
- sanitizes text and timestamps;
- never applies untrusted project data directly to Three.js.

The runtime receives only schema-six sanitized state.

---

## 6. Runtime restoration order

Opening a portable project follows this order:

```text
1. Decode and validate container
2. Migrate + sanitize project state
3. Decode embedded GLB
4. Create fresh ProductSession
5. Apply studio and render state
6. Apply object transform and material policies
7. Apply camera mode, lens, target and exact pose
8. Apply animation and turntable state
9. Merge embedded saved looks
10. Update recent-project cache
```

The existing model lifecycle cleanup remains active, so repeated project opening must leave one Product Session Root.

---

## 7. Saved looks

`SavedLookLibrary` stores reusable visual treatments in localStorage.

A look intentionally contains only:

- `studio`;
- `render`.

It excludes:

- model identity and transforms;
- material-side overrides;
- camera;
- animation;
- turntable state.

This prevents applying a look from unexpectedly moving or replacing the product.

Limits:

- maximum 24 saved looks;
- sanitized on read and write;
- localStorage failure is reported without breaking rendering;
- project files embed the current saved-look collection.

---

## 8. Recent local projects

`RecentProjectStore` uses IndexedDB because portable projects may contain large binary GLBs.

Contract:

- maximum three entries;
- stores the complete portable Blob;
- sorts by save time;
- trims overflow after a successful save;
- optional convenience only;
- failure never blocks file download or project opening.

The downloaded `.productvis` remains the durable source of truth.

---

## 9. Reliable export architecture

### Protected rule

Export must not resize the live renderer.

The old capture pattern could mutate:

- canvas dimensions;
- camera aspect;
- composer buffers;
- responsive UI state.

V1.6 replaces it with an isolated export path.

### Offscreen flow

```text
Capture viewport rectangle and project framing mode
    ↓
Build pure ExportFramePlan
    ↓
Clone camera and preserve viewport aspect
    ↓
Refresh contact shadow
    ↓
Render to temporary WebGLRenderTarget
    ↓
Optional temporary post-processing composer
    ↓
Read RGBA pixels
    ↓
Flip rows into 2D canvas
    ↓
Composite Match padding or Fill crop
    ↓
Download PNG
    ↓
Dispose temporary GPU resources
```

The renderer restores:

- previous render target;
- viewport;
- scissor rectangle;
- scissor-test state;
- XR enabled state.

### Match

Preserves the full viewport composition. Aspect-ratio differences become backdrop-colored bars.

### Fill

Preserves the viewport camera and fills the output using a centered crop.

### GPU texture limit fallback

A 16:9 viewport rendered into a 2160 × 2700 Fill output would normally require a 4800 × 2700 intermediate. On a 4096 px GPU this would fail.

V1.6 scales the intermediate to the available texture limit while preserving normalized crop coordinates, then resolves into the requested output dimensions. Composition stays the same; internal sampling resolution is reduced only when the device requires it.

---

## 10. UI additions

### Project menu

- Save project;
- Open project;
- dirty / saved / migrated state label;
- up to three recent local projects;
- keyboard shortcuts.

### Advanced → Look

- name and save current look;
- select a saved look;
- Apply;
- Delete;
- local saved-look count.

### Export menu

- Match;
- Fill;
- explanatory framing note.

The quick dock is unchanged and Advanced remains closed by default.

---

## 11. V1.6 acceptance checklist

### Portable project

- [ ] Imported GLB saves inside `.productvis`.
- [ ] Decoded GLB bytes are identical to the source bytes.
- [ ] Reopening does not require the original GLB file beside the project.
- [ ] Look, object, camera, motion and render state restore.
- [ ] Older schemas migrate to schema 6.
- [ ] Corrupt and truncated project files fail visibly.
- [ ] Repeated open leaves one Product Session Root.

### Saved looks and recent projects

- [ ] Saved looks affect only studio/render state.
- [ ] Saved looks survive reload on the same origin.
- [ ] Saved looks are embedded into portable projects.
- [ ] Recent local projects retain at most three entries.
- [ ] IndexedDB failure does not block Save Project.

### Export

- [ ] Export never calls live renderer resize.
- [ ] Match preserves the complete viewport.
- [ ] Fill creates a centered crop.
- [ ] Contact shadow appears in export.
- [ ] Requested dimensions are respected.
- [ ] Oversized intermediates degrade safely to the GPU limit.
- [ ] Live viewport and camera remain unchanged after export.

### Regression

- [ ] Quick dock remains complete.
- [ ] Advanced remains closed by default.
- [ ] Import, material, camera, motion and reset paths remain wired.
- [ ] No runtime CDN dependency is introduced.

---

## 12. Protected next layer

After a connected preview accepts V1.6, the renderer foundation is ready for **V2.0 — Configurator Platform**.

The next modules may consume project state and product anchors, but must not rewrite the V1 core:

- material and color variants;
- part visibility states;
- infographic hotspots;
- line and label overlays;
- controlled animation chapters;
- camera sequences;
- branded presentation mode;
- shareable read-only scenes;
- AR handoff.


---

## Archived source: `PRODUCT_VIS_V1_7_CHANGELOG.md`

# PRODUCT VIS V1.7 — CHANGELOG

## Release title

**Production Structure**

## Added — Product structure

- Deterministic product hierarchy indexing.
- Stable path-derived part IDs.
- Duplicate sibling-name disambiguation.
- Meaningful named-group and mesh classification.
- Authored-hidden group indexing.
- Parent/child hierarchy metadata.
- Product-part search index.
- Advanced → Parts workspace.
- Part selection and editor bounding-box helper.
- Part visibility toggle.
- Show All Parts action.
- Restore Authored Visibility action.
- Isolate Selected Part action.
- Reusable named visibility states.
- Part-local anchors.
- Camera-target/root-local anchors.
- Root-local fallback positions for unresolved part anchors.
- Off / Selected / All anchor display modes.
- Viewport anchor marker overlay.
- Focus-camera-on-anchor action.
- Deterministic Parts-group reset.
- Visible-bounds calculation based on currently renderable product geometry.
- Structure state persistence inside `.productvis`.
- Structure migration and sanitization budgets.
- Source/unit tests for stable IDs, authored visibility, sanitization and search.
- Browser smoke scenario for visibility states and anchors.

## Added — Production readiness

- Automatic local GLB model preflight.
- READY / REVIEW / HEAVY preflight classification.
- Geometry, draw-call, texture-memory and material-fragmentation diagnostics.
- Missing normal / UV diagnostics.
- Skinning, morph, animation, embedded-camera and embedded-light diagnostics.
- Rolling runtime performance monitor.
- Conservative adaptive quality stepping.
- Model/device quality ceiling.
- Optional hidden-tab realtime suspension.
- WebGL context-lost and context-restored app state.
- IndexedDB recovery draft store.
- Debounced, bounded local crash recovery.
- Recovery restore prompt and explicit recovery actions.
- Private downloadable support report.
- Advanced → Health workspace.

## Added — State

Project schema version `7`.

```js
configurator: {
  partVisibility: {},
  states: [],
  activeStateId: null,
  anchors: [],
  anchorDisplay: 'off',
  selectedAnchorId: null
}

runtime: {
  autoQuality: true,
  pauseWhenHidden: true,
  recoveryEnabled: true
}
```

## Changed

- Product bounds now follow visible product geometry rather than hidden branches.
- Grounding and contact-shadow framing refresh after structure visibility changes.
- Camera safety limits refresh after structure visibility changes.
- `.productvis` codec defaults to application version `1.7.0` and schema `7`.
- Global reset now includes Parts and Health/runtime defaults.
- Group-status indicators now include Parts and Health.
- Support reports include structure counts without exposing authored asset contents.
- Advanced tab layout expanded from four/five groups to six groups.
- README and help copy now explain Parts, anchors, preflight and recovery.

## Export safety

- Selected-part WebGL helper is disabled before offscreen export.
- Helper is restored in protected export cleanup.
- Export cleanup failures are contained and cannot leave export permanently locked.
- HTML anchor markers remain outside the WebGL render and cannot enter PNG output.

## Preserved

- Child-proof quick dock and V1.4 simple workflow.
- V1.2 neutral studio and geometry-aware contact shadow.
- V1.3 camera/material safety.
- V1.5 granular Advanced controls and deterministic resets.
- V1.6 binary `.productvis` persistence.
- Embedded raw GLB byte preservation.
- Saved looks and recent local projects.
- Exact Match / Fill offscreen export framing.
- Draco, Meshopt and KTX2/Basis support.
- Embedded animation and turntable controls.
- Local-only model processing.

## Deferred

- Commercial material/color variants.
- Variant-group authoring rules.
- Surface ray-picking and draggable anchors.
- Infographic cards, connector lines and responsive label layout.
- Exploded-view transform states.
- Animation chapters and camera sequences.
- Branded read-only presentation mode.
- Hosted scene sharing and AR handoff.


---

## Archived source: `PRODUCT_VIS_V1_7_PRODUCTION_STRUCTURE_HANDOFF.md`

# PRODUCT VIS V1.7 — PRODUCTION STRUCTURE HANDOFF

## 1. Checkpoint purpose

V1.7 closes the last architectural gap before the V2 configurator layer.

It combines two protected objectives:

1. **Make the renderer safer to use in production** without introducing a backend or touching the child-proof quick path.
2. **Give the imported GLB a stable semantic structure** that future variants, infographics, chapters and branded presentations can consume.

The checkpoint can be summarized as:

> A Product VIS project now understands product parts and product-local anchors, while also monitoring model health, runtime pressure and local recovery.

V1.7 is not the full configurator. It is the durable foundation that prevents the configurator from becoming a fragile collection of mesh-name hacks.

---

## 2. Protected user flow

The simple path remains:

```text
IMPORT GLB
    ↓
AUTOMATIC NORMALIZATION + PREFLIGHT
    ↓
BACKGROUND / LIGHTING / CAMERA
    ↓
OPTIONAL ADVANCED AUTHORING
    ↓
SAVE PROJECT / EXPORT FRAME
```

The quick dock remains focused on:

- background;
- lighting;
- camera;
- fit;
- turntable;
- Advanced.

V1.7 adds **Parts** and **Health** only inside Advanced.

---

# 3. Product structure architecture

## 3.1 Why a structure layer is required

A configurator cannot safely depend on raw Three.js object references because those references:

- are not serializable;
- change after import;
- cannot survive save/open;
- do not provide deterministic UI identifiers;
- do not distinguish authored visibility from user overrides;
- do not provide portable attachment points for future graphics.

V1.7 introduces three dedicated modules:

```text
src/structure/StructureIndex.js
src/structure/ProductStructure.js
src/structure/AnchorOverlay.js
```

### StructureIndex

Pure structure analysis with no Three.js dependency.

Owns:

- deterministic hierarchy traversal;
- stable part IDs;
- duplicate sibling disambiguation;
- meaningful group/mesh classification;
- authored visibility capture;
- hierarchy metadata;
- search indexing;
- visibility-map sanitization.

### ProductStructure

Runtime structure state tied to the active product.

Owns:

- part registry lookup;
- selection;
- authored/default visibility;
- visibility overrides;
- show-all / authored reset / isolate;
- reusable visibility states;
- part-local and root-local anchors;
- anchor resolution and fallback;
- visible-product bounds;
- editor selection helper;
- serializable structure state.

### AnchorOverlay

Presentation-only DOM projection layer.

Owns:

- projecting world anchors through the active camera;
- Off / Selected / All display modes;
- marker selection;
- hiding out-of-frame / behind-camera markers.

It does not own anchor data and does not enter the WebGL export.

---

## 3.2 Stable part IDs

Each indexed node receives a deterministic ID derived from its hierarchy path.

Example:

```text
product/body[1]/door[1]
product/body[1]/door[2]
```

Each path is hashed into:

```text
part_<stable hash>
```

Rules:

- mesh nodes are indexed;
- meaningful named groups containing meshes are indexed;
- authored-hidden groups containing meshes are indexed;
- generic one-child wrappers are skipped unless their visibility is meaningful;
- duplicate sibling names receive an ordinal;
- IDs are stable for the same hierarchy.

Important limitation:

> Renaming or reordering nodes in a new GLB revision can change path-derived IDs.

The exact embedded GLB inside a `.productvis` file therefore remains authoritative for the saved structure state.

---

## 3.3 Visibility model

V1.7 separates three concepts:

```text
Authored visibility
Requested visibility
Effective visibility
```

### Authored visibility

Captured once from the imported GLB.

### Requested visibility

The authored value unless a user override exists.

### Effective visibility

Requested visibility plus the complete parent chain. A visible child beneath a hidden parent remains effectively hidden.

Only differences from authored state are serialized:

```js
partVisibility: {
  part_abc1234: false,
  part_zxy9876: true
}
```

This keeps project files compact and makes “Restore authored visibility” deterministic.

---

## 3.4 Visibility operations

### Toggle selected part

Changes only the selected part’s requested visibility.

### Show all

Overrides authored-hidden indexed parts to visible.

### Restore authored visibility

Clears every manual override and returns to the GLB’s authored state.

### Isolate

Keeps:

- the selected part;
- indexed descendants;
- indexed ancestors required to keep the selected branch active.

Other indexed branches are hidden.

### Bounds and grounding

After a visibility operation, Product VIS recalculates:

- visible bounds;
- normalized product metrics;
- ground snap;
- contact-shadow footprint;
- camera safety limits.

This prevents hidden wheels, stands or accessories from continuing to influence framing and shadows.

---

## 3.5 Reusable visibility states

A visibility state stores a named snapshot of manual overrides.

```js
{
  id: "state_…",
  name: "Service view",
  visibility: {
    part_abc1234: false,
    part_zxy9876: true
  },
  createdAt: "2026-08-08T…"
}
```

Contract:

- maximum 32 states;
- state IDs are unique;
- state names are sanitized and bounded;
- unknown part IDs are discarded during project migration/application;
- applying a state updates visible bounds and contact shadow;
- deleting an active state clears only its active reference, not the current image.

Visibility states are the precursor to future variant groups. They are not yet marketed as a complete SKU/material configurator.

---

# 4. Anchor architecture

## 4.1 Anchor goals

Future callouts, infographics, chapters and camera sequences need positions that survive:

- model normalization;
- user scale;
- orientation changes;
- grounding and offset;
- camera movement;
- project save/open.

Screen coordinates cannot provide this.

V1.7 therefore stores anchors in product-local coordinate space.

---

## 4.2 Part-attached anchors

A part anchor stores a local coordinate relative to a deterministic part ID.

```js
{
  id,
  name,
  kind: "part-center",
  attachment: {
    type: "part",
    partId,
    localPosition: [x, y, z]
  },
  fallbackRootLocalPosition: [x, y, z],
  createdAt
}
```

V1.7 creates the initial point from the selected part’s visible bounds center.

Future systems can replace or refine that point without changing the persistence contract.

---

## 4.3 Camera-target anchors

A camera-target anchor captures the current camera target in product-root local coordinates.

```js
{
  kind: "camera-target",
  attachment: {
    type: "root",
    partId: null,
    localPosition: [x, y, z]
  }
}
```

This is useful for composition checkpoints and future camera chapters.

---

## 4.4 Fallback behavior

Every part anchor also stores a root-local fallback position.

When its part ID cannot be resolved:

- the anchor is not deleted;
- the fallback position remains available;
- the UI can report the marker as unresolved;
- the project remains recoverable.

---

## 4.5 Anchor display

Project state supports:

```text
Off
Selected
All
```

Markers are projected into an HTML overlay above the viewport.

They are not WebGL geometry and do not enter exports.

---

## 4.6 Focus camera on anchor

Focusing an anchor:

- resolves its current world position;
- updates the camera target;
- clears the named camera preset state to Custom;
- preserves the current camera direction and distance;
- updates persisted normalized camera target state.

---

# 5. Editor-helper export safety

The selected part uses a `Box3Helper` to make hierarchy authoring understandable.

That helper is explicitly excluded from export:

```text
Before export
→ disable structure helper
→ refresh contact shadow
→ render offscreen frame

Finally
→ restore structure helper
→ clear exporting state
```

Restoration is protected by its own error boundary. A cleanup failure cannot leave the exporter permanently locked.

Anchor markers are DOM elements and are never part of the offscreen WebGL render.

---

# 6. Production readiness architecture

## 6.1 Model preflight

`ModelPreflightAnalyzer` inspects the active product locally and reports:

- mesh / visible-mesh count;
- rendered triangles and vertices;
- estimated draw calls;
- unique geometries, materials and textures;
- largest texture dimensions;
- estimated decoded texture memory;
- missing normals / UVs;
- skinning, bones, morph targets and animation;
- negative / non-uniform transforms;
- embedded cameras and lights;
- source file size.

Result classes:

```text
READY
REVIEW
HEAVY
```

Preflight is advisory and does not mutate the GLB.

---

## 6.2 Adaptive quality

`RuntimePerformanceMonitor` uses rolling frame-time evidence, sustained-pressure windows and cooldowns.

It can move through:

```text
quality ↔ balanced ↔ performance
```

The model preflight and device budget provide an upper quality ceiling.

Manual selection remains possible and Auto Quality can be disabled.

---

## 6.3 Hidden-tab suspension

When `pauseWhenHidden` is enabled:

- rendering is suspended when `document.hidden` becomes true;
- the clock and performance window reset on return;
- the contact shadow is marked dirty;
- realtime resumes without a giant time delta.

---

## 6.4 Recovery drafts

`RecoveryDraftStore` stores one bounded dirty draft in IndexedDB using the binary `.productvis` format.

Behavior:

- debounced writes;
- no unlimited history;
- safe no-op when IndexedDB is unavailable;
- explicit clear action;
- automatic clear after successful project save;
- restore prompt on a later launch.

Recovery does not replace explicit project saving.

---

## 6.5 WebGL recovery state

The renderer now reports context loss and restoration to the app shell.

On restoration Product VIS:

- clears suspended state;
- resets runtime monitoring;
- resizes the renderer;
- refreshes status copy;
- resumes realtime rendering.

---

## 6.6 Private support report

The downloadable support JSON includes:

- app build and project schema;
- browser/platform details;
- WebGL limits and debug strings when available;
- viewport / pixel-ratio information;
- project summary;
- preflight report;
- material and camera diagnostics;
- structure counts;
- runtime metrics;
- recovery metadata.

It intentionally excludes model bytes, textures, binary project payloads and user-authored asset contents.

---

# 7. Project state and migration

Project schema is now `7`.

## Configurator foundation state

```js
configurator: {
  partVisibility: {},
  states: [],
  activeStateId: null,
  anchors: [],
  anchorDisplay: "off",
  selectedAnchorId: null
}
```

## Runtime state

```js
runtime: {
  autoQuality: true,
  pauseWhenHidden: true,
  recoveryEnabled: true
}
```

## Sanitization budgets

```text
Part visibility overrides   4096
Visibility states             32
Anchors                      128
```

Coordinates are required to be finite and are bounded before entering runtime state.

Older project schemas are migrated to empty structure state and safe runtime defaults.

---

# 8. UI changes

Advanced tabs are now:

```text
Look
Object
Camera
Motion
Parts
Health
```

## Parts workspace

- searchable hierarchy;
- part count and hidden count;
- part select / visible toggle;
- show all;
- restore authored visibility;
- isolate selected part;
- saved visibility states;
- anchor creation and focus;
- anchor display control;
- deterministic Parts reset.

## Health workspace

- preflight score and issues;
- runtime FPS/frame-time readout;
- auto-quality toggle;
- hidden-tab pause toggle;
- recovery toggle and actions;
- support-report export.

The quick dock is unchanged.

---

# 9. V1.7 acceptance checklist

## Product structure

- [ ] Same embedded GLB produces the same part IDs after reopen.
- [ ] Duplicate sibling names produce unique IDs.
- [ ] Authored-hidden groups are visible in the registry.
- [ ] Parent visibility controls descendant effective visibility.
- [ ] Restore Authored clears manual overrides.
- [ ] Isolate preserves the selected branch and ancestors.
- [ ] Visible bounds update after hide/show/isolate.
- [ ] Contact shadow updates after visibility changes.

## Visibility states

- [ ] State creation preserves the current override map.
- [ ] State application reproduces the same visible product.
- [ ] State deletion does not corrupt current visibility.
- [ ] States survive `.productvis` save/open.

## Anchors

- [ ] A selected part can create a part-local anchor.
- [ ] Current camera target can create a root-local anchor.
- [ ] Off / Selected / All display works.
- [ ] Focusing an anchor updates the camera target.
- [ ] Anchors survive object scale/rotation/offset.
- [ ] Anchors survive `.productvis` save/open.
- [ ] Missing part references fall back safely.

## Export

- [ ] Selection helper never appears in exported PNG.
- [ ] Anchor markers never appear in exported PNG.
- [ ] Helper state is restored after successful export.
- [ ] Helper state is restored after failed export.

## Production health

- [ ] Imported/reopened models receive a preflight report.
- [ ] Sustained pressure can lower quality, not a single slow frame.
- [ ] Hidden tabs suspend and resume cleanly.
- [ ] Recovery draft behavior is optional and bounded.
- [ ] Support report excludes model bytes.
- [ ] WebGL context state is surfaced to the user.

## Architecture

- [ ] Project schema reports `7`.
- [ ] Quick dock has no Parts or Health authoring controls.
- [ ] UI layer does not import Three.js.
- [ ] Runtime source has no CDN dependency.
- [ ] `npm run check` gates Vercel builds.

---

# 10. Required validation assets

1. **Opaque hard-surface product**
   - hierarchy and visibility basics.
2. **Vehicle with glass and interior**
   - many nested parts and transparent materials.
3. **Product with authored-hidden accessories**
   - Show All and Restore Authored behavior.
4. **Animated multi-part product**
   - part-attached anchor movement.
5. **Awkward pivot / extreme scale product**
   - normalization and anchor stability.
6. **Duplicate node-name fixture**
   - deterministic ordinal disambiguation.

For each model, validate save/open after creating at least one visibility state and one anchor.

---

# 11. Deferred to the V2 configurator layer

V1.7 deliberately does not implement:

- commercial material/color variants;
- user-defined variant group rules;
- surface ray-picking and draggable anchors;
- infographic cards and connector paths;
- exploded transform states;
- guided animation chapters;
- camera sequences;
- branded read-only presentation mode;
- hosted share links;
- AR handoff.

These systems should consume the V1.7 part and anchor contracts instead of re-indexing the GLB independently.


---

## Archived source: `PRODUCT_VIS_V1_7_VALIDATION.md`

# PRODUCT VIS V1.7 — VALIDATION REPORT

## Validation date

2026-08-08

## Release

```text
Product VIS version       1.7.0
Project schema            7
Build marker              v1.7-production-structure
Release title             Production Structure
```

---

## Completed in this environment

```text
JavaScript / MJS syntax checks              PASS
Unit + architecture tests                   PASS — 54/54
Local JavaScript import resolution          PASS
Required module-boundary gate               PASS
DOM binding completeness                    PASS
Unique HTML IDs                             PASS
No runtime Three.js CDN imports             PASS
Pinned dependency versions                  PASS
Quick-dock preservation gate                PASS
V1.2 neutral studio gates                   PASS
V1.3 camera/material safety gates           PASS
V1.4 simple-path gates                      PASS
V1.5 Advanced/reset gates                   PASS
V1.6 persistence/export gates               PASS
V1.7 production-readiness gates             PASS
V1.7 product-structure gates                PASS
Editor-helper export exclusion gate         PASS
Binary .productvis round trip                PASS
Schema V3 → V7 migration                    PASS
Configurator state round trip               PASS
Raw GLB byte equality                        PASS
Corrupt project rejection                    PASS
Export framing mathematics                   PASS
GPU-limit export fallback                    PASS
Structure-ID determinism                     PASS
Duplicate sibling disambiguation             PASS
Authored visibility preservation             PASS
Structure search                             PASS
Recovery-store degradation                   PASS
Support-report privacy source gate           PASS
Vercel test-before-build contract             PASS
```

---

## Source test command

```bash
cd /mnt/data/pv17
node --test tests/*.test.mjs
```

Result:

```text
54 tests
54 passed
0 failed
```

---

## Test groups

### Architecture and source contracts

- all required source modules exist;
- all relative JavaScript imports resolve;
- no runtime CDN dependency;
- package versions are pinned;
- DOM IDs are unique and every binding resolves;
- UI code does not import Three.js runtime objects;
- Vercel build remains gated by `npm run check`;
- versioned decoder paths remain protected.

### Existing renderer contracts

- backdrop and lighting remain independent;
- neutral studio defaults remain restrained;
- contact shadow remains isolated, geometry-aware and quality-scaled;
- camera safety and adaptive clipping remain present;
- material diagnostics and side-repair contracts remain present;
- simple quick path remains intact and Advanced remains closed by default;
- Advanced controls map to one project state;
- `.productvis` remains binary and embeds raw GLB bytes;
- Match / Fill export plans remain deterministic;
- oversized export plans scale safely to GPU texture limits.

### Production-readiness contracts

- clean assets receive READY preflight;
- heavy assets receive critical optimization guidance;
- missing normals, UVs and texture limits are detected without mutating assets;
- adaptive quality steps only after sustained pressure;
- quality ceiling and suspended state are respected;
- recovery degrades safely without IndexedDB;
- recovery round-trips one bounded local draft;
- oversized recovery drafts are rejected.

### Product-structure contracts

- identical hierarchy paths produce deterministic part IDs;
- duplicate sibling names remain unique;
- authored visibility and hierarchy metadata are preserved;
- invalid visibility overrides are rejected;
- structure search matches names, paths and node kinds;
- project persistence round-trip preserves:
  - part visibility;
  - visibility states;
  - active state;
  - anchors;
  - anchor display;
  - selected anchor;
- schema migration supplies safe empty structure defaults;
- structure controls remain outside the quick dock.

### Export-helper safety

Source architecture asserts:

```text
FrameExporter accepts afterRender cleanup
AppController disables structure helpers before export
AppController restores structure helpers after export
Cleanup errors are contained
```

HTML anchor markers are separate from the WebGL scene and therefore cannot enter the offscreen image.

---

## Browser smoke coverage included in the repository

`tests/smoke.spec.js` includes coverage for:

- boot to ready state;
- V1.7 build marker;
- simple quick controls;
- Advanced navigation;
- GLB import and repeated import cleanup;
- neutral backdrop / lighting independence;
- contact-shadow presence;
- material diagnostics;
- camera safety;
- `.productvis` save/open restoration;
- saved looks;
- Match / Fill export controls;
- model health and runtime controls;
- Parts workspace;
- part selection and visibility;
- visibility-state creation;
- part-anchor creation;
- anchor display state;
- Parts reset.

---

## Final archive integrity

The packaged ZIP was extracted into a separate clean directory and validated again from the extracted files.

```text
Packaged files                         89
Manifest entries                      88
Manifest verification                 PASS
Extracted JavaScript syntax            PASS
Extracted unit + architecture tests    PASS — 54/54
Extracted HTML IDs                     PASS — 198 unique
Extracted DOM bindings                 PASS — 197 complete
Extracted build marker                 PASS
```

The manifest intentionally excludes only `docs/V1_7_MANIFEST.sha256` itself.
The external ZIP checksum is provided in the companion `.zip.sha256` artifact.

---

## Connected-build attempt

A real dependency installation was attempted:

```bash
npm install --ignore-scripts --no-audit --no-fund
```

The internal sandbox package registry returned:

```text
404 Not Found — @playwright/test@1.62.0
```

Therefore this environment could not create `node_modules`, run the actual Vite production bundle or execute Playwright Chromium. No successful Vite/WebGL browser build is claimed here.

This is an environment/package-mirror limitation, not a source-test pass being presented as a browser pass.

---

## Required connected gate

On the first normal internet-connected development machine or Vercel preview:

```bash
npm install
npm run check
npx playwright install chromium
npm run test:smoke
```

Commit the generated `package-lock.json` after the accepted dependency resolution.

---

## Required manual V1.7 preview checks

### Structure

1. Import a multi-part GLB.
2. Open Advanced → Parts.
3. Search and select a nested part.
4. Toggle it off and verify bounds/shadow update.
5. Restore Authored Visibility.
6. Isolate a selected part.
7. Save and apply at least two visibility states.

### Anchors

1. Create a part anchor.
2. Create a camera-target anchor.
3. Test Off / Selected / All display.
4. Focus the camera on each anchor.
5. Scale, rotate and vertically offset the product.
6. Verify anchors follow the product.
7. Save and reopen the `.productvis` file.

### Export

1. Select a part so the orange editor box is visible.
2. Display all anchor markers.
3. Export Viewport, Square and Portrait.
4. Confirm no selection box or anchor marker appears in any PNG.
5. Confirm the editor helpers reappear after export.

### Production health

1. Import a clean lightweight asset and confirm READY.
2. Import a heavy fragmented asset and confirm REVIEW/HEAVY guidance.
3. Enable Auto Quality and test sustained pressure.
4. Hide and restore the browser tab.
5. Create/restore/clear a recovery draft.
6. Download and inspect the support report for privacy.

---

## Scope note

V1.7 validates the semantic product foundation. It does not claim a completed commercial configurator, surface-picking tool, infographic layout engine, animation chapter system or hosted sharing layer.


---

## Archived source: `PRODUCT_VIS_V1_8_CONFIGURATOR_AUTHORING_HANDOFF.md`

# PRODUCT VIS V1.8 — CONFIGURATOR AUTHORING HANDOFF

## 1. Checkpoint purpose

V1.8 is the first authored configurator layer built on the V1.7 production structure.

Its goal is narrow but commercially useful:

> Let a non-technical user define product options, explain features with product-attached graphics, and save complete static presentation shots without weakening the simple renderer or introducing a timeline by accident.

V1.8 is organized into three independent state layers:

```text
CONFIGURATIONS
What product option is active?

INFOGRAPHICS
What should the viewer understand?

PRESENTATION STATES
How should the current static shot look?
```

Motion remains a separate runtime domain.

---

## 2. Protected simple flow

The simple path remains unchanged:

```text
IMPORT GLB
    ↓
AUTOMATIC PREFLIGHT + NORMALIZATION
    ↓
BACKGROUND / LIGHTING / CAMERA
    ↓
OPTIONAL ADVANCED AUTHORING
    ↓
SAVE PROJECT / EXPORT FRAME
```

The quick dock still contains only:

- background;
- lighting;
- camera;
- fit;
- turntable;
- Advanced.

Variant authoring, infographics and presentation-state management remain in Advanced.

---

# 3. Commercial variant architecture

## 3.1 Modules

```text
src/configurator/VariantGrammar.js
src/configurator/ProductVariants.js
```

### VariantGrammar

Pure, serializable logic with no Three.js dependency.

Owns:

- group / option / configuration sanitization;
- ID normalization and uniqueness;
- color and appearance normalization;
- target filtering;
- required-group defaults;
- ordered option resolution;
- conflict reporting;
- state-size limits.

### ProductVariants

Runtime authoring state.

Owns:

- creating and deleting groups;
- required / optional behavior;
- creating and deleting options;
- active selection per group;
- default option assignment;
- saved configurations;
- deterministic resolution;
- applying resolved visibility and appearance patches to ProductSession.

It does not own GLB hierarchy indexing. It consumes the stable part IDs supplied by V1.7.

---

## 3.2 Variant state

```js
variantGroups: [
  {
    id,
    name,
    required,
    defaultOptionId,
    options: [
      {
        id,
        name,
        swatch,
        changes: {
          appearance: {
            part_id: {
              color,
              roughness,
              metalness,
              clearcoat,
              clearcoatRoughness
            }
          },
          visibility: {
            part_id: true | false
          }
        }
      }
    ]
  }
]

variantSelections: {
  group_id: option_id
}

configurations: [
  {
    id,
    name,
    selections
  }
]

activeConfigurationId: null | string
variantPreviewEnabled: false
```

Limits:

```text
Groups                  24
Options per group       32
Targets per option     256
Saved configurations    32
```

---

## 3.3 Resolution grammar

Variant groups resolve in authored order.

For each active option:

1. validate the group and selected option;
2. expand selected group targets to renderable mesh descendants where needed;
3. apply visibility properties;
4. apply appearance properties;
5. record an overlap whenever a later group replaces a property written by an earlier group.

Conflict behavior is deterministic:

> Later groups win only for properties they explicitly author.

Examples:

```text
Group 1 changes Body.color
Group 2 changes Body.roughness
Result: both changes survive, no property conflict.

Group 1 changes Body.color
Group 2 changes Body.color
Result: Group 2 wins and one conflict is reported.
```

The UI reports conflicts; it does not block them. Some intentional layered products need controlled overlaps.

---

## 3.4 Material application

ProductSession keeps the GLB’s original materials as the source.

For a targeted mesh:

- the current original or treatment material is cloned;
- only authored appearance fields are changed;
- the instance is tracked for disposal;
- non-targeted meshes remain untouched;
- material side intent and existing repair rules remain active.

Changing an option disposes stale variant instances before rebuilding the active presentation.

---

## 3.5 Variant visibility

Variant visibility is separate from manual visibility.

The effective product visibility combines:

```text
Authored GLB visibility
Manual Parts override
Variant visibility override
Parent-chain visibility
```

This prevents a configuration from erasing the user’s reusable manual visibility states.

After variant changes, Product VIS refreshes:

- visible bounds;
- grounding;
- camera safety;
- contact-shadow footprint.

---

## 3.6 Viewport option tray

`variantPreviewEnabled` exposes authored groups as a compact viewport tray.

Contract:

- OFF by default;
- outside the quick dock;
- uses the exact same `variantSelections` state as Advanced;
- saved in `.productvis`;
- recalled by presentation states;
- reset with the Variants group.

No duplicate preview-only state exists.

---

# 4. Infographic architecture

## 4.1 Modules

```text
src/configurator/InfographicGrammar.js
src/configurator/InfographicSystem.js
src/configurator/InfographicLayout.js
src/configurator/InfographicOverlay.js
```

### InfographicGrammar

Owns:

- bounded content sanitization;
- ID uniqueness;
- anchor references;
- accent colors;
- preferred side;
- visibility;
- display mode;
- selected record state.

### InfographicSystem

Owns:

- create / update / delete;
- visibility;
- selection;
- Off / Selected / All display;
- anchor-resolution reporting;
- serializable state.

### InfographicLayout

Pure viewport-space layout.

Owns:

- same-side vertical collision separation;
- viewport-bound clamping;
- card-edge targeting;
- deterministic cubic SVG connector paths.

### InfographicOverlay

DOM projection and rendering only.

Owns:

- world-to-screen anchor projection;
- camera-facing card elements;
- SVG paths;
- selection interaction;
- hidden / unresolved handling.

It does not own infographic data and does not enter WebGL export.

---

## 4.2 Infographic state

```js
infographics: [
  {
    id,
    anchorId,
    eyebrow,
    title,
    body,
    accent,
    side: 'auto' | 'left' | 'right',
    visible,
    createdAt,
    updatedAt
  }
]

infographicDisplay: 'off' | 'selected' | 'all'
selectedInfographicId: null | string
```

Limit:

```text
64 infographic cards per project
```

Cards reference the durable product-local anchors from V1.7. They do not store screen coordinates.

---

## 4.3 Screen-facing behavior

The card is an HTML element, so:

- text is never mirrored;
- no backface can appear;
- typography stays crisp;
- accessibility remains possible;
- layout can react to mobile and desktop viewports.

On each rendered frame:

1. ProductStructure resolves the anchor’s world position.
2. InfographicOverlay projects it through the active camera.
3. Automatic side uses the anchor’s viewport position.
4. InfographicLayout separates cards on each side.
5. The connector is regenerated from anchor to card edge.
6. Behind-camera and invalid markers are hidden.

---

## 4.4 Export boundary

Infographic cards and SVG connector paths are editor/presentation DOM overlays.

They cannot appear in the offscreen WebGL PNG pipeline.

This is intentional for V1.8:

```text
Clean render export      Supported
Authored overlay preview Supported
Branded composited export Deferred
```

The future branded presentation exporter may composite these layers explicitly. It must not happen accidentally inside the renderer.

---

# 5. Presentation-state architecture

## 5.1 Module

```text
src/configurator/PresentationStateLibrary.js
```

Pure serializable state; no Three.js dependency.

Owns:

- snapshot sanitization;
- state names and IDs;
- create / apply / delete;
- active state reference;
- 32-state limit;
- legacy alias migration.

---

## 5.2 What a presentation captures

A presentation state stores a static shot:

```text
Studio
- backdrop and named presets
- exposure / IBL / lights / bloom
- ground and shadow
- floor / shadows / post-processing

Object
- scale / vertical offset
- X/Z position
- XYZ orientation
- material treatment
- automatic backface repair
- manual material-side overrides

Camera
- named preset
- focal length
- normalized target
- exact direction and distance
- up vector
- source aspect
- damping / auto orbit / horizon
- Presentation / Inspect mode

Configurator
- manual part visibility
- active variant selections
- active configuration reference
- viewport option tray
- infographic display mode
- selected infographic

Render
- quality
- Match / Fill export framing
```

---

## 5.3 Motion exclusion

Presentation states deliberately exclude:

```text
Animation clip
Animation playback
Animation time
Animation loop
Animation speed
Turntable state
Turntable speed
Turntable angle
```

Applying a presentation retains the current live motion state.

Reason:

> A static shot preset must not become an implicit timeline or animation chapter system.

Controlled motion belongs to a separate future chapter/sequencing layer with explicit duration, easing and transition rules.

---

## 5.4 Application order

A presentation is applied in this order:

1. sanitize against current schema;
2. preserve the current GLB, authored libraries and motion state;
3. apply studio and render runtime;
4. apply object transform and material safety;
5. apply manual visibility and variant selections;
6. apply infographic display state;
7. update camera limits, focal length, target and pose;
8. refresh UI, bounds, contact shadow and diagnostics;
9. store the active presentation reference.

The variant definitions, visibility-state library, anchors, infographic records and other presentation states remain intact.

---

# 6. Project schema 8

```js
configurator: {
  partVisibility: {},
  states: [],
  activeStateId: null,
  anchors: [],
  anchorDisplay: 'off',
  selectedAnchorId: null,

  variantGroups: [],
  variantSelections: {},
  configurations: [],
  activeConfigurationId: null,
  variantPreviewEnabled: false,

  infographics: [],
  infographicDisplay: 'off',
  selectedInfographicId: null,

  presentations: [],
  activePresentationId: null
}
```

Migration supports earlier project schemas and the legacy aliases:

```text
presentationStates
activePresentationStateId
```

Unknown IDs, invalid enums and unsafe values are sanitized before runtime application.

---

# 7. Reset contract

### Reset Variants

- restores required groups to defaults;
- clears optional selections;
- clears active configuration reference;
- hides the viewport option tray;
- preserves authored groups, options and saved configurations.

### Reset Info

- removes infographic records;
- clears infographic display and selection;
- removes presentation states;
- preserves product anchors in Parts.

### Global Reset

Calls the existing deterministic group resets, including Variants and Info. It does not rewrite or reimport the GLB.

---

# 8. V1.8 acceptance checklist

## Variants

- [ ] Create a required group.
- [ ] Create at least two options targeting one selected part.
- [ ] Exactly one option is active at a time.
- [ ] Required reset returns to the default option.
- [ ] Optional group can clear its selection.
- [ ] Appearance and visibility changes combine correctly.
- [ ] Overlapping properties produce deterministic conflict reports.
- [ ] Saved configurations restore selections.
- [ ] Viewport tray uses the same selections as Advanced.

## Infographics

- [ ] Create an anchor in Parts.
- [ ] Create a card attached to that anchor.
- [ ] Card stays readable while orbiting.
- [ ] Connector follows the anchor.
- [ ] Multiple same-side cards do not overlap unnecessarily.
- [ ] Unresolved anchors are reported instead of deleted.
- [ ] Off / Selected / All works.
- [ ] Clean PNG exports contain no cards or connector lines.

## Presentation states

- [ ] Save a shot with a non-default look, camera and variant.
- [ ] Change the scene and apply the saved state.
- [ ] Static composition returns.
- [ ] Animation time and turntable angle do not change.
- [ ] State survives `.productvis` save/open.
- [ ] Deleting a state does not change the active image.

## Reliability

- [ ] Schema reports `8`.
- [ ] Preview, infographics and presentations round-trip through the binary project codec.
- [ ] V3 projects migrate to safe V8 defaults.
- [ ] Quick dock has no authoring controls added.
- [ ] All source and architecture tests pass.

---

# 9. Recommended validation assets

1. **Vehicle with body, glass and wheel subparts**  
   Tests finish and wheel groups, material safety and nested targets.

2. **Product with optional accessories**  
   Tests visibility options and configurations.

3. **Medical or technical product with small feature regions**  
   Tests several anchored cards and camera-facing readability.

4. **Animated product**  
   Confirms presentation states do not alter motion.

5. **Awkward hierarchy with duplicate names**  
   Confirms stable IDs remain the source for variants and anchors.

---

# 10. Deferred layer

V1.8 intentionally defers:

- transform variants and exploded states;
- ray-picked/draggable anchors;
- controlled animation chapters;
- camera sequences and transitions;
- timeline editing;
- branded read-only presentation mode;
- composited infographic export;
- hosted sharing and AR handoff.

The next safe layer is a controlled product-story system that consumes the same variants, anchors, infographics and static presentation states without replacing them.


---

## Archived source: `PRODUCT_VIS_V1_9_CONTROLLED_PRODUCT_STORIES_HANDOFF.md`

# PRODUCT VIS V1.9 — CONTROLLED PRODUCT STORIES HANDOFF

## 1. Checkpoint purpose

V1.9 converts the reusable authoring assets established in V1.7 and V1.8 into controlled, directed product experiences.

The checkpoint intentionally avoids a freeform timeline.

> V1.9 is a step-based story director. It combines reusable shots, exploded compositions, bounded animation chapters and infographic states into deterministic product sequences.

The simple render workflow and V1.8 quick dock remain protected.

---

## 2. Product result

The full authoring flow is now:

```text
IMPORT GLB
    ↓
NORMALIZE + PREFLIGHT + PRODUCT STRUCTURE
    ↓
AUTHOR PART VISIBILITY / VARIANTS / ANCHORS
    ↓
SAVE STATIC PRESENTATION SHOTS
    ↓
AUTHOR ASSEMBLED / EXPLODED STATES
    ↓
AUTHOR BOUNDED ANIMATION CHAPTERS
    ↓
COMPOSE ORDERED STORY STEPS
    ↓
PLAY FROM OPTIONAL VIEWPORT TRANSPORT
    ↓
SAVE PORTABLE .productvis PROJECT
```

A story step can recall:

- a static presentation state;
- an assembled or exploded state;
- an embedded animation chapter;
- an infographic display instruction;
- a transition duration and easing;
- a hold duration.

---

## 3. Locked architecture boundaries

### StoryGrammar

Owns only serializable, runtime-independent story contracts:

- exploded offsets and exploded-state sanitization;
- animation chapter sanitization;
- story and step sanitization;
- authoring limits;
- reference validation;
- chapter-range resolution.

It does not import Three.js or mutate the scene.

### StorySystem

Owns only authoring libraries and selection state:

- animation chapter CRUD;
- story CRUD;
- ordered step CRUD;
- active story and step;
- viewport transport preference;
- unresolved-reference report.

It does not control animation or rendering.

### StoryPlayer

Owns only deterministic playback progression:

```text
idle
transition
chapter
hold
```

It delegates scene changes through callbacks. It does not know about Three.js, DOM controls, model parts or cameras.

### ProductExplosion

Owns product-local exploded offsets:

- one offset vector per stable part ID;
- named exploded-state library;
- assembled state support;
- transition interpolation;
- animation-safe remove/evaluate/reapply order;
- transition pause, resume and cancellation.

It does not own stories or camera state.

### CameraRig

Continues to own camera safety and now also owns:

- saved-pose transitions;
- focal-length interpolation;
- up-vector interpolation;
- transition pause and resume;
- transition cancellation;
- live endpoint recalculation while product bounds expand.

### MotionController

Continues to own embedded animation and turntable motion. It now also owns bounded animation chapters:

- selected clip;
- chapter start / end;
- chapter speed;
- chapter loop;
- optional end-pose hold;
- completion callback.

---

## 4. Exploded composition contract

### Part offsets

Each offset is keyed by the deterministic V1.7 structure ID:

```js
explodeOffsets: {
  part_abc123: [x, y, z]
}
```

The vector is stored in normalized product-root space. It is not a screen-space offset and not a camera-space offset.

### Automatic direction

`Auto radial` computes the direction from the visible product center to the selected part center. Explicit ±X, ±Y and ±Z overrides are also available.

### Animation-safe application

Before the mixer evaluates a new frame, ProductExplosion removes the local offset applied during the previous frame. After the mixer updates, it converts the current root-space vector into the part parent’s local space and reapplies it.

This prevents cumulative drift and allows parts to stay exploded while their authored animation continues.

### Named states

A named state stores the complete current offset map. Empty offset maps are valid, allowing an authored `Assembled` state.

---

## 5. Animation chapter contract

A chapter is a reference to a range inside one embedded GLB clip:

```js
{
  id,
  name,
  clipIndex,
  startTime,
  endTime,
  speed,
  loop,
  holdAtEnd
}
```

The underlying GLB animation is not duplicated.

### Non-looping chapter

At `endTime`:

- the action pauses;
- the story receives a completion callback;
- `holdAtEnd=true` keeps the end pose;
- `holdAtEnd=false` returns to the chapter start pose.

### Looping chapter

A looping chapter repeats between its authored range and does not auto-complete. The user advances or stops the story manually.

This behavior is explicit and deterministic.

---

## 6. Story-step grammar

A step stores references, never duplicate library payloads:

```js
{
  id,
  name,
  presentationId,
  explodeStateId,
  chapterId,
  infographicDisplay,
  selectedInfographicId,
  transitionDuration,
  holdDuration,
  easing
}
```

Supported infographic instructions:

```text
Inherit
Off
Selected
All
```

Supported transition easings:

```text
Linear
Ease out
Ease in/out
Cinematic
```

A missing reference is reported as unresolved. The step remains in the story and can recover automatically when the referenced library item returns.

---

## 7. Playback contract

### Phase order

```text
APPLY STEP
    ↓
TRANSITION
    ↓
START CHAPTER OR SKIP
    ↓
CHAPTER
    ↓
HOLD
    ↓
NEXT STEP / COMPLETE / LOOP
```

### Shared transition

The camera pose and exploded composition use the same step transition duration and easing.

### Pause

Pause freezes:

- StoryPlayer phase time;
- CameraRig pose tween;
- ProductExplosion tween;
- MotionController chapter playback.

Resume shifts the relevant start timestamps by the exact paused duration.

### Previous / Next / Stop

Abandoning a step cancels the in-flight camera and explosion tweens without snapping to their old targets. The next step starts from the current visible pose.

### Bounds coordination

During explosion, visible product bounds change. CameraRig updates the final target and distance against the live bounds without moving the current frame. This avoids endpoint drift and transition jumps.

---

## 8. UI additions

### Advanced → Stories

Four authoring blocks:

1. **Exploded composition**
2. **Animation chapters**
3. **Story director**
4. **Story step**

### Viewport transport

Optional floating transport:

```text
Previous | Play/Pause/Resume | Next | Stop
```

It also shows:

- current story;
- current phase;
- current step index and name.

The transport is separate from the protected quick dock.

### Mobile

The existing horizontally scrollable Advanced tab rail now includes Stories as a full-size tab rather than shrinking all labels.

---

## 9. State schema changes

Project schema is now `9`.

Added configurator state:

```js
configurator: {
  explodeOffsets: {},
  explodeStates: [],
  activeExplodeStateId: null,

  animationChapters: [],

  stories: [],
  activeStoryId: null,
  activeStoryStepId: null,
  storyPreviewEnabled: false
}
```

Authoring limits:

```text
Exploded offsets             256
Exploded states               32
Animation chapters            32
Stories                       16
Steps per story               48
```

Migration accepts legacy aliases such as:

```text
partOffsets
explodedStates
activeExplodedStateId
chapters
storySequences
activeStepId
```

---

## 10. Persistence and recovery

All V1.9 authoring state is included in:

- explicit `.productvis` downloads;
- local recent projects;
- recovery drafts;
- support-report counts.

The raw GLB remains embedded byte-for-byte in the portable project file.

Runtime playback phase is deliberately not persisted. Reopened projects return to an authoring-ready state with the selected story and step retained.

---

## 11. Export contract

Clean export remains independent from the story UI.

Excluded from PNG output:

- selected-part outline;
- anchor markers;
- infographic HTML/SVG overlays;
- variant tray;
- story transport;
- Advanced Stories controls.

Story state affects the product, camera and material composition, but editor helpers do not enter the offscreen WebGL target.

---

## 12. Reset behavior

`Reset Stories` performs one deterministic operation:

```text
Stop story
Stop chapter
Cancel camera/explosion transitions
Clear live exploded offsets
Delete exploded-state library
Delete animation-chapter library
Delete story library
Disable viewport story transport
```

It does not delete:

- V1.7 part visibility states or anchors;
- V1.8 variant groups or configurations;
- V1.8 infographics;
- V1.8 presentation states.

Global Reset continues to call the same group reset rather than maintaining a hidden alternate path.

---

## 13. V1.9 acceptance checklist

### Exploded states

- [ ] A selected part can receive an automatic or axis-specific offset.
- [ ] Multiple offsets can be saved as one named state.
- [ ] An empty Assembled state can be saved.
- [ ] Applying a state transitions without accumulating transforms.
- [ ] Animated parts retain their exploded relationship.
- [ ] Bounds and contact shadow update while the product expands.

### Chapters

- [ ] A chapter references a valid embedded clip and bounded range.
- [ ] Speed is applied only to the active chapter.
- [ ] Non-looping chapters notify story completion.
- [ ] Looping chapters remain active until manual navigation.
- [ ] End-pose hold behavior is deterministic.

### Stories

- [ ] Stories can be created, deleted and looped.
- [ ] Steps can be added, updated, reordered and deleted.
- [ ] A step can combine presentation, explosion, chapter and infographic state.
- [ ] Missing references are reported without deleting the step.
- [ ] Transition → chapter → hold order is deterministic.
- [ ] Pause freezes all active story motion.
- [ ] Next and Stop cancel abandoned transitions.

### Persistence

- [ ] Schema reports `9`.
- [ ] `.productvis` round-trip preserves V1.9 authoring state.
- [ ] V3–V8 projects migrate safely.
- [ ] Recovery drafts include V1.9 state.
- [ ] Support report includes counts but no authored content or asset bytes.

### UI and export

- [ ] Quick dock is unchanged.
- [ ] Stories lives only in Advanced.
- [ ] Viewport transport appears only when enabled and usable.
- [ ] No timeline UI is introduced.
- [ ] Story transport and authoring helpers do not enter clean PNG export.

---

## 14. Validation assets

Recommended connected-preview validation:

1. opaque multi-part hard-surface product;
2. animated mechanism with several child parts;
3. vehicle with doors, wheels and glass;
4. product with nested animated pivots;
5. heavy product to verify adaptive quality while stories play.

For each, validate:

- assembled → exploded → assembled;
- camera transition with changing explosion bounds;
- pause/resume halfway through transition;
- chapter end-pose hold;
- manual Next during transition;
- `.productvis` save/open;
- clean Match and Fill exports.

---

## 15. Next protected checkpoint

The next checkpoint should not expand the story grammar until V1.9 is accepted on a connected WebGL preview.

A reasonable V2.0 direction is **Branded Presentation Mode**:

- read-only configurator/player mode;
- branded intro and outro states;
- optional composited infographic export;
- guided chapter navigation;
- shareable scene packaging;
- AR handoff boundary.

The authoring renderer and the presentation player should remain separate surfaces over the same versioned state.


---

## Archived source: `PRODUCT_VIS_V1_BASELINE_HANDOFF.md`

# PRODUCT VIS — V1 Handoff

## Product idea

PRODUCT VIS turns the working logic behind VisualRef into a focused product-rendering tool: import one GLB, receive a polished realtime studio scene immediately, then shape the result through simple visual controls rather than a traditional 3D interface.

## V1 objective

Prove the core loop:

**GLB in → premium realtime look → controlled camera → clean exported visual.**

The interface intentionally avoids scene trees, node graphs and technical 3D vocabulary. Advanced capability is grouped under four clear layers: Look, Object, Camera and Motion.

## Implemented foundation

- Static client-only architecture suitable for Vercel.
- GLB import with compressed geometry and texture decoder support.
- Automatic model normalization and model statistics.
- Procedural studio environment, contact shadow and post-processing.
- Responsive preset-driven interface for desktop and mobile.
- Material overrides without destroying original model materials.
- Camera grammar and smooth camera interpolation.
- Embedded animation playback and turntable motion.
- Multi-format clean PNG export.

## Product principles locked for future versions

1. The imported product is always the hero.
2. First-layer controls should feel like a game, not Blender.
3. Technical controls are available, but translated into visual language.
4. Every advanced feature must collapse back into a preset or reusable state.
5. The viewport remains clean and export-ready at every stage.
6. Mobile performance is a core requirement, not a later adaptation.

## Recommended V2 scope

- User HDRI import plus rotation and blur.
- Light cards that can be moved around the product.
- Saved looks and downloadable `.productvis` scene files.
- Configurator states for colors, materials, parts and variants.
- Hotspots with labels, lines and infographic cards.
- Camera sequence presets: reveal, orbit, detail, exploded and closing.
- Controlled animation chapters with timeline-free start/end states.
- Shareable read-only presentation link.

## Technical note

V1 uses Three.js ES modules from a pinned CDN version. Before a production-scale release, move dependencies into a normal Vite build so the bundle is versioned locally, tree-shaken and testable in CI.

## Immutable rollback artifact

```text
File: product-vis-v1-deploy.zip
SHA-256: 3063f91ec1fc7861b8a5093ff335e70b37c71981f5bd3412992ae30089631244
```

Keep this archive outside the V1.1 working tree. It is the deployable rollback point if the foundation preview fails parity checks.


---

## Archived source: `V1_1_CHANGELOG.md`

# V1.1 changelog

## Added

- Vite build and exact top-level npm dependency versions.
- Versioned local Draco and Basis/KTX2 decoder copy step that fails the build if required assets are missing.
- Modular renderer architecture.
- Serializable project state store.
- Layered product transform rig.
- Unit architecture tests and Playwright browser smoke tests.
- Self-contained GLB import fixture.
- V1.1 build marker and runtime diagnostics handle.
- Local-only development server binding.
- Explicit lockfile gate for the accepted deployment tag.
- Vercel build now runs the source/unit gate before bundling.

## Preserved

- Existing UI layout and visual styling.
- V1 look presets and post-processing values.
- Import, normalization, grounding, materials, camera, motion and export behavior.
- Original V1.0 stylesheet byte-for-byte.

## Hardened

- Vite pinned to the patched `7.3.5` line.
- Compatible Node engine range declared explicitly.
- Production source maps disabled.
- Reset now updates camera and motion state through the same controller path as direct UI input.
- Motion state notifications no longer emit duplicate transitions during model setup.

## Deferred

- Neutral HDR studio architecture.
- Geometry-aware contact shadows.
- Presentation camera safety.
- Material alpha/backface diagnostics.
- Simple/Advanced UI redesign.


---

## Archived source: `V1_1_VALIDATION.md`

# PRODUCT VIS V1.1 — Validation Report

**Checkpoint:** Foundation refactor  
**Visual target:** byte-preserve V1.0 UI and behavior while separating engine responsibilities.

## Automated checks completed in the build workspace

| Check | Result |
|---|---|
| JavaScript syntax check for every `.js` / `.mjs` source and test file | PASS |
| Node unit and architecture suite | PASS — 14/14 |
| Local module import targets resolve | PASS |
| Runtime source contains no Three.js CDN dependency | PASS |
| Pinned Three.js and Vite versions | PASS |
| UI layer imports no Three.js runtime objects | PASS |
| All DOM bindings exist in `index.html` | PASS |
| Duplicate HTML IDs | PASS — none |
| Development server bound to localhost only | PASS |
| Production source maps disabled | PASS |
| Vercel build gated by source tests | PASS |
| V1.0 stylesheet preservation | PASS — byte-identical |
| V1.0 body markup preservation | PASS — identical after replacing the module entry path |
| Self-contained glTF 2.0 smoke fixture | PASS — generated and structurally validated |

V1.0/V1.1 stylesheet SHA-256:

```text
0262bc43dcde4a5b7a4b39826144a75aafe335e3841ea4a555a882d5244c2d04
```

## Browser smoke suite included

The Playwright suite checks:

1. application boot and the V1.1 runtime marker;
2. absence of page/console errors and external runtime requests;
3. Look, Camera and Material control wiring;
4. deterministic Reset across engine, UI and central state;
5. picker import of `tests/fixtures/foundation-cube.glb`;
6. completion of import → normalize → ground → frame;
7. expected triangle, material and animation statistics;
8. repeated imports leave exactly one product session attached;
9. versioned local Draco and Basis decoder availability;
10. desktop Chromium and a mobile Chromium viewport;
11. mobile control-sheet open/close behavior.

Run after installing dependencies:

```bash
npm install
npx playwright install chromium
npm run check
npm run test:smoke
```

## Workspace limitation

The isolated build workspace used for this handoff cannot access the public npm registry, so it could not install the pinned browser/runtime dependencies, generate `package-lock.json`, or execute the Vite build and Playwright suite locally. The source-level and dependency-independent checks above passed. Generate and commit the lockfile during the first connected preview install. The browser smoke suite is included as the deployment gate and should be run immediately after the first preview build.

## Acceptance rule

Do not begin V1.2 until all Playwright projects pass against the Vercel preview and a real production GLB has been checked manually for:

- model import;
- material restoration;
- camera presets;
- animation playback when present;
- turntable;
- PNG export;
- mobile control panel;
- fullscreen return path.


---

## Archived source: `V1_2_CHANGELOG.md`

# PRODUCT VIS V1.2 — CHANGELOG

## Added

- `EnvironmentManager` for deterministic procedural PMREM/IBL.
- `BackdropManager` for an independent neutral visible field.
- `LightRig` for restrained neutral key, fill and rim definition.
- `GroundSystem` as the invisible `Y=0` ground contract.
- `ContactShadowRenderer` using product depth, render targets and separable blur.
- White, Light, Gray, Dark and Black backdrop stops.
- Continuous Black → White backdrop tone control.
- Automatic light/dark overlay contrast for viewport copy.
- Quality-dependent contact-shadow resolution, blur passes and dynamic refresh caps.
- Contact-shadow refresh before image export.
- Project state schema version `2`.
- Studio state and architecture unit tests.
- Browser smoke checks for backdrop/IBL independence and contact-shadow creation.

## Changed

- Removed the visible cyclorama and gradient background sphere.
- Removed the radial fake contact-shadow disc.
- Separated visible backdrop from material reflections and ambient illumination.
- Disabled native directional shadow maps in favor of the dedicated contact-shadow pass.
- Set bloom to zero for every neutral backdrop preset.
- Recalibrated default exposure and neutral light intensities.
- Tightened camera fit and camera preset framing.
- Replaced the old environment preset rail with neutral backdrop tones.
- Direct-render path now bypasses the post composer while bloom is zero.
- Contact-shadow framing now uses the real X/Z model footprint and accounts for raised products.
- Shadow rendering now restores renderer/scene state through `try/finally`.

## Preserved

- Drag-and-drop and file-picker GLB import.
- Draco, Meshopt and KTX2/Basis support.
- Original, Clay, Chrome and Matte treatments.
- Hero, Front, Side, Top and Detail cameras.
- Scale, vertical offset, center, ground, fit and 90-degree orientation controls.
- Embedded GLB animation playback and turntable motion.
- Viewport, landscape, square and portrait PNG export.
- Responsive desktop panel and mobile sheet.
- Procedural first-load demo object.
- Local-only model processing.

## Deferred

- Presentation/Inspect camera modes.
- Camera collision and minimum safe distance.
- Above-ground camera envelope.
- Per-material side and alpha diagnostics.
- Targeted backface and transparency repair.
- User-selectable HDRI library.
- Reflective floor and configurator systems.


---

## Archived source: `V1_2_VALIDATION.md`

# PRODUCT VIS V1.2 — VALIDATION REPORT

## Validation date

2026-08-07

## Completed in this environment

```text
JavaScript / MJS syntax checks          PASS
Unit + architecture tests              PASS — 20/20
Local JavaScript import resolution      PASS
DOM binding completeness                PASS
Unique HTML IDs                         PASS
No runtime Three.js CDN imports         PASS
Pinned dependency versions              PASS
No visible limbo code in StudioSystem   PASS
Environment/backdrop separation gate    PASS
Contact-shadow architecture gate        PASS
Contact-shadow axis/framing gate         PASS
Contact-shadow try/finally gate          PASS
Neutral preset independence gate         PASS
Bloom-free default gate                  PASS
Valid GLB 2.0 fixture header             PASS
Versioned decoder-path gate              PASS
Vercel test-before-build gate            PASS
```

## Unit suite

Command:

```bash
npm run test:unit
```

Result:

```text
20 tests
20 passed
0 failed
```

The suite checks:

- versioned serializable state;
- deterministic store revisions;
- backdrop tone ordering;
- identical lighting values across all backdrop stops;
- restrained V1.2 defaults;
- bounded contact-shadow quality budgets;
- modular studio boundaries;
- local import resolution;
- contact-shadow depth/blur/layer architecture;
- correct X/Z plane scaling;
- renderer-state restoration structure;
- Vercel and decoder build contracts.

## Included browser smoke coverage

`tests/smoke.spec.js` covers:

- boot to ready state;
- V1.2 build marker;
- core controls and reset path;
- environment UUID stability while switching White → Black;
- visible background remains a `Color`;
- no legacy cyclorama or background sphere;
- contact-shadow render target and texture exist;
- bloom remains zero;
- self-contained GLB import, grounding and framing;
- repeated-import lifecycle cleanup;
- local decoder asset responses;
- mobile control-sheet navigation.

## Environment limitations

This execution sandbox cannot reach the public npm registry, so it could not install the pinned Vite/Three.js/Playwright packages, generate `package-lock.json`, or execute the real Vite production build here.

A system Chromium binary is present, but its managed browser policy blocks local and external navigation, so the Playwright runtime screenshots could not be executed in this sandbox either.

These are environment limitations rather than silent test claims. The deploy archive includes the complete production build gate and browser smoke suite. Run the following on the first connected machine or Vercel preview:

```bash
npm install
npm run check
npx playwright install chromium
npm run test:smoke
```

## Required preview acceptance

After deployment, verify:

1. app boots with no console error;
2. demo object is centered and visibly grounded;
3. White, Gray and Black backdrops show no seam or stage geometry;
4. product reflections remain stable while background tone changes;
5. contact shadow follows the imported car footprint;
6. white paint retains highlight detail;
7. black materials retain rim separation;
8. object rotation and scale refresh the shadow;
9. exported PNG includes the current contact shadow;
10. mobile control sheet remains usable.

## Known next checkpoint

Backface/transparency repair and camera penetration are intentionally not claimed as fixed in V1.2. They are the protected scope of V1.3.


---

## Archived source: `V1_3_CHANGELOG.md`

# PRODUCT VIS V1.3 — CHANGELOG

## Added

- `presentation` and `inspect` camera modes.
- Presentation camera safety envelope.
- Minimum safe camera distance derived from product scale.
- Above-ground camera clamp for Presentation mode.
- Padded-bounds escape when the camera enters the product shell.
- Adaptive camera near/far clipping.
- `MaterialDiagnostics` runtime classifier.
- Object-panel material diagnostics card.
- Camera-panel safety diagnostics card.
- `Targeted backface repair` toggle.
- Side-aware override material variants for Clay / Chrome / Matte.
- Project schema version `3`.
- State fields for `camera.mode` and `model.backfaceRepairEnabled`.
- Architecture gate for V1.3 safety controls and diagnostics.

## Changed

- Camera limit updates now receive both radius and bounds.
- Hero / Fit logic now respects a minimum safe distance.
- Material presentation assignment is now centralized in `applyMaterialPresentation()`.
- Original materials restore side intent more deterministically.
- Override materials no longer assume one shared side behavior for every mesh.
- Model import now refreshes camera/material diagnostic UI.
- Reset flow now restores Presentation mode and disables backface repair.

## Preserved

- Neutral studio / backdrop separation from V1.2.
- Geometry-aware contact shadows.
- Drag-and-drop and file-picker GLB import.
- Draco, Meshopt and KTX2/Basis support.
- Original / Clay / Chrome / Matte treatments.
- Hero / Front / Side / Top / Detail camera presets.
- Scale / offset / center / ground / fit / rotate tools.
- Embedded GLB animation playback and turntable motion.
- Viewport / landscape / square / portrait PNG export.
- Responsive desktop and mobile control shell.
- Local-only model processing.

## Deferred

- Full camera collision against arbitrary mesh triangles.
- Per-material editing UI.
- Manual material list inspector.
- Preset migration / persistence UI.
- Simplified first-time-user quick dock.
- Saved looks and project serialization export.
- Configurator-specific systems.


---

## Archived source: `V1_3_VALIDATION.md`

# PRODUCT VIS V1.3 — VALIDATION REPORT

## Validation date

2026-08-08

## Completed in this environment

```text
JavaScript syntax checks                        PASS
Unit + architecture tests                       PASS — 21/21
Local JavaScript import resolution              PASS
DOM binding completeness                        PASS
Unique HTML IDs                                 PASS
Pinned dependency versions                      PASS
No runtime Three.js CDN imports                 PASS
V1.2 neutral studio architecture gates          PASS
V1.3 camera safety source gates                 PASS
V1.3 material diagnostics source gates          PASS
Versioned project schema gate                   PASS
Local-only Vercel build contract gate           PASS
Valid GLB 2.0 fixture header                    PASS
Versioned decoder-path gate                     PASS
```

## Command used here

```bash
cd /mnt/data/pv13
node --test tests/*.test.mjs
```

## Result

```text
21 tests
21 passed
0 failed
```

## What the suite now covers

### Existing protected coverage

- serializable and versioned project state;
- deterministic store revisions;
- backdrop ordering and neutral-light invariance;
- bounded contact-shadow budgets;
- module boundary presence;
- no CDN dependencies;
- import path resolution;
- DOM binding completeness;
- neutral studio UI shell contract;
- decoder path versioning;
- Vercel test-before-build gate.

### New V1.3 coverage

- package version `1.3.0`;
- presence of `MaterialDiagnostics.js`;
- presence of `inspectToggle` and `backfaceRepairToggle` UI controls;
- persisted `project.camera.mode` state;
- persisted `project.model.backfaceRepairEnabled` state;
- `CameraRig` safety methods (`enforceSafety`, `updateClipping`);
- `ProductSession` material presentation / repair flow;
- source-level material classification signals (`safeBackfaceCandidate`).

## Environment limitations

This sandbox validated the source tree and test suite, but it did **not** install npm dependencies from the public registry and did **not** execute a full Vite production build or Playwright browser run here.

That means the following still belong on the first connected machine or preview deployment:

```bash
npm install
npm run check
npx playwright install chromium
npm run test:smoke
npm run build
```

## Recommended manual preview checks

1. import the demo / cube and confirm Hero framing stays outside the mesh;
2. orbit aggressively in Presentation mode and confirm the camera cannot rest below the ground;
3. enable Inspect mode and confirm closer orbiting becomes possible;
4. import a thin-shell or alpha-cutout asset and confirm diagnostics reflect it;
5. toggle Targeted backface repair and compare Original vs Clay treatment;
6. import a vehicle / glass asset and confirm it reports glass without blanket double-siding;
7. export a frame and confirm framing matches the active viewport.

## Scope note

V1.3 introduces guardrails and diagnostics, not a full material authoring UI and not a physically exact camera collision solver. That remains intentionally out of scope for this checkpoint.


---

## Archived source: `V1_4_CHANGELOG.md`

# PRODUCT VIS V1.4 — CHANGELOG

## Added

- Compact bottom quick dock.
- White, Gray and Black quick backgrounds.
- Soft, Balanced and Contrast lighting presets.
- Independent backdrop and lighting tween channels.
- Dedicated `backdropPreset` and `lightingPreset` project state.
- Quick Turntable control synchronized with Advanced Motion.
- Responsive two-row quick dock for medium and mobile widths.
- Advanced footer actions for Reset and Help.
- Escape-key closing behavior for Advanced and Export.
- V1.4 source/architecture tests.
- Updated browser smoke coverage for the no-Advanced workflow.

## Changed

- Simplified top bar to identity, model status, Import and Export.
- Advanced panel is closed by default on every viewport.
- Default background changed from Light to Gray.
- Background presets no longer reapply lighting values.
- Lighting presets no longer reapply backdrop values.
- Advanced manual edits clear only the matching simple preset state.
- Mobile quick controls prioritize Hero, Front, Detail and Fit.
- Project schema advanced from `3` to `4`.
- Package version advanced to `1.4.0`.
- Runtime build marker changed to `v1.4-simple-ux`.

## Preserved

- Neutral PMREM / IBL.
- Independent visible backdrop.
- Geometry-aware cached contact shadows.
- Product normalization, grounding and transform controls.
- Presentation and Inspect camera safety.
- Adaptive clipping.
- Material diagnostics and targeted backface repair.
- Original, Clay, Chrome and Matte treatments.
- Embedded animations and configurable turntable speed.
- Local-only GLB processing.
- Image export formats and framing flow.

## Deferred to V1.5

- Environment rotation UI.
- Fill-light UI.
- Shadow opacity and softness UI.
- Camera target controls.
- Per-material diagnostic list and repair selection.
- Independent Advanced group reset buttons.
- Saved looks and project persistence.


---

## Archived source: `V1_4_VALIDATION.md`

# PRODUCT VIS V1.4 — VALIDATION REPORT

## Validation date

2026-08-08

## Source validation completed here

```text
JavaScript syntax checks                         PASS
Unit + architecture suite                        PASS — 23/23
Local JavaScript import resolution               PASS
DOM binding completeness                         PASS
Unique HTML IDs                                  PASS
Pinned dependency declarations                   PASS
No runtime Three.js CDN imports                  PASS
V1.2 studio architecture gates                   PASS
V1.3 camera/material safety source gates         PASS
V1.4 quick-path architecture gate                PASS
Backdrop / lighting state independence tests     PASS
Project schema version 4 gate                    PASS
Vercel test-before-build contract                PASS
```

Command:

```bash
node --test tests/*.test.mjs
```

Result:

```text
23 tests
23 passed
0 failed
```

## Static browser layout pass

The HTML and final CSS were rendered in headless Chromium with the module script intentionally removed. This validates layout only, not WebGL runtime behavior.

Checked viewport classes:

```text
1440 × 900   desktop simple dock
1440 × 900   desktop Advanced panel
1024 × 768   compact desktop dock
900 × 700    two-row medium dock
768 × 640    two-row tablet dock
390 × 844    mobile simple dock
390 × 844    mobile Advanced sheet
360 × 780    narrow mobile
320 × 640    minimum narrow mobile
```

Observed:

- no document-level horizontal overflow;
- desktop panel reaches its final right-side position;
- mobile panel reaches its final bottom-sheet position;
- 390 px shows background, lighting, Hero / Front / Detail / Fit, Turntable and Advanced;
- 320 px collapses lighting and Advanced labels without losing their buttons;
- quick dock is hidden while Advanced is open;
- top bar remains usable at mobile width.

## Environment limitation

The sandbox npm mirror returned `404` for the pinned `three`, `vite` and `@playwright/test` packages. Therefore this environment could not truthfully execute:

```bash
npm install
npm run build
npm run test:smoke
```

The source archive retains the complete Vite build gate and Playwright smoke suite. Run them on the first connected machine or Vercel preview:

```bash
npm install
npm run check
npx playwright install chromium
npm run test:smoke
```

## Required WebGL preview checks

1. demo model boots with Gray / Balanced / Hero active;
2. White → Black changes only the visible background;
3. Soft → Contrast changes lighting without moving the background;
4. quick Turntable and Advanced Turntable remain synchronized;
5. Fit and all desktop camera presets remain outside the product shell;
6. imported GLB diagnostics still populate in Advanced;
7. PNG export matches active framing;
8. Advanced opens and closes without changing the render;
9. mobile dock and bottom sheet remain touch-usable;
10. no console or network errors occur.


---

## Archived source: `V1_5_CHANGELOG.md`

# PRODUCT VIS V1.5 — CHANGELOG

## Added

- Environment rotation control.
- Fill-light control.
- Ground offset control.
- Contact-shadow opacity control.
- Contact-shadow softness control.
- Normalized Camera Target X / height / Z controls.
- Persistent camera target state.
- Live group preset/custom indicators.
- Independent Reset Look, Reset Object, Reset Camera and Reset Motion actions.
- Deterministic `MotionController.reset()`.
- Explicit per-material Auto / Original / Front / Back / Double side policy.
- Serializable material-side override state.
- Stable material diagnostic IDs.
- Front, back and double-sided Clay / Chrome / Matte variants.
- Responsive material-policy list.
- V1.5 architecture and material diagnostic unit coverage.
- V1.5 group-reset browser smoke flow.

## Changed

- Advanced is organized as four resettable state groups.
- Camera presets now own normalized target data.
- Normalized camera targets follow product-bound changes without composition drift.
- Free orbit, Fit and manual target edits clear the active camera preset.
- Presentation / Inspect safety now also constrains the target envelope.
- Object rotation is formalized in project state.
- Contact-shadow ground position is independently adjustable.
- Material diagnostics are shown before the lower-priority model report.
- Global Reset now composes the same four group resets.
- Quality changes participate in Look custom-state reporting.
- Project schema advanced from `4` to `5`.
- Package version advanced to `1.5.0`.
- Runtime build marker changed to `v1.5-advanced-controls`.

## Preserved

- V1.4 quick-dock DOM and simple workflow.
- Advanced closed-by-default behavior.
- Independent backdrop and lighting preset channels.
- Neutral PMREM / IBL.
- Independent visible backdrop.
- Geometry-aware cached contact shadows.
- Product normalization and grounding.
- Presentation / Inspect camera safety.
- Adaptive clipping.
- Candidate-only automatic backface repair.
- Original / Clay / Chrome / Matte treatments.
- Embedded GLB animations and turntable.
- Local-only GLB processing.
- Image export formats and framing flow.

## Deferred to V1.6

- `.productvis` project save/load.
- Schema migration UI.
- Saved looks.
- Exact viewport/export parity verification.
- Dedicated offscreen export target.
- Optional recent local projects.
- Configurator-specific variants, hotspots and sequences.


---

## Archived source: `V1_5_VALIDATION.md`

# PRODUCT VIS V1.5 — VALIDATION REPORT

## Validation date

2026-08-08

## Source validation completed here

```text
JavaScript syntax checks                         PASS
Unit + architecture suite                        PASS — 27/27
Local JavaScript import resolution               PASS
DOM binding completeness                         PASS
Unique HTML IDs                                  PASS
Pinned dependency declarations                   PASS
No runtime Three.js CDN imports                  PASS
V1.2 studio architecture gates                   PASS
V1.3 camera/material safety source gates         PASS
V1.4 quick-path preservation gate                PASS
V1.5 Advanced state/reset architecture gate      PASS
Material classification unit coverage            PASS
Project schema version 5 gate                    PASS
Vercel test-before-build contract                PASS
```

Command:

```bash
npm run test:unit
```

Result:

```text
27 tests
27 passed
0 failed
```

## Added V1.5 test coverage

The source suite now checks:

- package version `1.5.0`;
- schema version `5`;
- normalized camera-target defaults;
- default ground offset;
- serializable material-side override state;
- environment rotation and fill controls;
- ground, shadow opacity and shadow softness controls;
- all four independent reset actions;
- CameraRig target APIs and orbit-state callback;
- MotionController deterministic reset;
- explicit material-side override paths;
- stable material diagnostic IDs;
- thin-shell candidacy;
- glass exclusion from blanket repair;
- front / back / double numeric side labeling.

## Static browser layout pass

The final HTML and CSS were rendered with headless Chromium using `page.set_content()`. The module script was deliberately removed, so this validates layout and responsive geometry rather than WebGL runtime behavior.

Checked closed quick-path widths:

```text
320 × 700
390 × 844
768 × 900
1024 × 768
1440 × 900
```

Checked all four open Advanced pages at every width:

```text
Look / Object / Camera / Motion × 5 widths = 20 checks
```

Observed:

- zero document-level horizontal overflow;
- zero Advanced panel/page horizontal overflow;
- 320 px quick dock remains inside the viewport;
- desktop Advanced reaches its final 340 px right-side position;
- mobile Advanced reaches its final bottom-sheet position;
- quick dock is hidden while Advanced is open;
- material rows collapse to one column at the narrowest width;
- the five camera cards remain usable on mobile;
- group reset bars remain visible at the top of each Advanced page.

A structural comparison also confirmed that the V1.4 quick-dock DOM was retained unchanged.

## Browser smoke coverage prepared

`tests/smoke.spec.js` now includes a V1.5 flow that:

1. opens Advanced;
2. changes Look, Object, Camera and Motion state;
3. verifies each group becomes custom;
4. resets Camera independently without altering Object or Motion;
5. resets the remaining groups;
6. verifies the final project state returns to defaults.

## Environment limitation

The sandbox npm mirror returned `404` for the pinned `three@0.185.1` package. Therefore this environment could not truthfully execute the Vite/WebGL production build or the repository Playwright suite with installed npm dependencies.

The source archive retains the full gates. Run these on the first connected machine or Vercel preview:

```bash
npm install
npm run check
npx playwright install chromium
npm run test:smoke
```

## Required WebGL preview checks

1. demo model boots with Gray / Balanced / Hero active;
2. opening and closing Advanced does not change the frame;
3. environment rotation visibly rotates material reflections;
4. fill control changes shadow-side readability without moving the backdrop;
5. ground offset, shadow opacity and softness update the contact shadow;
6. all four group resets restore both values and image state;
7. an imported thin-shell asset exposes a safe repair candidate;
8. an imported glass asset is reported but not automatically double-sided;
9. explicit side policy remains active after switching to Clay / Chrome / Matte;
10. normalized camera target remains useful on wide, tall and tiny products;
11. Reset Camera returns to Hero without changing Look or Object;
12. Reset Motion rewinds the selected animation and removes accumulated turntable rotation;
13. exported PNG matches the active camera and studio state;
14. no console or external-network errors occur.


---

## Archived source: `V1_6_CHANGELOG.md`

# PRODUCT VIS V1.6 — CHANGELOG

## Added

- Binary `.productvis` project container.
- Raw embedded GLB payload without base64 inflation.
- Project magic/version/header validation.
- Sequential schema migration and state sanitization.
- Project metadata with stable ID, title and timestamps.
- Exact camera pose serialization relative to product bounds.
- Model X/Z position persistence.
- Animation time persistence.
- Turntable angle persistence.
- Saved-look library backed by localStorage.
- Embedded saved looks inside project files.
- Recent local project cache backed by IndexedDB.
- Project Save / Open menu.
- Dirty, saved and migrated project-status labels.
- `Ctrl/⌘ + S` and `Ctrl/⌘ + O` shortcuts.
- Match / Fill export framing modes.
- Pure export frame-plan module.
- Isolated offscreen WebGL export.
- GPU texture-limit fallback that preserves crop proportions.
- Portable-project browser smoke coverage.
- Saved-look and framing browser smoke coverage.
- Persistence, migration, codec and export unit tests.

## Changed

- Project schema upgraded from `5` to `6`.
- Export no longer resizes the live renderer or interactive canvas.
- Renderer no longer requires `preserveDrawingBuffer`.
- Camera state now includes a normalized exact pose.
- Object transform state now includes X/Z position.
- Motion state now includes clip time and accumulated turntable angle.
- Reset/custom-state detection includes V1.6 state fields.
- Drop overlay now accepts `.productvis` as well as `.glb`.
- Help copy documents project save/open shortcuts.
- Project opening creates an ID for migrated legacy projects that lack one.
- Oversized Fill intermediates now scale to the device GPU limit instead of failing.

## Preserved

- V1.4 child-proof quick dock.
- Advanced closed by default.
- V1.5 independent Advanced group resets.
- Neutral environment/backdrop separation.
- Geometry-aware cached contact shadows.
- Camera Presentation / Inspect safety modes.
- Material diagnostics and targeted side repair.
- Original / Clay / Chrome / Matte treatments.
- Embedded GLB animation playback and turntable motion.
- Draco, Meshopt and KTX2/Basis support.
- Local-only product processing.
- Vercel test-before-build gate.

## Deferred to V2

- Product variants and configurator state graphs.
- Part visibility and exploded assemblies.
- Hotspots, infographics and anchored callouts.
- Controlled camera/animation chapters.
- Branded presentation mode.
- Network sharing and read-only scene links.
- AR handoff.


---

## Archived source: `V1_6_VALIDATION.md`

# PRODUCT VIS V1.6 — VALIDATION REPORT

## Validation date

2026-08-08

## Completed in this environment

```text
JavaScript / MJS syntax checks                  PASS
Unit + architecture tests                       PASS — 39/39
Local JavaScript import resolution              PASS
DOM binding completeness                        PASS
Unique HTML IDs                                 PASS
No runtime Three.js CDN imports                 PASS
Pinned dependency versions                      PASS
V1.1–V1.5 protected architecture gates          PASS
Binary project codec round-trip                 PASS
Actual GLB fixture byte-for-byte round-trip      PASS
Schema V3 → V6 migration                        PASS
Unsafe state sanitization                       PASS
Corrupt/truncated project rejection              PASS
Saved-look isolation                            PASS
Match framing math                              PASS
Fill framing math                               PASS
GPU texture-limit framing fallback               PASS
Offscreen export isolation source gate           PASS
No stale V1.5 runtime/build markers              PASS
Vercel test-before-build gate                    PASS
```

## Source suite

Command:

```bash
npm run test:unit
```

Result:

```text
39 tests
39 passed
0 failed
```

The suite covers:

- project-state serialization and store revisions;
- neutral studio invariants;
- material diagnostics;
- all protected module boundaries;
- `.productvis` binary encode/decode;
- legacy project migration;
- corrupt-file rejection;
- saved-look isolation;
- exact Match / Fill framing plans;
- GPU-safe scaled frame plans;
- DOM and local-import completeness;
- versioned decoder paths;
- Vercel build contracts.

## Actual fixture codec check

The included `foundation-cube.glb` was encoded into a `.productvis` Blob and decoded again directly with the production codec.

```text
Magic                 PVISPRJ1
Source GLB bytes      1620
Decoded GLB bytes     1620
Byte equality         PASS
Decoded schema        6
```

## Browser smoke coverage included

`tests/smoke.spec.js` now includes source coverage for:

- V1.6 build marker;
- simple quick-dock path;
- independent Advanced resets;
- GLB import lifecycle;
- portable-project download;
- project reopen from the downloaded file;
- embedded GLB restoration;
- object transform restoration;
- camera preset restoration;
- turntable state and angle restoration;
- export framing restoration;
- saved-look create/apply behavior;
- Match / Fill UI state;
- local decoder availability;
- mobile Advanced sheet navigation.

## Build/runtime limitation in this sandbox

The production build was attempted:

```bash
npm run build
```

It could not start because `vite` is not installed in this sandbox.

Dependency installation was then attempted:

```bash
npm install --ignore-scripts --no-audit --no-fund
```

The internal package mirror returned `404` for the pinned `@playwright/test@1.62.0` package. Therefore this report does **not** claim a completed Vite production build, WebGL browser render or Playwright run in this environment.

This is an environment limitation, not a silent pass.

Run the complete connected gate on the first development machine or Vercel preview:

```bash
npm install
npm run check
npx playwright install chromium
npm run test:smoke
```

## Required preview acceptance

1. import the included fixture and a real production GLB;
2. create a non-default look, transform, camera pose and motion state;
3. save `.productvis` and verify it downloads;
4. reload the page and open the saved project;
5. verify the embedded product and complete state restore;
6. verify recent projects appear when IndexedDB is available;
7. export square and portrait in Match;
8. export square and portrait in Fill;
9. verify the live viewport does not jump or resize during export;
10. compare viewport and export framing visually;
11. test on a mobile GPU with a 4096 px texture limit;
12. verify repeat project opening leaves one Product Session Root.


---

## Archived source: `V1_8_CHANGELOG.md`

# PRODUCT VIS V1.8 — CHANGELOG

## Release title

**Configurator Authoring**

## Added — Commercial variants

- Advanced → Variants workspace.
- Deterministic variant-group grammar.
- Required and optional option groups.
- One active option per group.
- Default option assignment.
- Part-targeted color and material appearance changes.
- Part-targeted visibility changes.
- Original-material-based variant instances.
- Variant material lifecycle disposal.
- Ordered group resolution.
- Property-level conflict reporting.
- Saved named configurations.
- Optional viewport product-option tray.
- Variant preview persistence.
- Variant state migration and sanitization.
- Variant unit and architecture tests.

## Added — Anchored infographics

- Advanced → Info workspace.
- Product-anchor selection.
- Eyebrow, title, body, accent and side authoring.
- Off / Selected / All infographic display.
- Card visibility and selection.
- Camera-facing DOM cards.
- Automatic left/right layout.
- Same-side vertical collision separation.
- Viewport-bound card clamping.
- Regenerated cubic SVG connector paths.
- Unresolved-anchor reporting.
- Infographic state migration and sanitization.
- Infographic unit and architecture tests.
- Browser smoke flow for authoring a card from a product-local anchor.

## Added — Presentation states

- Reusable named static-shot states.
- Studio/look recall.
- Object transform and material-safety recall.
- Exact camera/lens/target/pose recall.
- Manual part-visibility recall.
- Variant-selection and active-configuration recall.
- Viewport option-tray recall.
- Infographic display and selection recall.
- Render quality and export-framing recall.
- Explicit motion-state exclusion.
- Maximum 32 presentation states.
- Legacy presentation-state alias migration.
- Presentation-state support-report counts.
- Presentation unit, persistence and architecture tests.

## Added — State

Project schema version `8`.

```js
configurator: {
  partVisibility: {},
  states: [],
  activeStateId: null,
  anchors: [],
  anchorDisplay: 'off',
  selectedAnchorId: null,

  variantGroups: [],
  variantSelections: {},
  configurations: [],
  activeConfigurationId: null,
  variantPreviewEnabled: false,

  infographics: [],
  infographicDisplay: 'off',
  selectedInfographicId: null,

  presentations: [],
  activePresentationId: null
}
```

## Changed

- Advanced navigation now includes Variants and Info.
- ProductSession now composes manual and variant visibility separately.
- ProductSession now creates and disposes part-targeted material instances.
- Configurator project capture now merges structure, variants, infographics and presentations.
- `.productvis` round-trip now preserves viewport preview, infographic and presentation state.
- Support reports now include safe counts for groups, selections, configurations, cards and presentation states.
- Group status indicators now report Variants and Info activity.
- Reset Variants restores defaults and disables the viewport tray.
- Reset Info clears infographics and presentation states while preserving product anchors.
- Browser smoke coverage now verifies that applying a presentation leaves motion unchanged.
- README and help copy now describe the first configurator-authoring layer.

## Export boundary

- Variant appearance and visibility are part of the WebGL product and export normally.
- Infographic cards and connector paths are DOM overlays and are excluded from clean PNG exports.
- Existing part-selection and anchor editor helpers remain export-safe.

## Preserved

- Child-proof quick dock.
- V1.2 neutral studio and geometry-aware contact shadow.
- V1.3 camera/material safety.
- V1.5 granular Advanced controls and deterministic resets.
- V1.6 binary `.productvis` persistence and reliable offscreen export.
- V1.7 model preflight, adaptive runtime and local recovery.
- V1.7 deterministic part registry, visibility states and product-local anchors.
- Raw embedded GLB byte preservation.
- Saved looks and recent local projects.
- Local-only model processing.

## Deferred

- Transform variants and exploded-view authoring.
- Ray-picked or draggable anchor positions.
- Controlled animation chapters.
- Camera sequences and transition timing.
- Timeline editing.
- Branded read-only presentation mode.
- Infographic compositing into final branded exports.
- Hosted scene sharing and AR handoff.


---

## Archived source: `V1_8_VALIDATION.md`

# PRODUCT VIS V1.8 — VALIDATION REPORT

## Validation date

2026-08-09

## Release

```text
Product VIS version       1.8.0
Project schema            8
Build marker              v1.8-configurator-authoring
Release title             Configurator Authoring
```

---

## Completed in this environment

```text
JavaScript / MJS syntax checks                   PASS
Unit + architecture tests                        PASS — 68/68
Local JavaScript import resolution               PASS
Required module-boundary gate                    PASS
DOM binding completeness                         PASS
Unique HTML IDs                                  PASS
No runtime Three.js CDN imports                  PASS
Pinned dependency versions                       PASS
Quick-dock preservation gate                     PASS
V1.2 neutral studio gates                        PASS
V1.3 camera/material safety gates                PASS
V1.4 simple-path gates                           PASS
V1.5 Advanced/reset gates                        PASS
V1.6 persistence/export gates                    PASS
V1.7 production-readiness gates                  PASS
V1.7 product-structure gates                     PASS
V1.8 variant architecture gates                  PASS
V1.8 infographic architecture gates              PASS
V1.8 presentation-state architecture gates       PASS
Binary .productvis round trip                     PASS
Schema V3 → V8 migration                         PASS
Raw GLB byte equality                             PASS
Variant/configuration state round trip            PASS
Infographic state round trip                      PASS
Variant-preview state round trip                  PASS
Presentation-state round trip                     PASS
Presentation motion-exclusion contract            PASS
Export-helper separation                          PASS
Vercel test-before-build contract                 PASS
```

---

## Source test command

```bash
cd /tmp/productvis_v18_work
npm run test:unit
```

Result:

```text
68 tests
68 passed
0 failed
```

---

## Test coverage

### Existing protected contracts

- serializable versioned project state;
- deterministic store revisions;
- neutral backdrop / lighting separation;
- geometry-aware contact shadow;
- camera safety and adaptive clipping;
- material diagnostics and side repair;
- child-proof simple path;
- deterministic Advanced resets;
- binary project codec and raw GLB bytes;
- Match / Fill export mathematics;
- GPU-limit export fallback;
- preflight, adaptive quality and recovery;
- deterministic part IDs;
- authored visibility and hierarchy search;
- product-local anchors;
- editor-helper export safety.

### Variant contracts

- color and appearance sanitization;
- invalid target removal;
- required-group default fallback;
- optional selection clearing;
- mutually exclusive selection per group;
- ordered group resolution;
- descendant target expansion;
- property-level conflict reporting;
- saved configuration capture / apply / delete;
- stable serializable variant state;
- viewport option tray remains outside the quick dock.

### Infographic contracts

- bounded content and unique IDs;
- Off / Selected / All display modes;
- product-anchor references;
- unresolved-anchor reporting;
- create / update / visibility / delete behavior;
- deterministic same-side card separation;
- viewport clamping;
- deterministic SVG connector generation;
- DOM overlay remains separate from FrameExporter.

### Presentation-state contracts

- static studio, object, camera, configurator and render snapshot;
- explicit absence of motion in snapshots;
- 32-state limit;
- duplicate-ID repair;
- unsafe-value clamping;
- create / apply / delete lifecycle;
- legacy alias support;
- `.productvis` binary round trip;
- application wiring preserves live motion;
- presentation controls remain outside the quick dock.

---

## Browser smoke coverage included in the repository

`tests/smoke.spec.js` includes coverage for:

- boot and V1.8 build marker;
- simple quick controls;
- Advanced navigation;
- GLB import and repeated import cleanup;
- neutral studio and camera/material safety;
- `.productvis` save/open restoration;
- saved looks and export framing;
- model health and runtime controls;
- part selection, visibility states and anchors;
- variant-group and option authoring;
- viewport option-tray activation;
- infographic authoring from an anchor;
- visible camera-facing card;
- presentation-state capture;
- presentation application with unchanged motion;
- canonical configurator state assertions.

---

## Final archive integrity

The packaged source tree was extracted into a separate clean directory and validated again from the extracted files.

```text
Packaged files                              103
Manifest entries                            102
Manifest verification                       PASS
Extracted JavaScript / MJS syntax            PASS
Extracted unit + architecture tests          PASS — 68/68
Extracted HTML IDs                           PASS — 254 unique
Extracted DOM bindings                       PASS — 253 complete
Extracted build marker                       PASS
```

The manifest intentionally excludes only `docs/V1_8_MANIFEST.sha256` itself.
The external ZIP checksum is supplied as a companion `.zip.sha256` artifact.

---

## Connected-build attempt and limitation

A real dependency installation was attempted:

```bash
npm install --ignore-scripts --no-audit --no-fund
```

The sandbox package mirror returned:

```text
404 Not Found — @playwright/test@1.62.0
```

No `node_modules` or `package-lock.json` was produced. Therefore a genuine Vite production bundle and Chromium/WebGL smoke run are **not** claimed in this environment.

Run the complete connected gate on a normal internet-connected machine or Vercel preview:

```bash
npm install
npm run check
npx playwright install chromium
npm run test:smoke
```

Source tests do not substitute for a browser/GPU acceptance pass. The final archive retains this complete gate.

---

## Required manual V1.8 preview checks

### Variants

1. Import a GLB with multiple named parts.
2. Select a part in Parts.
3. Create a required Finish group.
4. Create at least two color/finish options.
5. Switch options from Advanced and the viewport tray.
6. Create a second group that overlaps one property and verify conflict reporting.
7. Save and apply a named configuration.
8. Save, close and reopen the `.productvis` file.

### Infographics

1. Create three product anchors at different heights.
2. Create three infographic cards.
3. Test Left, Right and Auto side behavior.
4. Orbit, zoom and switch camera presets.
5. Test Off / Selected / All.
6. Hide or invalidate a referenced part and verify recoverable unresolved reporting.
7. Export PNG and confirm no cards or connector lines enter the clean render.

### Presentation states

1. Set a custom look, lens and camera position.
2. Choose a variant configuration.
3. Display one infographic.
4. Start or scrub an embedded animation / turntable.
5. Save a presentation state.
6. Change the shot and apply the state.
7. Confirm the static image returns while motion time and turntable angle remain unchanged.
8. Save and reopen the project and repeat.

### Responsive behavior

1. Verify the viewport tray at mobile, tablet and desktop widths.
2. Verify infographic card separation and clipping.
3. Verify Advanced Variants and Info remain scrollable without document overflow.
4. Confirm the quick dock remains unchanged and accessible.

---

## Scope note

V1.8 validates configurator authoring, not a complete public-facing product story player. Transform variants, exploded views, chapters, camera sequences, branded composition and hosted sharing remain intentionally separate future layers.


---

## Archived source: `V1_9_CHANGELOG.md`

# PRODUCT VIS V1.9 — CHANGELOG

## Added

- Advanced → Stories workspace.
- Product-local exploded part offsets.
- Automatic radial and explicit ±X / ±Y / ±Z explode directions.
- Named assembled / exploded state library.
- Animation chapters referencing bounded ranges of embedded GLB clips.
- Chapter speed, loop and end-pose hold controls.
- Ordered story library with reusable step references.
- Story-step camera transition duration and easing.
- Story-step hold duration.
- Story-step infographic display override.
- Optional viewport story transport.
- Previous, Play/Pause/Resume, Next and Stop controls.
- Story phase and current-step readout.
- `StoryGrammar` pure state/sanitization module.
- `StorySystem` authoring module.
- `StoryPlayer` deterministic phase controller.
- `ProductExplosion` Three.js runtime module.
- Project schema version `9`.
- V8 → V9 project migration.
- V1.9 story counts in local support reports.
- Story authoring, migration and playback unit tests.
- V1.9 browser smoke authoring scenario.

## Changed

- Product animation frame order now removes exploded offsets before mixer evaluation and reapplies them afterward.
- Product bounds and contact-shadow framing refresh during exploded transitions.
- CameraRig now supports interpolated saved poses, focal length and up vectors.
- Camera endpoints track live product bounds during exploded transitions.
- Camera and exploded transitions support pause, resume and cancellation.
- Story pause now freezes camera, explosion and chapter playback together.
- Manual Previous / Next / Stop cancels abandoned transitions before applying another step.
- MotionController now supports bounded chapter playback and completion callbacks.
- Presentation states expose direct ID lookup for story references.
- `.productvis` sanitization now includes explosion, chapter and story state.
- Global reset now includes the deterministic Stories reset.
- Mobile Advanced navigation now accommodates nine workspaces without compressing labels.
- Product page metadata and Help copy now describe controlled stories.
- Package version is now `1.9.0`.
- Runtime build marker is now `v1.9-controlled-product-stories`.

## Preserved

- Child-proof simple quick dock.
- Drag-and-drop and file-picker GLB import.
- Neutral studio, IBL and geometry-aware contact shadows.
- Presentation / Inspect camera safety.
- Material diagnostics and targeted side repair.
- Granular Advanced Look, Object, Camera and Motion controls.
- Portable binary `.productvis` projects with raw embedded GLB bytes.
- Saved looks, recent projects and recovery drafts.
- Match / Fill offscreen PNG export.
- Model preflight and adaptive runtime quality.
- Deterministic part structure, visibility states and anchors.
- Commercial variant groups and configurations.
- Camera-facing anchored infographics.
- Static presentation states that exclude motion.
- Local-only processing.

## Explicitly not added

- Timeline editor.
- Arbitrary keyframes.
- Audio/video tracks.
- Freeform curve editor.
- Spline camera paths.
- Server persistence.
- Hosted collaboration.
- Automatic infographic compositing into clean PNG output.


---

## Archived source: `V1_9_VALIDATION.md`

# PRODUCT VIS V1.9 — VALIDATION REPORT

## Validation date

2026-08-09

## Source validation completed in this environment

```text
Product VIS version                         1.9.0
Project schema                              9
Build marker                                v1.9-controlled-product-stories
JavaScript / MJS syntax                     PASS
Unit + architecture tests                   PASS — 77/77
Local JavaScript import resolution          PASS
DOM binding completeness                    PASS
Unique HTML IDs                             PASS
No runtime Three.js CDN dependency          PASS
Pinned dependency versions                  PASS
V1.1–V1.8 protected architecture gates      PASS
V1.9 no-timeline architecture gate          PASS
V1.9 story grammar tests                    PASS
V1.9 transition pause/resume callbacks       PASS
V3 → V9 project migration                   PASS
Binary .productvis round-trip               PASS
Raw GLB byte equality                       PASS
Clean-export helper separation              PASS
```

## Commands completed

```bash
find src tests -type f \( -name '*.js' -o -name '*.mjs' \) -print0 \
  | xargs -0 -n1 node --check

npm run test:unit
```

Result:

```text
77 tests
77 passed
0 failed
```

## New V1.9 test coverage

### State grammar

- invalid part IDs are rejected;
- explode vectors are clamped;
- zero vectors are omitted from live offsets;
- empty assembled states remain valid;
- chapter, story and step libraries respect fixed budgets;
- duplicate IDs are de-duplicated;
- invalid easing and infographic modes fall back safely.

### Reference integrity

- missing presentation references are reported;
- missing exploded-state references are reported;
- missing chapter references are reported;
- missing infographic references are reported;
- unresolved steps are preserved rather than deleted.

### Playback

- transition → chapter → hold progression;
- chapter completion handoff;
- non-looping story completion;
- story loop navigation;
- phase timing across pause/resume;
- pause/resume transition callbacks;
- manual Previous / Next behavior;
- bounded StorySystem CRUD and reordering.

### Persistence

- schema V3 → V9 migration;
- V8 aliases migrate to canonical V1.9 state;
- exploded offsets and named states round-trip;
- chapters round-trip;
- stories and ordered steps round-trip;
- original embedded GLB remains byte-identical.

### Architecture

- StoryGrammar, StorySystem, StoryPlayer and ProductExplosion module boundaries exist;
- Stories is outside the protected quick dock;
- no Timeline panel or timeline DOM contract is introduced;
- camera transition endpoint metadata exists;
- camera and explosion pause/resume hooks exist;
- clean FrameExporter does not reference story transport or authoring UI.

## Browser smoke coverage included in the package

The Playwright suite now contains a V1.9 scenario that:

1. opens Advanced → Stories;
2. selects a deterministic product part;
3. authors an exploded offset;
4. saves an exploded state;
5. creates a story;
6. creates one directed step;
7. enables viewport transport;
8. plays transition and hold;
9. verifies the story returns to Ready;
10. verifies schema-9 project state.

It also retains all previous renderer, import, persistence, variant, infographic, presentation, Parts and Health smoke scenarios.

## Dependency/build limitation

The source tree contains no installed `node_modules` by design.

A dependency installation was attempted through the sandbox npm mirror. The mirror returned:

```text
404 Not Found — three@0.185.1
```

A direct public-registry attempt timed out in this environment. Therefore this report does **not** claim:

- a completed Vite production bundle;
- a live Three.js/WebGL render session;
- an executed Node Playwright smoke suite;
- GPU screenshots.

These remain connected-machine / Vercel-preview gates:

```bash
npm install
npm run check
npx playwright install chromium
npm run test:smoke
```

## Required connected-preview acceptance

### Exploded product

1. import a multi-part GLB;
2. offset nested parts in Auto and explicit axis directions;
3. save Assembled and Exploded states;
4. animate between states;
5. confirm no cumulative transform drift;
6. confirm contact shadow and camera safety follow expanded bounds.

### Animation chapters

1. import a GLB with embedded animation;
2. create a bounded non-looping chapter;
3. verify start and end frames;
4. verify speed;
5. verify end-pose hold ON and OFF;
6. verify a looping chapter requires manual Next or Stop.

### Story director

1. build at least three steps;
2. combine saved shots, explosion, chapter and infographics;
3. pause halfway through a camera/explosion transition;
4. confirm every moving layer freezes;
5. resume and confirm no timing jump;
6. press Next midway through another transition;
7. confirm the abandoned transition does not leak into the next step;
8. test story loop and final completion.

### Persistence and export

1. save the authored story to `.productvis`;
2. reopen it in a fresh tab;
3. verify libraries, ordering and selected step;
4. play the reopened story;
5. export Match and Fill frames;
6. confirm story transport and authoring helpers are absent from PNG output.

## Independent archive validation

A release ZIP was created, extracted into a separate clean directory and validated against the extracted files rather than the working tree.

```text
Packaged files                              112
Manifest entries                            111
Manifest verification                       PASS — 111/111
Extracted JavaScript / MJS syntax            PASS
Extracted unit + architecture tests          PASS — 77/77
HTML IDs                                     PASS — 317 unique
DOM bindings                                 PASS — 316/316
Missing DOM bindings                         0
Duplicate HTML IDs                           0
CSS parse                                    PASS — 608 rules / 0 errors
Build marker                                 PASS
Timeline panel                               ABSENT
```

The manifest intentionally excludes only its own `docs/V1_9_MANIFEST.sha256` file, avoiding a circular self-hash. Every other packaged file is covered.
