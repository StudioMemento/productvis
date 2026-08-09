# PRODUCT VIS V2 — VALIDATION REPORT

## Validation date

2026-08-09

## Checkpoint

```text
Package version        2.0.0
Project schema         10
Experience schema      1
Build marker           v2-branded-presentation-mode
Delivery extension     .productvis-show
```

---

## 1. Completed source validation

```text
JavaScript / MJS syntax sweep               PASS
Unit + architecture suite                   PASS — 83/83
Local JavaScript import resolution          PASS
Pinned dependency contract                  PASS
Runtime CDN exclusion                       PASS
HTML parser                                 PASS
Unique HTML IDs                             PASS — 394/394
DOM binding completeness                    PASS — 393/393
Missing DOM bindings                        PASS — 0
CSS structural brace check                  PASS — 899/899
Build marker                                PASS
Schema marker                               PASS
Vercel test-before-build contract           PASS
```

Command:

```bash
cd /mnt/data/pv20
node --test tests/*.test.mjs
```

Result:

```text
83 tests
83 passed
0 failed
0 skipped
```

---

## 2. New V2 unit coverage

### Experience grammar

- brand text limits;
- valid accent and theme enums;
- player-control booleans;
- intro / outro sanitation;
- HTTP(S) and relative delivery URLs;
- image data-URL format validation;
- decoded logo-size budget.

### Experience package

- `PVISSHOW1` magic;
- container version;
- schema-10 published project;
- experience schema 1;
- raw GLB byte preservation;
- asset metadata;
- binary decode and migration;
- published runtime normalization.

The included `foundation-cube.glb` is encoded and decoded through the production experience codec and compared byte-for-byte.

### Experience runtime

- Editor → Intro → Active → Outro → Editor;
- direct-entry behavior;
- story-state synchronization;
- deterministic exit.

### AR handoff

- Android HTTPS GLB requirement;
- Android Scene Viewer intent generation;
- Android web fallback generation;
- Apple HTTPS USDZ requirement;
- Apple Quick Look target resolution;
- unsupported-platform fallback behavior.

### Presentation-frame layout

- NDC-to-output mapping;
- Match padding awareness;
- bounded safe areas;
- infographic card sizing.

### Architecture gate

The suite confirms that V2:

- imports the new presentation modules;
- keeps one renderer;
- exposes the Publish workspace;
- provides a read-only presentation shell;
- retains the quick dock;
- avoids a timeline panel;
- publishes schema 10.

---

## 3. Browser smoke coverage added

The Playwright source suite now contains a V2 scenario that:

1. boots the demo project;
2. snapshots the authoring project;
3. enters Presentation Mode from the top-level Present action;
4. verifies the editor shell and quick dock are hidden;
5. verifies the branded intro is visible;
6. starts the experience;
7. verifies active read-only navigation;
8. confirms schema 10 and active runtime state;
9. exits presentation mode;
10. confirms the editor shell returns;
11. compares model, studio and camera state with the pre-preview snapshot.

This browser scenario is included but was not executed in this sandbox because the pinned Playwright/Vite packages could not be installed.

---

## 4. Production-build attempt

Command:

```bash
npm run build
```

Result:

```text
> product-vis@2.0.0 build
> vite build

sh: 1: vite: not found
```

Dependency installation was attempted. The sandbox package mirror returned:

```text
404 Not Found — @playwright/test@1.62.0
```

The absence of installed dependencies means this report does **not** claim:

- a completed Vite production bundle;
- a running WebGL browser session;
- executed Playwright Chromium checks;
- visual screenshot acceptance on physical devices.

This limitation is recorded explicitly rather than inferred as a pass.

---

## 5. Connected acceptance commands

Run from the extracted project on a connected machine:

```bash
npm install
npm run check
npx playwright install chromium
npm run test:smoke
```

`npm run check` executes the 83-test source suite before Vite bundles the application.

---

## 6. Required connected visual checks

### Desktop editor / player

- import a representative GLB;
- author at least one variant, infographic and story;
- configure brand and intro;
- enter Presentation Mode;
- verify the authoring interface is absent;
- start, pause, navigate, finish and restart the story;
- exit and verify authoring state restoration.

### Package round-trip

- publish `.productvis-show`;
- reload the app;
- open the package from Project → Open Experience;
- verify model, brand, variants, graphics and story;
- verify it opens directly as a read-only experience.

### Remote package

- host the package at HTTPS;
- confirm a same-origin player URL boots it;
- confirm a cross-origin URL works only when the package server allows the player origin;
- confirm malformed / missing package URLs fail safely.

### Branded export

For viewport, 1920×1080 and 2160×2700:

- clean Match;
- clean Fill;
- presentation Match;
- presentation Fill;
- brand only;
- brand + infographic;
- brand + story caption.

Confirm projected anchors remain attached after padding and crop.

### Mobile

- iPhone Safari read-only player;
- Android Chrome read-only player;
- mobile intro / navigation / outro spacing;
- orientation change;
- fullscreen fallback behavior;
- file-share fallback;
- AR target launch with real hosted assets.

---

## 7. Known delivery boundaries

- PRODUCT VIS packages experiences; it does not host them.
- Remote package boot requires network reachability and compatible CORS.
- Native file sharing varies by browser and platform; download is the fallback.
- Android AR requires a hosted HTTPS GLB.
- Apple AR requires a hosted HTTPS USDZ.
- V2 does not include client-side USDZ conversion.
- No cloud account, analytics, access control or URL-shortening service is included.
- QR publishing remains a delivery-service concern rather than a renderer-core concern.

---

## 8. Validation conclusion

The V2 source architecture, state model, binary package format, export mapping, sharing fallback and AR target contracts pass the available deterministic checks.

Final acceptance still requires the connected Vite/Playwright/WebGL gate and real-device AR verification described above.
