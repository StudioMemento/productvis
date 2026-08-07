# PRODUCT VIS — v0.1

A client-side realtime product renderer for GLB files. Drop a model into a clean studio, adjust the look, choose a camera preset, and export a ready visual without uploading the asset to a server.

## Deploy on Vercel

This is a static project. No build command or environment variables are required.

1. Unzip the project.
2. Import the folder into a new Vercel project, or push it to GitHub and connect the repository.
3. Leave **Framework Preset** as `Other` and leave **Build Command** and **Output Directory** empty.
4. Deploy.

For local testing, serve the folder through any static server. ES modules will not run correctly by double-clicking `index.html` directly.

```bash
python -m http.server 8080
```

Then open `http://localhost:8080`.

## Included in this build

- Drag-and-drop or file-picker GLB import.
- Local-only processing: the model is not uploaded.
- Draco, Meshopt and KTX2 decoder support.
- Automatic centering, grounding, scaling and camera framing.
- Five lighting/environment looks: Studio, Soft, Noir, Gallery and Sunset.
- Original, clay, chrome and matte material treatments.
- Exposure, environment, key light, rim light and bloom controls.
- Quality modes tuned for desktop and mobile.
- Hero, front, side, top and detail camera presets.
- Object orientation, scale, vertical offset, grounding and reset controls.
- Embedded GLB animation clip playback, loop and speed controls.
- Camera auto-orbit and object turntable modes.
- PNG export for viewport, 16:9, square and 4:5 formats.
- Responsive desktop panel and mobile bottom sheet.
- Procedural demo object so the renderer has an immediate visual on first load.

## Input recommendations

Use a self-contained `.glb` with PBR materials. For reliable mobile performance:

- Keep textures at 2K or below where possible.
- Prefer Draco or Meshopt compression.
- Use KTX2/Basis textures for larger projects.
- Remove hidden geometry and unused animation clips.
- Keep the model under roughly 50–80 MB for broad mobile compatibility.

External `.gltf` dependency folders are intentionally not supported in this MVP; package the asset as one GLB.

## Controls

- Drag: orbit camera
- Shift + drag: pan
- Wheel/pinch: zoom
- `I`: import GLB
- `F`: fit model
- `1–5`: camera presets
- `R`: reset the render
- `Space`: play/pause embedded animation when available

## Project structure

```text
product-vis/
├── index.html
├── app.js
├── styles.css
├── vercel.json
├── README.md
└── assets/
    └── favicon.svg
```

Three.js is pinned to version `0.185.1` through jsDelivr. The deployed app therefore needs an internet connection on first load for the rendering library and optional model decoders.

## Next product layers

The current architecture is ready to expand into HDRI upload and management, saved scene presets, material configurator states, hotspot infographics, exploded views, branded camera sequences, controlled animation chapters and shareable project files.
