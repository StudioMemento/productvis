# PRODUCT VIS V1.1 — FOUNDATION

A local-first realtime product renderer for self-contained GLB files. V1.1 is a **behavior-preserving architecture release**: the visual output and interaction grammar remain aligned with V1.0 while the monolithic prototype is split into stable engine modules.

## Deploy on Vercel

1. Unzip the project.
2. Import the project folder into Vercel, or push it to a Git repository connected to Vercel.
3. Vercel should detect **Vite** automatically.
4. Build command: `npm run check` (source tests, then production build).
5. Output directory: `dist`.
6. No environment variables or backend services are required.

The model stays in the browser. PRODUCT VIS does not upload imported GLB files.

## Local development

Node.js 20.19+ or 22.12+ is required by the pinned Vite toolchain.

```bash
npm install
npm run dev
```

The first connected `npm install` creates `package-lock.json`. Commit that lockfile before tagging the accepted V1.1 checkpoint so every later deploy resolves the same transitive dependency graph.

Production check:

```bash
npm run check
npm run test:smoke
```

Playwright browsers need to be installed once on each test machine:

```bash
npx playwright install chromium
```

## What V1.1 changes

- Replaces runtime CDN imports with pinned npm dependencies.
- Uses Vite for versioned, bundler-controlled local and production builds.
- Copies Draco and Basis/KTX2 decoders from the pinned Three.js package into versioned public paths at build time.
- Introduces one serializable `ProjectStore` as the source of truth for product, studio, camera, motion and render values.
- Separates renderer, studio, model session, camera, motion, export and UI responsibilities.
- Introduces the stable model rig:

```text
ProductSessionRoot
└── UserTransformRoot
    └── MotionRoot
        └── NormalizationRoot
            └── ImportedAsset
```

- Preserves the existing presets, camera controls, material treatments, animation playback, turntable, responsive panel and export formats.
- Adds unit architecture checks and browser smoke tests.
- Exposes `window.__PRODUCT_VIS__` in development/runtime for diagnostics.

## Intentionally unchanged in V1.1

This checkpoint does **not** implement the new neutral HDR studio yet. The visible cyclorama, gradient environment, radial contact shadow, camera freedom and original material behavior remain the V1.0 reference so architecture and rendering changes are never mixed in one pass.

Those changes belong to:

- **V1.2:** independent environment, backdrop and ground; geometry-aware contact shadow; restrained post-processing.
- **V1.3:** Presentation/Inspect camera modes and per-material transparency/backface diagnostics.

## Input recommendations

Use a self-contained `.glb` with PBR materials. For broad mobile compatibility:

- textures at 2K or below where possible;
- Draco or Meshopt geometry compression;
- KTX2/Basis texture compression;
- no hidden geometry or unused clips;
- roughly 50–80 MB or less for general mobile use.

External `.gltf` dependency folders are intentionally not supported in this product core.

## Controls

- Drag: orbit camera
- Shift + drag: pan
- Wheel or pinch: zoom
- `I`: import GLB
- `F`: fit model
- `1–5`: camera presets
- `R`: reset render
- `Space`: play or pause an embedded animation

## Project structure

```text
product-vis/
├── index.html
├── package.json
├── vite.config.js
├── playwright.config.js
├── vercel.json
├── public/
│   ├── favicon.svg
│   └── decoders/
│       └── three-0.185.1/     # populated from pinned Three.js at build time
├── src/
│   ├── app/                   # orchestration and central state
│   ├── camera/                # OrbitControls, presets and camera tween
│   ├── config/                # versioned presets and defaults
│   ├── demo/                  # procedural first-load product
│   ├── export/                # controlled PNG export
│   ├── model/                 # loading, normalization, grounding and materials
│   ├── motion/                # embedded clips and turntable
│   ├── render/                # renderer and post pipeline
│   ├── studio/                # current V1 studio implementation
│   ├── ui/                    # DOM bindings and presentation state
│   └── utils/
├── tests/
└── docs/
```

See `docs/PRODUCT_VIS_V1_1_FOUNDATION_HANDOFF.md` for the checkpoint acceptance criteria and the safe V1.2 entry point.
