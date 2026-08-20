# MAPMETRICS-FORK.md

**What this repository is:** a fork of [maplibre-gl-js](https://github.com/maplibre/maplibre-gl-js),
published as `@mapmetrics/mapmetrics-gl`.

**What this document is for:** so that the next person who re-vendors upstream does not silently
drop a patch. It is not a changelog and not an upgrade plan. It is the list of things this fork
changed, how to prove each one is still present, and which ones fail *without turning anything red*.

Both sibling SDK repos already carry a manifest like this one — `Native-MapMetrics-iOS-SDK` and
`mapmetrics-native-sdk` — and they carry it because a re-vendor there dropped a cookie jar and
regressed billing by roughly 200x without a single failing test. `mapmetrics-gl` had no equivalent
document until this one. Treat that as the reason to keep it current, not as history.

Accurate as of `@mapmetrics/mapmetrics-gl` **1.0.0**. If you change a patch, change its marker here
in the same commit.

---

## 1. Fork base

> **Upstream `v5.2.0`, tagged 2025-03-03. Confidence ~95%.**

The fork's history is flattened — 46 commits, root `70ffb2c "mapmetrics-gl npm library"`, no shared
history and no merge base with upstream, so `git diff upstream/main` is not available. The base was
recovered from content instead, by three independent lines of evidence that agree:

**(a) Dependency bracket.** `package.json` pins `@maplibre/maplibre-gl-style-spec: ^23.1.0`. Walking
each upstream v5 tag's own pin: v5.0.0 → `^22.0.1`, v5.0.1 → `^23.0.0`, **v5.1.0–v5.4.0 → `^23.1.0`**,
v5.5.0 → `^23.2.2`, v5.6.0+ → `^23.3.0` and later. That brackets the base to `[v5.1.0, v5.4.0]`.

**(b) File-count fingerprint.** The fork's root commit has exactly **527** files under `src/`.
Upstream: v5.0.1–v5.3.0 = 527, v5.3.1 = 528, v5.4.0 = 529, v5.5.0 = 531. Narrows to `[v5.1.0, v5.3.0]`.

**(c) Blob-identity bisect.** Counting how many of the fork's 527 root-commit `src/` blob hashes
appear byte-identically in each upstream tag:

| tag | identical blobs (of 527) |
|---|---|
| v5.0.1 | 452 |
| v5.1.0 | 454 |
| v5.1.1 | 465 |
| **v5.2.0** | **469** ← single clear peak |
| v5.3.0 | 455 |
| v5.3.1 | 454 |
| v5.4.0 | 423 |
| v5.5.0 | 411 |

A finer per-commit sweep over the 51 commits in `v5.1.1..v5.3.0` shows a plateau at 469 that includes
the `v5.2.0` tag commit itself — so this is a clean tag, not a mid-release snapshot.

**(d) Residual audit.** Extracting the fork's root `src/` and `v5.2.0`'s `src/`, applying a mechanical
MapMetrics→MapLibre rename to both paths and contents, leaves only 28 differing files out of 527 — and
those differ almost entirely by stripped doc comments and quote style.

### 1.1 The vendor drop was reformatted on arrival — this is the important part

The drop was **not** a pristine copy. Before any MapMetrics feature work, someone ran Prettier across
the tree (double quotes, trailing commas, different line wrapping) and stripped TSDoc block comments
tree-wide. Two files — `src/geo/lng_lat.ts` and `src/util/create_tile_mesh.ts` — differ from upstream
by *only* removed doc comments, with zero semantic tokens changed.

**Consequence: a naive `diff` against upstream produces roughly 4,000 lines of pure noise — about 80%
of the apparent divergence.** That is the mechanism by which real patches get lost. Anyone who
eyeballs a raw diff during a re-vendor will drown in formatting churn and miss the 22 files that
actually matter. Every count in section 2 is a *semantic* diff: comment-stripped, quote-normalised,
whitespace-collapsed, compared at token level. Do not substitute a raw diff for it.

### 1.2 The rename script exists nowhere in this repo

The fork applies a tree-wide mechanical rename — `maplibre`→`mapmetrics`, `maplibregl`→`mapmetricsgl`,
`MapLibre`→`MapMetrics`/`Mapmetrics` — across file paths, CSS class names, SVG filenames, doc comments
and error strings.

**That script is not committed anywhere.** Each re-vendor therefore reinvents it, and the last one was
partly done by hand: upstream's `maplibregl-ctrl-globe.svg` became `mapmetricsgl-globe.svg`, which is
a *shape* change, not a prefix swap, and no mechanical rename would produce it. Committing the script
should be part of the next re-vendor.

---

## 2. Inventory of the divergence

**43 paths differ from upstream: 8 are new files, 22 carry real semantic change, and 17 differ with
zero semantic change** (Prettier and stripped comments only).

### 2.1 New files — copy across wholesale, nothing to replay

| Path | Size | Load-bearing? |
|---|---|---|
| `src/util/map_session.ts` | ~733 lines | **YES — billing.** The v2 map-session singleton. |
| `src/util/map_session.test.ts` | ~557 lines | The only real regression net on billing. Keep green. |
| `src/util/mapmetrics_hosts.ts` | ~108 lines | **YES — billing + security.** Added after the 0.6.0 audit; see §2.2. |
| `src/util/mapmetrics_hosts.test.ts` | — | Guards the host predicate, including the substring-match attacks. |
| `src/ui/handler/tile_loading_manager.ts` | ~365 lines | UX — zoom-out tile gating. |
| `src/seo/**` | 36 files | Product feature (SEO/AEO). Self-contained. |
| `src/geo/geojson-rewind/index.ts` | ~44 lines | Vendored from `@mapbox/geojson-rewind`. |
| `src/style/mapmetrics-style.json` | ~10,862 lines | Bundled default style. Re-validate against the target style-spec version on every upgrade. |
| `src/css/svg/mapmetricsgl-globe.svg` | — | Renamed from upstream `maplibregl-ctrl-globe.svg`. **Filename shape changed** — a mechanical rename will miss it. |

`src/util/mapmetrics_hosts.ts` deserves a note. In 0.6.0 the "is this one of our gateways?" rule was
copy-pasted into four files — `util/ajax.ts`, `source/worker.ts`, `source/vector_tile_worker_source.ts`
and `util/image_request.ts` — each with a *different* host list, two of which named hosts that did not
resolve and therefore never fired. It was also written as `url.includes('mapmetrics.org')`, which
matched any attacker URL merely *containing* the string (`https://attacker.example/?next=gateway.mapmetrics.org`)
and would hand it the session cookie. The predicate is now whole-hostname, in one place. **Widening it
leaks a user's session to a third-party host; narrowing it silently un-authenticates tiles.** Change
the list there and nowhere else.

### 2.2 Real patches to upstream files — billing / auth critical

| File | Δ tokens | What MapMetrics changed |
|---|---|---|
| `src/util/ajax.ts` | ~147 | `mapSessionHeaders` on `ExpiryData`; `collectMapSessionHeaders()` reading `X-Map-Session-Sig/Id/Exp/Ends/Key-Id`; `xhr.withCredentials` and fetch `credentials:'include'` gated through `isMapMetricsGatewayUrl`; the `isMapMetricsRequest` domain/path gate that also covers `/rtile/` and `/vector-tile/` while excluding `/fonts/`, `/basemaps-assets/fonts/`, `/styles/`, `/sprites/`. `makeFetchRequest` substantially rewritten. |
| `src/util/request_manager.ts` | ~14 | `transformRequest` rewritten so `mapSession.signUrl(params.url)` runs **after** any application-supplied `transformRequest` and cannot be clobbered by it. Return type tightened to `RequestParameters`. |
| `src/source/vector_tile_source.ts` | ~113 | `mapSession` inbound hook, plus the legacy v1 cookie-prefetch path. |
| `src/source/vector_tile_worker_source.ts` | ~28 | Forces gateway credentials, and plumbs `response.mapSessionHeaders` back through **both** `loadTile` and `reloadTile` into the cache-control payload. |
| `src/source/worker.ts` | ~30 | `loadTile`/`reloadTile` made async and forced to set `credentials:'include'`, `Accept: application/x-protobuf`, `type:'arrayBuffer'` for gateway hosts (fonts excluded). |
| `src/util/image_request.ts` | ~3 | Clears credentials for credential-exempt gateway assets (sprites/fonts) so they do not force a non-wildcard CORS preflight. |
| `src/source/source_cache.ts` | ~8 | Adds `hasErroredTiles()`; imports `expandTileCoverage`. |
| `src/ui/map.ts` | ~629 | `mapSession.addCredentialListener(() => this._reloadErroredTiles())` in the constructor; `_reloadErroredTiles()` **gated on `sourceCache.hasErroredTiles()`**; `_mapSessionUnsubscribe`. Plus non-billing: tile-grid overlay, `SeoManager` wiring, `_markers` registry, `tileLoadingManager`, `showTileGrids`, mandatory attribution control. |
| `src/index.ts` | ~8 | Exports `configureMapSession()` and the `mapSession` singleton; re-exports `MapSessionOptions`. The entire public entry point to billing. |

### 2.3 Real patches — product / UX / branding

| File | Δ | What changed |
|---|---|---|
| `src/geo/projection/covering_tiles.ts` | ~69 | `expandTileCoverage(tiles, bufferSize)` — pads coverage with neighbours for smoother pan/zoom. Affects tile volume, so it affects cost. |
| `src/ui/handler/scroll_zoom.ts` | ~65 | `defaultZoomRate` **1/100 → 1/1000**, `wheelZoomRate` 1/450 → 1/1000, `maxScalePerFrame` 2 → 2.2; wheel zoom-out defers via `waitForZoomOutTiles(zoom, 500)`. |
| `src/ui/control/navigation_control.ts` | ~63 | `_handleZoomOut` gates the button on `waitForZoomOutTiles(target, 300)`, disabling it meanwhile. |
| `src/ui/handler/keyboard.ts` | ~24 | `cameraAnimation` async; zoom-out awaits `waitForZoomOutTiles(target, 4000)`. |
| `src/ui/handler/tap_zoom.ts` | ~29 | Same pattern, 4000 ms. |
| `src/ui/handler/click_zoom.ts` | ~25 | Same pattern, 3500 ms; fallback uses an 1800 ms ease. |
| `src/ui/marker.ts` | ~69 | `map._addMarker(this)` / `this._map._removeMarker(this)` — the SEO marker registry hook. Everything else in the file is Prettier noise. |
| `src/ui/control/attribution_control.ts` | ~10 | Dedup compares tag-stripped text; compact behaviour starts collapsed rather than forced open. |
| `src/ui/control/logo_control.ts` | ~8 | Defaults `{compact: false, ...options}`; compact only when explicitly `true` (removes upstream's ≤640 px auto-compact). Branding. |
| `src/render/glyph_manager.ts` | ~2 | `@mapbox/tiny-sdf` → **`@mapmetrics/tiny-sdf`**. A dependency swap hiding in a one-line import. |
| `src/css/mapmetrics-gl.css` | ~49 | Attribution and branding styles. |
| `src/css/svg/mapmetricsgl-ctrl-logo.svg` | ~77 | MapMetrics logo. Branding. |
| `src/css/svg/mapmetricsgl-ctrl-attrib.svg` | ~2 | Attribution "i" icon. Branding. |
| `src/style/style.test.ts` | ~66 | Test adjustments. |
| `src/source/source_cache.test.ts` | ~18 | Tests for `hasErroredTiles()`. |

### 2.4 Files that differ with ZERO semantic change — take from upstream wholesale

Do **not** hand-merge these. Take the upstream version, apply the rename, done. Hand-merging them is
how a real patch elsewhere gets lost in the noise.

`src/style/style.ts`, `src/ui/camera.ts`, `src/ui/popup.ts`, `src/ui/events.ts`,
`src/source/geojson_source.ts`, `src/source/query_features.ts`, `src/source/raster_tile_source.ts`,
`src/source/raster_dem_tile_source.ts`, `src/source/image_source.ts`, `src/source/video_source.ts`,
`src/source/source.ts`, `src/ui/control/control.ts`, `src/geo/lng_lat.ts`,
`src/util/create_tile_mesh.ts`, `src/util/vectortile_to_geojson.ts`, `src/shaders/README.md`,
`src/shaders/atmosphere.fragment.glsl`.

---

## 3. ⚠️ These fail SILENTLY if dropped

**This is the most important section of this document.**

Every item below shares one property: **if a re-vendor drops it, the SDK still compiles, still
type-checks, still renders a correct-looking map, and no test in the suite turns red — while revenue
is lost, auth is broken, or a licence obligation is quietly removed.** Ranked by blast radius.

| # | Divergence | If silently dropped |
|---|---|---|
| **1** | `request_manager.ts` — `params.url = mapSession.signUrl(params.url)` | **Every tile request goes out unsigned.** The mapSession module is *designed* to be inert until `configureMapSession()` is called, so nothing throws. Tiles fall back to the v1 `?token=` path — billing per tile instead of per 30-minute window, the same ~200x class of regression seen on Android — or 401 and silently re-request. Renders fine either way. |
| **2** | `index.ts` — `configureMapSession` / `mapSession` exports | The public entry point to billing disappears. An integrator's `configureMapSession({apiKey})` becomes `undefined is not a function` **in their code, not ours**, so it arrives as a customer bug report weeks later rather than a build failure. Meanwhile every map on that integration bills on the v1 path. |
| **3** | `ajax.ts` — `collectMapSessionHeaders` + `mapSessionHeaders` on `ExpiryData` | The rollover `X-Map-Session-*` headers never reach the main thread. **Since the client-side renewal timer was removed this is the ONLY path by which the credential is ever replaced**, so losing it strands the SDK on a credential that never changes for the life of the page. The map keeps working and shows no symptom: every tile past the first window is served by a gateway rollover the client never learns about. |
| **4** | `vector_tile_worker_source.ts` — plumbing `response.mapSessionHeaders` through `loadTile` **and** `reloadTile` | Same failure as #3, from the other side of the worker boundary. **Both halves must survive — dropping either one alone produces identical, silent over-billing.** |
| **5** | `source_cache.hasErroredTiles()` **and** the `map.ts` gate on it | Note the direction: the gate is what *prevents* a full-viewport re-download on **every** 30-minute renewal. Lose the gate — or lose `hasErroredTiles` and "fix" the compile error by reverting to an unconditional `reload(true)` — and the entire viewport is re-fetched twice an hour, on cellular, for a navigation client. Pure cost, zero visible symptom. Losing the *whole* mechanism instead is subtler but visible: errored tiles never recover after a credential adoption. |
| **6** | `map.ts` — `mapSession.addCredentialListener(...)` in the constructor | Credentials are adopted but nothing nudges errored tiles. Cold start leaves a partially blank map that "fixes itself" on the next pan; the give-up/recovery path never recovers. Renders *almost* fine. |
| **7** | `ajax.ts` — the `isMapMetricsRequest` gate and `credentials:'include'` | Cookie-based v1 credentials stop being sent; every legacy-path tile 401s or bills as anonymous. The gate's **exclusions** (`/fonts/`, `/basemaps-assets/fonts/`, `/styles/`, `/sprites/`) are load-bearing in the opposite direction: re-adding credentials to those paths breaks CORS and blanks the map. That failure at least is loud. |
| **8** | `worker.ts` — `shouldForceGatewayCredentials` in `loadTile`/`reloadTile` | Worker-thread tile fetches go out without cookies. Same silent class as #7. Upstream #7451 (`makeRequest` usable in workers) may make this patch unnecessary after an upgrade — **verify, do not assume**, and if it is redundant delete it deliberately with a note rather than leaving both. |
| **9** | `marker.ts` — `_addMarker` / `_removeMarker` | The SEO marker registry never populates. Markers still render perfectly. The SEO/AEO feature — the entire reason `src/seo/` exists — emits nothing, and no test covers the wiring. |
| **10** | `scroll_zoom.ts` — `defaultZoomRate` 1/100 → **1/1000** (and `wheelZoomRate` → 1/1000) | Deliberate, tuned, and completely invisible if reverted. Zoom simply feels 10x twitchier than it was designed to. Nobody diffs a constant. |
| **11** | `glyph_manager.ts` — `@mapmetrics/tiny-sdf` | A one-line import. Reverting swaps a MapMetrics-controlled dependency back to `@mapbox/tiny-sdf` — a supply-chain and licence change hiding inside a rename diff. |
| **12** | The non-removable attribution (`map.ts` `defaultAttributionControlOptions` merge, `attribution_control.ts`, `logo_control.ts`) | Not billing — **licence and contractual.** Commit `932a7cf` exists specifically so consumers cannot strip the attribution: `attributionControl: false` is coerced back to the defaults rather than honoured. A re-vendor restores upstream's removable attribution and nobody notices until someone ships a MapMetrics-free-looking map. |

Items 1–8 break **billing or auth** rather than rendering. Items 1, 2, 3, 4 and 5 lose money with
*no visible symptom whatsoever*.

---

## 4. Grep markers — one per patch

Run these after a re-vendor. Each must return at least the stated count. They are ugly and
mechanical, and that is the point: ten lines of `grep` in a test file beats any amount of code
review, because grep does not get tired at file 400 of a 624-file diff. Automate them as a test.

Verified against 1.0.0. Counts are minimums unless marked exact.

### Phase 1 — new files present

| # | Marker | Expect |
|---|---|---|
| 1 | `grep -c 'export class MapSession' src/util/map_session.ts` | 1 |
| 2 | `src/util/map_session.test.ts` runs, all green | — |
| 3 | `grep -c 'MAPMETRICS_GATEWAY_HOSTS' src/util/mapmetrics_hosts.ts` | ≥1 |
| 4 | `grep -c 'gateway.mapmetrics-atlas.net' src/util/mapmetrics_hosts.ts` | ≥1 |
| 5 | `grep -c 'waitForZoomOutTiles' src/ui/handler/tile_loading_manager.ts` | ≥1 |
| 6 | `find src/seo -type f \| wc -l` | 36 |
| 7 | `src/geo/geojson-rewind/index.ts` present | — |
| 8 | `src/style/mapmetrics-style.json` present **and re-validated against the target style-spec version** | — |
| 9 | `src/css/svg/mapmetricsgl-globe.svg` present | — |

### Phase 2 — billing / auth patches

Replay these before anything else; each is a merge gate, and order matters — `map_session` must exist
before its consumers.

| # | Marker | Expect |
|---|---|---|
| 10 | `grep -c 'collectMapSessionHeaders' src/util/ajax.ts` | ≥1 |
| 11 | `grep -c 'mapSessionHeaders' src/util/ajax.ts` | ≥1 |
| 12 | `grep -c 'isMapMetricsGatewayUrl' src/util/ajax.ts` | ≥3 |
| 13 | `grep -c "/rtile/\|/vector-tile/" src/util/ajax.ts` | ≥1 |
| 14 | `grep -c 'basemaps-assets/fonts' src/util/ajax.ts` | ≥1 *(the exclusion list must survive too)* |
| 15 | `grep -c 'mapSession.signUrl' src/util/request_manager.ts` | ≥1 |
| 16 | `grep -c 'mapSessionHeaders' src/source/vector_tile_worker_source.ts` | **exactly 2** — both halves |
| 17 | `grep -c 'mapSession' src/source/vector_tile_source.ts` | ≥1 |
| 18 | `grep -c 'shouldForceGatewayCredentials' src/source/worker.ts` | ≥2 *(or a written note that upstream #7451 made it redundant)* |
| 19 | `grep -c 'isCredentialExemptUrl' src/util/image_request.ts` | ≥1 |
| 20 | `grep -c 'hasErroredTiles' src/source/source_cache.ts` | ≥1 |
| 21 | `grep -c 'addCredentialListener' src/ui/map.ts` | ≥1 |
| 22 | `grep -c 'hasErroredTiles' src/ui/map.ts` | ≥1 — **the gate. Not an unconditional `reload(true)`.** |
| 23 | `grep -c 'configureMapSession' src/index.ts` | ≥1 |
| 24 | `grep -c 'mapSession' src/index.ts` | ≥1 |

### Phase 3 — product / UX / branding patches

| # | Marker | Expect |
|---|---|---|
| 25 | `grep -c 'export function expandTileCoverage' src/geo/projection/covering_tiles.ts` | 1 |
| 26 | `grep -c 'defaultZoomRate = 1 / 1000' src/ui/handler/scroll_zoom.ts` | 1 — **not `1 / 100`** |
| 27 | `grep -c 'waitForZoomOutTiles' src/ui/handler/scroll_zoom.ts` | ≥1 |
| 28 | `grep -c '_handleZoomOut' src/ui/control/navigation_control.ts` | ≥1 |
| 29 | `grep -c 'waitForZoomOutTiles' src/ui/handler/keyboard.ts` | ≥1 |
| 30 | `grep -c 'waitForZoomOutTiles' src/ui/handler/tap_zoom.ts` | ≥1 |
| 31 | `grep -c 'waitForZoomOutTiles' src/ui/handler/click_zoom.ts` | ≥1 |
| 32 | `grep -c 'tileLoadingManager' src/ui/map.ts` | ≥1 |
| 33 | `grep -c 'mapmetricsgl-tile-grid-container' src/ui/map.ts` | ≥1 |
| 34 | `grep -c 'SeoManager' src/ui/map.ts` | ≥1 |
| 35 | `grep -c '_addMarker\|_removeMarker' src/ui/marker.ts` | ≥2 |
| 36 | `grep -c 'defaultAttributionControlOptions' src/ui/map.ts` | ≥2 — the non-removable attribution |
| 37 | `grep -c 'customAttribution' src/ui/control/attribution_control.ts` | ≥1 |
| 38 | `grep -c 'compact: false' src/ui/control/logo_control.ts` | ≥1 |
| 39 | `grep -c '@mapmetrics/tiny-sdf' src/render/glyph_manager.ts` | 1 |
| 40 | `mapmetricsgl-ctrl-logo.svg`, `mapmetricsgl-ctrl-attrib.svg` present and MapMetrics-branded | — |

---

## 5. The verification gate a re-vendor must pass

Run all of it. In order. A re-vendor is not done until every line passes.

```bash
npm install          # or pnpm install — see the note below
npx tsc --noEmit     # must be clean
npm run lint         # must be 0 problems
npm run test-unit    # must be 0 failing (vitest needs --config vitest.config.unit.ts;
                     # a bare `npx vitest run` picks the wrong config and looks broken)
npm run build-dist
npm run test-build

# The build produced files. Prove they are actually JavaScript:
node --check dist/mapmetrics-gl.js
node --check dist/mapmetrics-gl-csp.js
for f in dist/*.js; do node --check "$f" || echo "UNPARSEABLE: $f"; done

# Prove the billing entry point survived minification into the shipped bundle:
grep -c 'configureMapSession' dist/mapmetrics-gl.js      # must be ≥1
grep -c 'mapSession' dist/mapmetrics-gl.js               # must be ≥1
```

The last two blocks are not paranoia. **0.6.0 shipped CSP bundles that began with the literal string
`[object Object]`** — completely unparseable, dead on arrival — because minification had been disabled
and nothing in the pipeline ever parsed the build output. Every other gate was green. `tsc` was clean,
lint was clean, the unit suite passed, the build "succeeded", and the artefact was garbage. A build
that emits a file is not evidence that the file runs.

The `grep` on `dist/` is the same argument one layer up: `test-unit` runs against `src/`, so it cannot
tell you that the public billing entry point survived bundling and minification. Section 3 item 2 is
exactly that failure, and it surfaces in a customer's console, not ours.

**Install note.** This repo is a pnpm project (`packageManager: pnpm@10.6.2`). Plain `npm install`
currently fails on a `typedoc` / `typedoc-plugin-markdown` peer conflict and needs `--legacy-peer-deps`.
Prefer `pnpm install`. If the lockfile has drifted, `pnpm install --no-frozen-lockfile` will fix it —
but check whether the resulting `pnpm-lock.yaml` change belongs in your commit before you stage it.

### Beyond the mechanical gate

Grep proves a patch is *present*. It cannot prove it is *connected*. For the billing patches
specifically, the following are what actually demonstrate no regression, in increasing order of
authority:

- `src/util/map_session.test.ts` fully green. It encodes the invariants carried over from the mobile
  ports and is the highest-value test asset in this repo. If a re-vendor makes it fail, stop.
- A fake-gateway integration test (msw or a local HTTP server): drive a `Map` through cold start →
  tile load → a forced 30-minute rollover, and assert that every tile GET carries the signing params,
  that there is **exactly one** session POST for the whole run — the cold-start create, because there
  is no client-side renewal timer any more and every later window is bought by gateway rollover on a
  tile response — and that the tile count immediately after a rollover is near zero rather than a full
  viewport. That last assertion is the `hasErroredTiles` gate, and it is the one a human reviewer will
  never spot.
- **A staging soak with real gateway billing counters: run one map continuously for ≥90 minutes —
  three credential windows — and read the billed-map-load counter. Expect 3.** This is the only check
  that would have caught the Android regression, and nothing else substitutes for it. Run the same
  span again with the map IDLE and expect 0: with the timer gone that is structural rather than a
  gate, because a map that requests no tiles gives the gateway nothing to roll over.
- Confirm the `X-Map-Session-*` response headers still reach the main thread through the worker
  boundary. `Access-Control-Expose-Headers` is a gateway-side dependency that a purely client-side
  refactor can silently orphan.
