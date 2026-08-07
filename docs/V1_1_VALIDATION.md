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
