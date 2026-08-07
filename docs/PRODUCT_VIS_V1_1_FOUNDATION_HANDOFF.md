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
