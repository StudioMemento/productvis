# PRODUCT VIS V2.1A — VALIDATION REPORT

## Validation date

2026-08-12

## Checkpoint

```text
Package version        2.1.0-alpha.1
Project schema         10
Experience schema      1
Build marker           v2-1a-stability
Delivery extension     .productvis-show
Repository target      fewer than 100 files
```

---

## 1. Completed deterministic validation

```text
JavaScript / MJS syntax sweep               PASS
Architecture suite                          PASS — 24/24
Dependency-free unit tests                  PASS — 56/56
Total executed without Three.js             PASS — 80/80
Local JavaScript import resolution          PASS
Pinned dependency contract                  PASS
Runtime CDN exclusion                       PASS
Unique HTML IDs / DOM binding contract      PASS
V2.1A build and schema markers              PASS
Vercel test-before-build contract           PASS
Repository compact-file target              PASS
```

Commands used:

```bash
find src tests -type f \( -name '*.js' -o -name '*.mjs' \) -print0 \
  | xargs -0 -n1 node --check

node --test tests/architecture.test.mjs
node --test tests/*.test.mjs
```

The complete source command executed 80 passing tests before reaching the two Three.js-dependent files described below. No dependency-free test failed.

---

## 2. V2.1A architecture coverage

The architecture suite confirms that the package:

- contains `CameraFraming.js` and `VisibleBounds.js`;
- refreshes ProductSession bounds when a preset or Fit is requested;
- rejects invalid camera metrics;
- uses framing bounds rather than fixed world-space preset positions;
- retains one renderer and one canonical project state;
- preserves imported material side policy under Auto;
- persists manual and suggested surface override identities;
- exposes Alpha Blend and Depth Risk diagnostics;
- includes the path-only Memento wordmark;
- reports package `2.1.0-alpha.1` and build marker `v2-1a-stability`;
- keeps the compact repository below the browser-upload limit.

Result:

```text
24 tests
24 passed
0 failed
```

---

## 3. Three.js-dependent source tests

Two test files import the pinned `three` package directly:

- `tests/camera-framing.test.mjs`;
- `tests/material-diagnostics.test.mjs`.

They cover:

### Camera and bounds

- eight-corner aspect-aware fitting;
- wide-product fitting in portrait viewports;
- finite near/far clipping;
- robust framing-metric preference;
- invalid-box rejection;
- malformed outlier-vertex trimming.

### Surface policy

- stable unique-material diagnostics;
- imported Front / Double / Flip labels;
- transparent depth-writing risk;
- safe thin-shell suggestion behavior;
- transparent/glass exclusion from blanket repair;
- suggestion identity restoration;
- Auto restoring the imported side;
- manual Double surviving helper disable.

These files were syntax-checked but could not execute in this delivery environment because `node_modules` was absent and npm DNS resolution returned `EAI_AGAIN`. They are therefore recorded as **not executed**, not as passing or failing.

---

## 4. Dependency and production-build boundary

Dependency installation was attempted with the pinned package contract. The environment could not resolve `registry.npmjs.org`, so Vite, Three.js and Playwright were not installed locally.

This report does **not** claim:

- a completed Vite production bundle;
- an executed WebGL browser session;
- Playwright Chromium acceptance;
- screenshots from the modified local build;
- physical-device rendering acceptance.

The source package remains ready for the connected gate below.

---

## 5. Connected acceptance commands

Run from the extracted project on a connected machine:

```bash
npm install
npm run check
npx playwright install chromium
npm run test:smoke
```

`npm run check` executes the complete unit/architecture suite before Vite builds the application.

---

## 6. Required representative-model checks

The compact repository contains only the `foundation-cube.glb` fixture. It does not contain the Honda or Lamborghini production assets mentioned in the V2.1A brief.

Use both representative automotive GLBs for final acceptance:

### Camera

1. Hero frames the complete visible vehicle.
2. Front and Side preserve a useful product scale.
3. Top does not zoom to an empty canvas.
4. Detail remains bounded and finite.
5. Fit works after import, scale, rotation and centering.
6. Hiding parts or applying a visibility variant refreshes the next preset.
7. Exploded states are not mistaken for malformed outliers.
8. Near/far clipping does not cut the vehicle interior or place the camera inside the product.

### Materials

1. Auto matches every imported glTF side setting.
2. Double repairs intentional thin/open panels individually.
3. Flip repairs genuinely inverted surfaces without changing unrelated materials.
4. Suggested repair never forces glass or transmission materials to Double.
5. Transparent depth-writing risks appear in diagnostics.
6. Manual overrides survive `.productvis` save/open.
7. Manual overrides survive presentation-state capture/apply.
8. Disabling suggestions restores only suggested materials.

### Identity and responsive shell

1. Memento remains pure white and sharp.
2. The wordmark does not stretch or clip.
3. `PRODUCT VIS` remains a subordinate product label.
4. The top bar remains usable at desktop and mobile breakpoints.

---

## 7. V2.1A conclusion

The available deterministic source gate passes: syntax, architecture, dependency-free behavior, persistence contracts and compact-repository structure are intact.

Final release acceptance still depends on the connected dependency/build/browser gate and visual testing with the representative Honda and Lamborghini GLBs.
