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
