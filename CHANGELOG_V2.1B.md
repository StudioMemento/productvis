# Product VIS V2.1B Changelog

- Bundled the 2015 Rocket Bunny Honda NSX locally under `public/models/` and load it immediately with true transfer progress; removed all procedural/proxy starter-model behavior.
- Added a persistent Global Studio bar with always-available Camera, Lighting, Stage, Configurator and Animation categories, while keeping Advanced as a separate precision layer.
- Rebuilt all eight camera presets from visible product-only world-space bounds, including FOV/aspect-aware framing, clipping-plane updates and a safe top-view up vector.
- Added product-only double-click and mobile double-tap surface focus with exact hit-point persistence, a 480 ms interruptible camera/target/DOF tween, focus lock, reset focus and a temporary marker.
- Added Depth of Field controls for enable, focus distance, aperture, bokeh strength and focus range.
- Added six coherent lighting presets and six independent stage/environment presets with direct quick controls.
- Added curated NSX configurator groups for body, wheels, interior, brakes/calipers and glass, plus semantic custom-GLB detection and manual regrouping without removing texture maps.
- Added Still, Turntable, Float, Showcase and Detail orbit procedural motion, alongside native GLB animation clips when present.
- Added reversible per-material Auto, Front, Back, Double, Opaque, Cutout and Transparent policies; automatic classification now separates opaque, cutout, glass and thin-shell materials without globally forcing `DoubleSide`.
- Persisted camera, focus point, DOF, lighting, stage, configuration, material policies, product transform and animation in both project and presentation states.
- Added responsive desktop/mobile layouts, runtime diagnostics, static validation, smoke tests and browser acceptance checks.
