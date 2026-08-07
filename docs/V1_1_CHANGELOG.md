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
