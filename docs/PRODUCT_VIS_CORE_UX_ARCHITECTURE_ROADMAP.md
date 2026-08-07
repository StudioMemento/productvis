# PRODUCT VIS — Core Objective, UX Direction & Safe Architecture Roadmap

**Document type:** pre-implementation analysis and technical handoff  
**Date:** 2026-08-07  
**Current baseline:** PRODUCT VIS V1 deployed at `productvis.vercel.app`  
**Purpose:** define the product, rendering architecture, interface direction, checkpoints, and implementation sequence before adding more features.

---

## 0. Executive decision

The demo already proves the idea.

A user can import a GLB, see it immediately, change its presentation, move the camera, and export an image. That core loop is valid and worth protecting.

The next step should **not** be another feature pass on top of the current single-file architecture. The safe route is:

1. Freeze the current demo as a permanent stable baseline.
2. Refactor the engine without changing its visible behavior.
3. Replace the visible cyclorama with a proper studio system made of three independent layers:
   - image-based lighting / HDR environment;
   - neutral background shade;
   - invisible ground and contact shadow.
4. Fix camera penetration and material-side/transparency handling.
5. Simplify the default interface.
6. Add advanced controls only after the simple path is stable.
7. Add configurator, infographics, and controlled motion as isolated modules later.

The main lesson from VisualRef is that **a working core must remain frozen while complexity grows around it**. PRODUCT VIS should evolve through small deployable checkpoints, not through large mixed rebuilds.

---

# 1. Core objective

## 1.1 Product promise

> **Drop a GLB and obtain a clean, grounded, premium product shot in less than a minute, without needing to understand a traditional 3D application.**

The product is not primarily a viewer. It is a **presentation engine**.

The imported object is always the hero. Every interaction should improve one of four things:

- how the product is lit;
- how it sits in the frame;
- how it is visually understood;
- how the final visual is exported or presented.

## 1.2 Core loop

```text
IMPORT GLB
    ↓
VALIDATE + NORMALIZE
    ↓
CENTER + GROUND + FRAME
    ↓
APPLY CALIBRATED STUDIO LOOK
    ↓
CHOOSE CAMERA / BACKGROUND
    ↓
EXPORT OR PRESENT
```

The application should feel successful immediately after import. The user should not need to correct the scene before seeing a useful image.

## 1.3 Product success criteria

The core is successful when:

- an unknown but valid GLB loads without manual scene setup;
- the object is correctly centered, grounded, and framed;
- the original PBR materials remain recognizable;
- white, black, metallic, transparent, and emissive products remain readable;
- the default camera cannot accidentally enter the model or go beneath the floor;
- the default image looks intentional without touching advanced controls;
- export matches the viewport;
- the simple workflow remains understandable on desktop and mobile.

## 1.4 Explicit non-goals for the core

PRODUCT VIS should not become:

- Blender in a browser;
- a scene hierarchy editor;
- a node-based material editor;
- a freeform animation package;
- a full timeline editor;
- a multi-object DCC scene builder;
- a place where every Three.js parameter is exposed to the user.

Those exclusions are important. The value is not maximum control. The value is **maximum visual quality per decision**.

---

# 2. What the current V1 already proves

## 2.1 Strong foundation

The current demo already has several good decisions:

- the GLB stays local;
- import and export are immediately visible;
- automatic normalization and camera fitting already exist;
- original materials are preserved before optional overrides;
- the UI separates Look, Object, Camera, and Motion;
- the viewport remains the dominant part of the screen;
- quality modes, animation playback, turntable motion, and responsive controls are already functional;
- the visual identity is coherent with PRODUCT VIS: black UI, white hierarchy, restrained orange accent.

This is a strong V1. It should be preserved as the reference point, not treated as disposable prototype code.

## 2.2 Current technical reality

The deployed V1 is intentionally compact, but it is already near the limit of a safe single-file structure:

- `app.js`: approximately 1,841 lines and 73 top-level functions;
- `styles.css`: approximately 2,173 lines;
- the UI writes directly into renderer, scene, camera, material, and state values;
- each look preset simultaneously changes background, floor, lighting, exposure, bloom, and shadow;
- most render systems share the same global state and lifecycle.

That is acceptable for a demo. It becomes fragile when adding HDRI management, material repair, hotspots, saved projects, configurator states, and controlled animation.

The next milestone therefore needs to be a **behavior-preserving architecture pass**, not a visual rebuild.

---

# 3. Current visual and rendering audit

## 3.1 The visible limbo is the main visual conflict

The large cyclorama and gradient sphere currently compete with the imported product. In the screenshots, the curved black/blue shape becomes a dominant graphic element and the background reads as geometry rather than an infinite studio.

The Porsche reference works because the stage disappears. The user sees:

- one neutral field;
- a product large enough to inspect;
- a soft but readable contact shadow;
- no visible wall/floor transition;
- restrained post-processing.

PRODUCT VIS should borrow that **visual logic**, not necessarily its exact interface.

## 3.2 The app already has image-based lighting

The current engine already generates a PMREM environment from Three.js `RoomEnvironment` and assigns it to `scene.environment`. Therefore the next task is not simply “add an HDRI.”

The real task is to make the studio architecture explicit and independent:

```text
ENVIRONMENT / IBL   → reflections and ambient light
BACKDROP            → visible white-to-black field
GROUND              → physical reference and shadow receiver
```

These three layers must not be fused together again.

## 3.3 The current contact shadow is only a radial texture

The existing soft dark disc creates a general grounding cue, but it is not generated from the product geometry. It cannot accurately follow wheels, legs, asymmetrical bases, or unusual silhouettes.

A premium product viewer needs a contact shadow that:

- is derived from the actual footprint;
- is strongest where the product meets the ground;
- softens as it moves away from the contact point;
- follows orientation and scale changes;
- does not reveal a visible ground plane;
- can be cached when the object is static.

## 3.4 The object is mathematically grounded, but not always visually grounded

V1 already moves the model so its world-space bounding-box minimum reaches the ground. That is a correct baseline.

The floating feeling mainly comes from:

- weak or generic contact shadow;
- the large visible cyclorama;
- a small product-to-frame ratio;
- lighting that can erase the contact area;
- camera positions that can move under or inside the object.

“Grounding” must therefore be treated as a combined system: transform, shadow, camera, and composition.

## 3.5 Bloom and exposure can destroy white products

The overexposed screenshot shows that the current simple controls allow combinations where white paint, highlights, and bloom collapse into one bright area.

For a product presentation engine:

- bloom should be off or nearly invisible by default;
- general white surfaces should never trigger a strong glow;
- emissive bloom should eventually be selective;
- simple presets must be calibrated combinations rather than arbitrary slider values;
- exposure should have a safe range in Simple mode;
- advanced users may override the range, but must have a clear reset.

Premium rendering should come from correct IBL, reflections, material response, composition, and shadow—not from strong post effects.

---

# 4. Backface, transparency, and camera diagnosis

The screenshots show two related but distinct problems. They should not be solved with one global material hack.

## 4.1 Likely issue A — camera penetration

The close-up and underbody screenshots indicate that the camera can:

- pass through the exterior shell;
- rotate below the ground plane;
- move so close to the target that the user sees backfaces or the inside of one-sided geometry.

When a solid mesh is viewed from inside, front-side rendering correctly hides the back faces. That can look like transparency, but the root cause is often camera position.

### First fix

Create a default **Presentation camera envelope**:

- clamp vertical orbit so the camera cannot move under the floor;
- derive minimum camera distance from model bounds;
- prevent presets from placing the camera inside the bounding volume;
- adjust near/far clipping from the product size;
- optionally raycast from target to camera and push the camera out of geometry;
- allow an explicit Advanced “Inspect mode” later for unrestricted orbit.

## 4.2 Likely issue B — genuine material-side or alpha behavior

glTF materials can intentionally be:

- opaque;
- alpha-masked;
- alpha-blended;
- single-sided;
- double-sided;
- transmissive or volumetric.

A car is a useful stress test because it contains paint, carbon, glass, thin panels, interior surfaces, and overlapping transparent meshes.

### Safe material strategy

Do **not** set every imported material to `DoubleSide`.

That would:

- increase fragment work and draw cost;
- reveal interior polygons that should remain hidden;
- change lighting on closed solid surfaces;
- potentially worsen transparent sorting;
- hide bad camera behavior instead of fixing it.

Instead, add a material-analysis pass after import:

1. Preserve all original glTF flags.
2. Classify each material as opaque, mask, blend, transmission, or unknown.
3. Respect glTF `doubleSided` metadata.
4. Identify thin-shell candidates separately.
5. Expose an opt-in “Backface safety” override in Advanced mode.
6. Keep repair values per material, not global.
7. Restore original flags exactly when the override is disabled.

## 4.3 Symptom-to-fix matrix

| Symptom | Most likely cause | Correct first response |
|---|---|---|
| Exterior shell disappears when zoomed in | Camera entered a front-sided mesh | Camera envelope / collision constraint |
| Product can be viewed from below the floor | Orbit polar angle is too permissive | Presentation-mode orbit clamp |
| A thin panel disappears from one direction | Incorrect or missing double-sided authoring | Per-material double-sided repair |
| Glass layers pop or vanish | Alpha blending, depth writing, or sorting | Transparent-material classification and targeted correction |
| White paint becomes a glowing silhouette | Exposure and bloom combination | Calibrated presets; bloom off by default |
| Interior is visible through an apparently opaque surface | Incorrect alpha mode or source material | Validate glTF material metadata and base-color alpha |

---

# 5. Target studio architecture

## 5.1 Principle: separate lighting from what the user sees

Three.js supports independent scene environment and scene background behavior. PRODUCT VIS should use that separation deliberately.

### Environment / IBL

Responsible for:

- reflections;
- ambient illumination;
- roughness response;
- metallic readability;
- glass highlights.

The first production environment should be neutral and deterministic. Two safe options are:

1. **Procedural studio PMREM** generated from softbox cards and flags.
2. A bundled, license-safe neutral `.hdr` or `.exr` studio map processed through PMREM.

The procedural option is preferable for the first checkpoint because it is lightweight, controllable, and has no external asset dependency. Bundled HDRIs can be added after the architecture is proven.

### Backdrop

Responsible only for the visible frame.

Simple mode should offer:

- White;
- Gray;
- Black.

The underlying control can be a continuous perceptual tone slider with snap points. The endpoints should be calibrated off-white and near-black rather than raw clipping values.

Changing the background should not unexpectedly change the product reflections.

### Ground

Responsible for:

- the world `Y = 0` reference;
- automatic floor snap;
- contact shadow reception;
- optional subtle reflection later.

The ground should be visually invisible unless a future presentation preset explicitly asks for a floor material.

## 5.2 Recommended scene stack

```text
Scene
├── StudioEnvironment        // PMREM / neutral IBL
├── KeyLightRig              // optional controlled product highlights
├── ProductSessionRoot
│   └── GroundingRoot
│       └── UserTransformRoot
│           └── MotionRoot
│               └── NormalizationRoot
│                   └── ImportedAsset
├── ShadowCatcher
└── CameraRig
```

The visible backdrop should be handled by `scene.background`, a dedicated full-screen pass, or an export background layer—not by a giant sphere plus visible cyclorama geometry.

## 5.3 Contact-shadow strategy

For the Porsche-like grounding target, use the proven render-to-texture contact-shadow approach:

1. Position an orthographic shadow camera above the model footprint.
2. Render the model depth into a dedicated render target.
3. Blur the depth result horizontally and vertically.
4. Project it onto a transparent plane at ground level.
5. Blend it with the backdrop.

### Performance rule

The contact shadow does not need to be regenerated every frame when the model is static.

Update it only when:

- a model is imported;
- scale, orientation, or ground offset changes;
- an animation changes the ground contact;
- the user enables live turntable shadow updates.

For continuous animation, update at a limited frequency or fall back to standard realtime shadow maps.

## 5.4 Camera system

The camera should have two modes sharing the same rig.

### Presentation mode — default

- product-first orbit;
- cannot move below ground;
- cannot enter the model volume;
- pan is limited around the product;
- camera target remains near the product center of interest;
- presets are guaranteed safe.

### Inspect mode — Advanced

- wider orbit range;
- closer minimum distance;
- optional underbody inspection;
- manual target and clipping controls;
- clear “Return to Presentation” action.

This solves the current issue without reducing professional control.

## 5.5 Post-processing policy

Default stack:

- correct color space;
- physically appropriate tone mapping;
- restrained exposure;
- consistent anti-aliasing;
- no visible bloom on normal materials;
- no depth of field by default.

Advanced effects should be modular and disabled unless requested:

- selective emissive bloom;
- depth of field;
- subtle vignette;
- ambient/contact enhancement;
- branded color grade.

The renderer must look premium with post-processing disabled. Post should finish the image, not rescue it.

---

# 6. User experience architecture

## 6.1 One product, two levels of disclosure

Simple and Advanced users must not run two separate render systems.

They should control the same state:

```text
SIMPLE PRESET ─┐
               ├──> SINGLE PROJECT STATE ───> RENDER ENGINE
ADVANCED VALUE ┘
```

A Simple preset writes several safe values at once. Advanced mode reveals and edits those values directly.

This prevents the common failure where “simple mode” and “advanced mode” drift apart and produce different results.

## 6.2 Simple-user journey

The intended default journey is:

1. Drop or choose a GLB.
2. Wait for automatic validation, grounding, framing, and studio setup.
3. Choose background: White, Gray, or Black.
4. Choose lighting: Soft, Balanced, or Contrast.
5. Choose a camera preset.
6. Export.

Optional actions:

- rotate the product;
- fit the camera;
- start a turntable;
- reset.

The user should not need to understand:

- HDRI rotation;
- roughness;
- shadow map size;
- alpha modes;
- camera clipping;
- environment intensity;
- triangle counts;
- bloom threshold.

## 6.3 Advanced-user journey

Advanced mode should add precision without changing the mental model.

### Environment

- studio environment preset;
- environment intensity;
- rotation;
- background tone;
- optional background/environment lock;
- optional blur when a visible HDR background is introduced.

### Ground and shadow

- auto ground;
- manual ground offset;
- contact-shadow opacity;
- softness;
- spread;
- live/static update mode;
- standard cast-shadow toggle.

### Product

- position, rotation, and scale;
- pivot correction later;
- material list and diagnostics;
- per-material double-sided repair;
- material override and restore.

### Camera

- focal length;
- target height;
- safe distance;
- orbit limits;
- presentation/inspect mode;
- depth of field later.

### Render

- quality profile;
- exposure;
- post-processing modules;
- export resolution;
- diagnostics.

## 6.4 Progressive disclosure rules

- Advanced is closed by default.
- Import and Export are always available.
- The default viewport is clean enough to export at any moment.
- Technical labels appear only inside Advanced.
- Simple controls should remain visible while Advanced is open so the user never loses orientation.
- Every advanced group has an independent reset.
- “Reset Project” and “Reset This Group” must remain distinct.

---

# 7. UI polish direction

## 7.1 Layout

Recommended desktop structure:

```text
TOP BAR
Logo | Model state | Advanced | Import | Export

FULL VIEWPORT

BOTTOM QUICK DOCK
Background | Light | Camera | Fit | Turntable

RIGHT ADVANCED DRAWER
Only visible when requested
```

The permanent left environment rail and permanent right control panel create two simultaneous navigation systems. The cleaner route is one compact quick dock plus one optional advanced drawer.

## 7.2 Visual hierarchy

The product must be the largest and highest-contrast element.

Use:

- near-black UI surfaces;
- white typography;
- `#FF7950` only for selection, progress, warnings, or primary action;
- restrained 1px borders;
- very limited blur and glow;
- small radii, not floating rounded cards everywhere;
- clear spacing rather than decorative containers;
- no environment graphic large enough to compete with the model.

## 7.3 Typography and scale

The screenshots are extremely wide, and the current interface becomes too small relative to the viewport.

Use responsive type and control sizing with `clamp()` so:

- functional labels remain readable on 4K and ultrawide displays;
- metadata can remain compact;
- hit targets stay usable on mobile;
- the product does not appear tiny simply because the screen is large.

Suggested hierarchy:

- 13–14 px functional controls;
- 11–12 px secondary labels;
- 9–10 px only for nonessential metadata;
- minimum 36–40 px desktop hit target;
- minimum 44 px mobile hit target.

## 7.4 Composition behavior

On import, the product should occupy roughly the visual center and a meaningful part of the viewport rather than appearing as a small object in a large stage.

Camera fitting should account for:

- viewport aspect ratio;
- open/closed advanced drawer;
- mobile bottom sheet;
- desired product safe area;
- product orientation and footprint.

The default Hero frame should feel ready for a commercial screenshot.

## 7.5 Motion language

- UI transitions: 160–240 ms.
- Drawer transitions: 220–320 ms.
- Camera presets: 600–900 ms with smooth ease-in/ease-out.
- No elastic overshoot.
- No flash transitions.
- No UI glow impulses on hover or click.
- Model motion should feel weighted and intentional.

## 7.6 Mobile

Mobile should not copy the desktop drawer at reduced size.

Use:

- full viewport;
- bottom quick dock;
- advanced bottom sheet;
- one-finger orbit;
- pinch zoom;
- two-finger pan only in Inspect mode;
- quality defaults selected from device capability;
- contact-shadow updates throttled while interacting.

---

# 8. Safe technical architecture

## 8.1 First principle: behavior-preserving refactor

Before changing the render, migrate the demo into a modular build while keeping the same visible output.

Recommended base:

- Vite;
- locally pinned Three.js dependencies;
- ES modules or TypeScript;
- no runtime CDN dependency;
- versioned preset and project schemas;
- Playwright smoke tests;
- visual regression screenshots.

## 8.2 Proposed module map

```text
src/
├── app/
│   ├── AppController
│   ├── actions
│   └── store
├── assets/
│   ├── ModelLoader
│   ├── DecoderRegistry
│   └── ModelValidator
├── model/
│   ├── ProductSession
│   ├── NormalizationService
│   ├── GroundingService
│   ├── BoundsService
│   └── MaterialInspector
├── render/
│   ├── RendererEngine
│   ├── PostPipeline
│   ├── QualityManager
│   └── FrameExporter
├── studio/
│   ├── EnvironmentManager
│   ├── BackdropManager
│   ├── LightRig
│   ├── GroundSystem
│   └── ContactShadowRenderer
├── camera/
│   ├── CameraRig
│   ├── CameraPresets
│   ├── CameraSafety
│   └── CameraTween
├── motion/
│   ├── AnimationController
│   └── TurntableController
├── presets/
│   ├── looks
│   ├── cameras
│   └── defaults
├── ui/
│   ├── TopBar
│   ├── QuickDock
│   ├── AdvancedDrawer
│   └── notifications
├── project/
│   ├── ProjectSchema
│   └── ProjectSerializer
└── tests/
    ├── fixtures
    ├── smoke
    └── visual
```

The exact filenames can change. The important boundary is that UI, model loading, studio, camera, render, and export do not mutate one another directly.

## 8.3 Single source of truth

Suggested project-state shape:

```js
{
  schemaVersion: 1,
  model: {
    name,
    fingerprint,
    userTransform,
    groundOffset,
    materialRepairs
  },
  studio: {
    environmentId,
    environmentIntensity,
    environmentRotation,
    backdropTone,
    lightingPreset,
    shadowOpacity,
    shadowSoftness
  },
  camera: {
    mode,
    preset,
    focalLength,
    target,
    orbitLimits
  },
  motion: {
    animationClip,
    animationTime,
    turntable,
    speed
  },
  render: {
    quality,
    exposure,
    postModules
  }
}
```

The UI dispatches actions. Services react to state changes. Presets are plain data. No DOM event should directly rebuild the renderer or mutate unrelated systems.

## 8.4 Stable model rig

Use a layered hierarchy so each responsibility has one transform:

```text
ProductSessionRoot        // world placement and final grounding
└── UserTransformRoot     // user rotation and scale
    └── MotionRoot        // turntable and controlled motion
        └── NormalizationRoot // imported scale and centering correction
            └── AssetRoot // untouched GLB scene
```

Benefits:

- reset becomes reliable;
- animation does not destroy grounding;
- imported transforms remain inspectable;
- pivot correction can be added later;
- save/load states remain deterministic;
- each system can be tested independently.

## 8.5 Presets as data, not code branches

A preset should be a versioned object:

```js
{
  id: 'studio-balanced',
  version: 1,
  backgroundTone: 0.72,
  environmentId: 'neutral-softbox',
  environmentIntensity: 1.0,
  keyIntensity: 1.0,
  rimIntensity: 0.35,
  exposure: 1.0,
  bloom: 0
}
```

The preset is applied through the same state actions used by Advanced controls. This prevents duplicated logic.

## 8.6 Feature flags

Experimental features should ship behind flags until their checkpoint passes:

- `contactShadowV2`;
- `cameraCollision`;
- `materialRepair`;
- `savedProjects`;
- `hotspots`;
- `controlledMotion`.

A failed experiment should be removable without touching the stable import/render/export loop.

---

# 9. Milestones and checkpoint gates

## Overview

| Milestone | Name | Main purpose | Production rule |
|---|---|---|---|
| V1.0 | Stable Demo Freeze | Preserve what currently works | No further edits to this baseline |
| V1.1 | Foundation Refactor | Modularize with no visual redesign | Must match V1.0 behavior before continuing |
| V1.2 | Neutral Studio Core | Replace limbo with IBL + backdrop + ground | Must pass white/gray/black and grounding tests |
| V1.3 | Camera & Material Safety | Remove camera penetration and material-side failures | Must pass car/glass/thin-shell fixtures |
| V1.4 | Simple UX Polish | Reduce the default experience to essential decisions | Import-to-export must remain obvious without Advanced |
| V1.5 | Advanced Controls | Add precision through progressive disclosure | Must modify the same state as Simple mode |
| V1.6 | Persistence & Reliable Export | Save/reload looks and guarantee output parity | Schema and export tests must pass |
| V2.0 | Configurator Platform | Infographics, variants, controlled motion | Starts only after the rendering core is frozen |

## V1.0 — Stable Demo Freeze

### Actions

- archive the current deploy and ZIP;
- create a Git tag or immutable folder;
- capture reference screenshots;
- record current working interactions;
- keep the current model test file.

### Pass condition

A permanent rollback point exists and can be deployed independently.

## V1.1 — Foundation Refactor

### Scope

- Vite and pinned dependencies;
- split renderer, loader, camera, studio, UI, and export;
- introduce a central state store;
- add smoke tests;
- preserve current visuals and behavior.

### Pass condition

- same model loads;
- same presets work;
- same camera presets work;
- same export sizes work;
- no console errors;
- visual screenshots remain within an agreed tolerance.

### Stop rule

Do not start the new studio system until this pass is stable.

## V1.2 — Neutral Studio Core

### Scope

- remove visible cyclorama and background sphere;
- add neutral PMREM environment;
- add separate background tone control;
- add invisible ground;
- add geometry-aware contact shadow;
- default bloom off;
- recalibrate camera fit and exposure.

### Pass condition

- no visible wall/floor seam;
- no large environment shape in frame;
- White, Gray, and Black backgrounds are consistent;
- product reflections do not change unexpectedly with background tone;
- model is visibly grounded;
- shadow follows the footprint;
- white products retain highlight detail;
- black products retain edge separation.

## V1.3 — Camera & Material Safety

### Scope

- Presentation/Inspect camera modes;
- above-ground orbit clamp;
- minimum safe camera distance;
- camera collision or bounding-volume guard;
- adaptive near/far planes;
- material classification;
- per-material backface repair;
- glass and alpha diagnostics.

### Pass condition

- default camera cannot enter the reference car;
- default camera cannot move below the ground;
- Detail preset remains outside the product shell;
- thin double-sided fixture is visible from both intended sides;
- opaque materials remain opaque;
- glass remains visible and sorted acceptably;
- no global `DoubleSide` override is required.

## V1.4 — Simple UX Polish

### Scope

- simplified top bar;
- compact bottom quick dock;
- White / Gray / Black background controls;
- Soft / Balanced / Contrast lighting controls;
- camera presets and Fit;
- optional Turntable;
- Advanced closed by default;
- responsive type and sizing.

### Pass condition

A first-time user can import, create a useful shot, and export without opening Advanced or reading instructions.

## V1.5 — Advanced Controls

### Scope

- environment intensity and rotation;
- ground offset and shadow controls;
- focal length and target controls;
- Inspect mode;
- material diagnostics and repairs;
- quality controls;
- independent group resets.

### Pass condition

- every advanced value maps to the same project state used by Simple presets;
- closing Advanced does not change the image;
- Simple presets remain usable after advanced edits;
- reset behavior is deterministic.

## V1.6 — Persistence & Reliable Export

### Scope

- versioned `.productvis` project state;
- saved looks;
- exact viewport/export framing parity;
- offscreen export target;
- project schema migration support;
- optional local recent projects.

### Pass condition

A scene can be saved, reloaded, and exported with the same visible result.

## V2.0 — Configurator Platform

Only after V1.6 is stable:

- material and color variants;
- part visibility states;
- infographic hotspots;
- line and label overlays;
- controlled animation chapters;
- camera sequences;
- branded presentation mode;
- shareable read-only scenes;
- AR handoff.

Each should be a module that consumes project state and product anchors without rewriting the renderer core.

---

# 10. Required test kit

A serious product visualizer needs fixed “golden” assets. Do not evaluate changes with only one clean model.

## 10.1 Model fixtures

1. **Opaque hard-surface product**  
   Tests normal maps, metalness, roughness, and grounding.

2. **Vehicle with glass and interior**  
   Tests alpha blending, transmission, nested surfaces, complex footprint, and camera safety.

3. **Thin-shell product**  
   Tests intentional double-sided materials.

4. **Animated product**  
   Tests animation, ground anchoring, and shadow update policy.

5. **Bad pivot / extreme scale product**  
   Tests normalization, centering, grounding, and manual correction.

6. **White, black, chrome, and emissive material chart**  
   Tests preset calibration and post-processing.

## 10.2 Viewport matrix

Test at minimum:

- 1920 × 1080 desktop;
- 2560 × 1440 desktop;
- 3440 × 1440 ultrawide;
- 390 × 844 mobile;
- square export;
- 16:9 export;
- 4:5 export.

## 10.3 Rendering acceptance checks

- no WebGL warnings or shader errors;
- no unexpected material replacement;
- no visible floor seam;
- no camera penetration in Presentation mode;
- no underfloor orbit in Presentation mode;
- contact shadow stays attached to the product;
- background changes do not alter IBL unless intentionally linked;
- export and viewport framing match;
- context loss shows a recoverable message;
- repeated imports dispose old GPU resources.

## 10.4 Performance targets

Treat these as acceptance targets, not current measurements:

- smooth interaction on a modern desktop at 1080p in Quality;
- at least a stable usable 30 FPS on target mobile hardware in Balanced;
- no continuous contact-shadow render when the product is static;
- no `preserveDrawingBuffer` during normal interaction;
- export rendered through an offscreen target;
- environment maps cached after PMREM generation;
- device pixel ratio capped by quality profile;
- no hidden full-resolution post passes on mobile.

---

# 11. Implementation know-how and sequence

## 11.1 Sequence that minimizes breakage

### Step 1 — Freeze

Make V1.0 immutable.

### Step 2 — Build the test harness

Create reference screenshots and fixture-model checks before refactoring.

### Step 3 — Move to a proper build

Pin dependencies locally and remove CDN runtime risk.

### Step 4 — Separate modules without redesigning

Move code into services while preserving all current behavior.

### Step 5 — Introduce central state

Make presets and UI controls dispatch state changes rather than mutating renderer systems directly.

### Step 6 — Replace the studio in isolation

Remove sphere/cyclorama. Add environment, backdrop, ground, and shadow as separate systems.

### Step 7 — Lock camera safety

Fix the “transparency” appearance caused by penetration before touching material sides.

### Step 8 — Add material diagnostics

Respect glTF authoring first; repair only the materials that need repair.

### Step 9 — Calibrate looks

Use the fixture chart and reference car to tune white, gray, black, chrome, glass, and emissive cases.

### Step 10 — Simplify the UI

Only after the render is stable, rebuild the visible control hierarchy.

### Step 11 — Expose Advanced

Reveal the stable state variables; do not create new parallel logic.

### Step 12 — Add persistence

Version project state before adding configurator content.

## 11.2 Work separation rule

Never combine these in the same milestone:

- architecture refactor and visual redesign;
- camera changes and material changes;
- contact shadow and post-processing experiments;
- simple UI changes and advanced feature additions;
- project persistence and schema redesign;
- configurator features and renderer-core changes.

One subsystem should change at a time, with a deployable checkpoint after it.

---

# 12. Main risks and safeguards

| Risk | Why it is dangerous | Safeguard |
|---|---|---|
| Global `DoubleSide` fix | Hides camera problems and damages performance/material correctness | Per-material analysis and opt-in repair |
| Using one HDRI as both light and visible backdrop | Background changes also change reflections and exposure | Separate environment, backdrop, and ground |
| Adding more look presets now | Multiplies variables before the render baseline is correct | One neutral studio first, then three calibrated looks |
| Refactor and redesign together | Impossible to identify which change broke behavior | Behavior-preserving V1.1 checkpoint |
| Strong bloom as “premium” | Destroys white surfaces and material detail | Bloom off by default; selective later |
| Free camera everywhere | Users accidentally enter models or expose backsides | Presentation mode by default; Inspect mode advanced |
| Advanced panel becoming another Blender | Product promise becomes unclear | Only expose parameters tied to a visual outcome |
| Multiple state systems | Simple and Advanced results diverge | One versioned project state |
| Continuous high-quality contact shadow | Expensive on mobile | Event-driven or throttled shadow updates |
| CDN-only dependencies | Runtime availability and version drift | Local pinned build |
| Unversioned saved scenes | Future updates break old projects | Schema version and migrations from the first save feature |

---

# 13. Decisions to lock now

1. The current deployed demo becomes **V1.0 Stable**.
2. The next build is an architecture pass with no intentional visual redesign.
3. Environment lighting, visible background, and ground are independent systems.
4. Simple mode defaults to White/Gray/Black, calibrated studio light, camera presets, and export.
5. Advanced mode controls the same state, not a separate engine.
6. Camera safety is fixed before global material changes.
7. `DoubleSide` is never applied globally by default.
8. Contact shadow becomes geometry-aware and updates only when required.
9. Bloom is not part of the default premium look.
10. PRODUCT VIS remains a presentation engine, not a general 3D editor.
11. Every milestone ends in a deployable preview and a pass/fail checklist.
12. Configurator, infographics, and controlled motion begin only after the studio core is frozen.

---

# 14. Recommended immediate deliverable

The safest next package is:

## `PRODUCT VIS V1.1 — FOUNDATION`

It should contain:

- the same visual output as the current demo;
- a Vite project with local dependencies;
- modular renderer, loader, scene, camera, model, UI, and export services;
- central project state;
- fixed test assets and screenshot baselines;
- no new HDRI UI yet;
- no redesigned panel yet;
- no configurator features.

Once V1.1 passes visual and functional parity, proceed to:

## `PRODUCT VIS V1.2 — NEUTRAL STUDIO`

That is the checkpoint where the limbo is removed and replaced by:

- neutral PMREM/HDR environment;
- independent White/Gray/Black backdrop;
- invisible ground;
- accurate contact shadow;
- safer camera composition;
- calibrated, bloom-free default render.

This sequence is slower for one build and dramatically faster for the entire product.

---

# 15. Reference documentation

- Three.js Scene environment/background separation: https://threejs.org/docs/pages/Scene.html
- Three.js RoomEnvironment: https://threejs.org/docs/pages/RoomEnvironment.html
- Three.js PMREMGenerator: https://threejs.org/docs/pages/PMREMGenerator.html
- Three.js contact-shadow example: https://threejs.org/examples/webgl_shadow_contact.html
- Three.js Material side/transparency behavior: https://threejs.org/docs/pages/Material.html
- Three.js OrbitControls constraints: https://threejs.org/docs/pages/OrbitControls.html
- Khronos glTF 2.0 material, alpha, and double-sided rules: https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html
- Visual reference: https://dyadstudios.com/renderapp/porsche/

---

## Final product sentence

> **PRODUCT VIS should make professional 3D presentation feel automatic for a simple user, while giving a professional controlled depth only when they deliberately ask for it.**
