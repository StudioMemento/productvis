# PRODUCT VIS V2.1A — STABILITY IMPLEMENTATION

## Checkpoint purpose

V2.1A freezes the V2 authoring and presentation foundation, then repairs the two blockers that make the visible product feel unreliable:

1. imported surfaces can be rendered with the wrong side policy;
2. Hero, Front, Side, Top and Fit can frame stale or pathological bounds.

This checkpoint deliberately does **not** rebuild the quick dock. The persistent Light / Camera / Variants / Motion / Story shelf belongs to V2.1B, after the renderer contracts below are stable.

```text
Package version   2.1.0-alpha.1
Project schema    10
Experience schema 1
Build marker      v2-1a-stability
```

---

## 1. Camera preset repair

### Fresh visible bounds

Every camera preset and Fit action now requests a fresh visible-product bounds report before calculating its target or position.

The report separates:

- **full bounds** — exact visible product bounds used by product state;
- **framing bounds** — the safe box used by camera fitting;
- **framing source** — `full` or `robust-core`;
- **bounds validity** — an explicit finite-state gate.

Hidden parts are excluded through the existing Product Structure visibility contract. Product helpers can opt out with `userData.__pvExcludeFromBounds`.

### Pathological export protection

A malformed GLB can contain one distant vertex that makes the exact bounding box enormous. V2.1A samples visible mesh positions and compares the sampled core with the exact box.

When the exact diagonal is at least 4.5× the sampled core diagonal, camera fitting can use an expanded robust core. Normal assets retain exact bounds. Extreme outliers can also be ignored during initial normalization so the real product does not load as a speck.

Robust trimming is disabled while an exploded state is active or transitioning, so authored product separation is never treated as corruption.

### Aspect-aware fitting

The camera now evaluates all eight corners of the selected box against both:

- vertical field of view;
- horizontal field of view derived from viewport aspect ratio.

Hero, Front, Side, Top, Detail and Fit therefore derive distance from the current product and current viewport rather than from fixed world coordinates.

### Safe rejection and clipping

A preset is rejected without moving the camera when bounds, target, direction or distance are empty, non-finite or invalid.

Near and far planes are recalculated from actual box depth in the current view direction. The diagnostics panel exposes:

- bounds valid;
- bounds source;
- rejected preset;
- min / max orbit distance;
- near / far clipping;
- inside-model, ground and target clamps.

Top uses a small forward/right offset instead of sitting exactly on the orbit-control pole.

---

## 2. Imported material-side preservation

### Explicit surface policies

Every material can now use:

```text
Auto | Front | Double | Flip
```

- **Auto** restores and preserves the imported material side.
- **Front** forces front-side rendering.
- **Double** renders both sides for intentional thin/open surfaces.
- **Flip** uses the reversed rendered side for genuinely inverted geometry.

Legacy project values remain readable:

- `original` migrates to `auto`;
- `back` migrates to `flip`.

Auto is stored as an explicit portable user choice. This also acts as an opt-out when suggested repairs are enabled again.

### Suggested repair helper

The global backface helper no longer mutates every imported material implicitly. It creates explicit `Double` overrides only for safe thin-shell candidates and records which overrides were suggested.

Disabling the helper removes only the recorded suggested `Double` overrides. Manual Front, Double, Flip and Auto decisions survive.

Suggested and manual override identities are persisted in:

- `.productvis` projects;
- presentation-state snapshots;
- canonical project capture;
- reset and migration paths.

### Transparent material separation

Transparent and glass materials are diagnosed separately from side policy. The material report now identifies:

- opaque, mask, blend and transmission modes;
- imported Front / Double / Flip state;
- transparent depth-writing risk;
- transparent double-sided risk;
- safe thin-shell candidates;
- manual and suggested override counts.

Glass is never automatically forced to Double.

---

## 3. Memento identity

The top bar now uses the Memento wordmark as vector geometry rather than typed text.

`public/memento-wordmark.svg` contains:

- one path element;
- a `1600 × 100` viewBox;
- pure-white fill;
- no raster image;
- no masks, filters, embedded styles or duplicate groups.

`PRODUCT VIS` remains a restrained product label beside the Memento brand. The favicon uses the same white path language on black.

---

## 4. Interface additions inside the existing V2 shell

V2.1A keeps the existing simple/Advanced architecture, but makes the stability tools legible:

- Alpha blend and transparent depth-risk counters;
- explicit surface-policy dropdown per material;
- imported-to-effective side readout;
- suggested-repair marker;
- robust-bounds camera status;
- invalid-bounds / rejected-preset status;
- wording that explains Auto as imported-policy preservation.

The permanent multi-module control shelf is intentionally deferred to V2.1B so the repaired engine becomes its single source of truth.

---

## 5. Test coverage added

### Camera framing

`tests/camera-framing.test.mjs` covers:

- all box corners remaining inside the calculated view;
- portrait-aspect fitting for a wide product;
- finite near/far clipping;
- robust framing-metric selection;
- invalid-box rejection;
- outlier-vertex robust trimming.

### Material policy

`tests/material-diagnostics.test.mjs` covers:

- transparent depth-risk classification;
- imported side labels;
- suggested Double overrides;
- suggestion identity restoration;
- Auto restoring the imported side;
- manual Double surviving helper disable;
- transparent/glass exclusion from blanket repair.

### Architecture

The architecture gate now checks:

- new camera and bounds modules;
- V2.1A build marker and package version;
- fresh-bounds camera callbacks;
- material-side persistence fields;
- path-only logo and diagnostic bindings;
- unchanged single-renderer and no-CDN contracts.

---

## 6. Validation status

Completed in the delivery environment:

```text
JavaScript / MJS syntax sweep      PASS
Architecture suite                 PASS — 24/24
Dependency-free unit tests         PASS — 56/56 outside architecture
Total executed without Three.js    PASS — 80/80
Repository file count              PASS — under 100
```

The two Three.js-dependent files could not execute because dependencies were not present and npm DNS resolution was unavailable in the delivery environment. This is an environment limitation, not recorded as a pass or a failure.

The compact source package does not contain the Honda or Lamborghini production GLBs. The new tests therefore include a synthetic pathological-bounds asset, while final connected acceptance must still load the real representative vehicles.

---

## 7. Connected acceptance gate

Run after extracting the package on a connected machine:

```bash
npm install
npm run check
npx playwright install chromium
npm run test:smoke
```

Then verify with the real automotive assets:

1. Hero, Front, Side, Top, Detail and Fit keep the product in frame.
2. Hiding parts and changing visibility variants refreshes the next preset.
3. Top never produces an empty canvas or orbit-pole failure.
4. Camera cannot begin from an empty/non-finite bounds state.
5. Thin open panels can be repaired individually with Double.
6. Auto restores the imported side exactly.
7. Glass remains independent from backface repair.
8. Transparent depth-risk items are visible in diagnostics.
9. Manual overrides survive project and presentation-state round trips.
10. The Memento logo remains sharp and pure white at every responsive size.

---

## 8. Next checkpoint contract

### V2.1B — Visible Engine Shell

- persistent Light, Camera and Variants modules;
- conditional Motion module;
- Story transport outside Inspector;
- Advanced renamed to Inspector;
- one slim contextual second row on desktop;
- category rail plus bottom sheet on mobile.

### V2.1C — Focus and Presentation

- double-click surface framing;
- focus distance and quality-tiered bokeh;
- Add Annotation from focused surface;
- transparent GFX upload;
- visual Shot / Story strip.

### V2.1D — Material Configurator

- semantic Material Sockets;
- texture-preserving tint and finish controls;
- optional masks;
- generated configurator swatches.

### V2.1E — Asset Library

- optimized unbranded starter product;
- poster-first progressive loading;
- curated public manifest and CDN storage;
- local Recent assets;
- optional private Studio Library.
