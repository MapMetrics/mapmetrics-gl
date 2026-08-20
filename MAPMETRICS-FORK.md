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

Accurate as of `@mapmetrics/mapmetrics-gl` **1.0.0**, re-vendored onto upstream **v5.24.0**.
If you change a patch, change its marker here in the same commit.

> **Run `bash build/revendor/check-markers.sh`** after any re-vendor. It is the mechanised form of
> §4 and it is cheap. It is NOT sufficient on its own — see §3 item 13, which grep cannot see.

---

## 1. Fork base

> **Upstream `v5.24.0` (`fd31bd859`), re-vendored 2026-08.**
>
> Previously `v5.2.0` (`c238479fb`), recovered by content analysis — that reconstruction is kept
> below because it is the only record of how the base was established, and because the next
> re-vendor can now skip it entirely: the base is a known tag, not a guess.
>
> **v6.x is deliberately NOT a target.** It is ESM-only and deletes the UMD bundle that
> `package.json` `main` and the README's unpkg `<script src>` both depend on.

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

### 1.2 The rename script — now committed at `build/revendor/rename.py`

The fork applies a tree-wide mechanical rename — `maplibre`→`mapmetrics`, `maplibregl`→`mapmetricsgl`,
`MapLibre`→`MapMetrics`/`Mapmetrics` — across file paths, CSS class names, SVG filenames, doc comments
and error strings.

**It is committed now**, at `build/revendor/rename.py`, along with `build/revendor/normdiff.py` (the
normalising differ §1.1 demands) and `build/revendor/check-markers.sh`.

Two corrections to what this section used to say:

* `mapmetricsgl-globe.svg` was **not** a "shape change no mechanical rename would produce". The fork
  carried BOTH it and `mapmetricsgl-ctrl-globe.svg`, byte-identical; the CSS `@svg-load`s the *ctrl*
  one and nothing referenced the other. It was dead weight and **has been deleted**. Marker 9 used to
  check the dead file; it now checks the live one.
* The script had two silent bugs, fixed at the v5.24.0 re-vendor, and both are worth knowing about
  because both fail *quietly*:
  1. Its exemption list wrapped protected text in sentinels that still contained the string
     `maplibre`, so the exemptions never fired. Every upstream `https://maplibre.org/...` doc link
     was being rewritten to a `mapmetrics.org` URL that 404s, and v5.24.0's new `@maplibre/vt-pbf`,
     `@maplibre/geojson-vt` and `@maplibre/mlt` packages were renamed into `@mapmetrics/*` packages
     that do not exist. Placeholders are opaque now, and the npm exemption matches `@maplibre/*`
     as a pattern rather than one hard-coded package.
     **The fork keeps upstream doc URLs**: measured, 76 `maplibre.org` links against 3
     `mapmetrics.org` ones, and the latter are the brand homepage.
  2. Running it over `build/` walked into `build/revendor/` and renamed *the script itself*, turning
     `rename_path` into `replace('mapmetricsgl', 'mapmetricsgl')` — a no-op. `revendor` is in
     `SKIP_DIRS` now. Passing a single file also used to silently do nothing (`os.walk` on a file
     yields nothing); it is handled explicitly.

---

## 2. Inventory of the divergence

**8 new files, 26 carrying real semantic change, and 15 differing with zero semantic change**
(Prettier and stripped comments only).

> Corrected at the v5.24.0 re-vendor. This used to read "22 real patches / 17 zero-change", but §2.2
> and §2.3 tabulate 9 + 15 = **24** rows, not 22 — and two of the files filed under §2.4
> "zero semantic change" turned out to carry real patches (`source.ts`, U3 below). `events.ts` was
> the other, and it was the opposite problem: a *deletion*. Plus `dom.ts` / `dom.test.ts`, which the
> document did not mention at all. **Count the tables, not the prose.**

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
| ~~`src/css/svg/mapmetricsgl-globe.svg`~~ | — | **DELETED at the v5.24.0 re-vendor.** A byte-identical, entirely unreferenced duplicate of `mapmetricsgl-ctrl-globe.svg` (which the CSS actually `@svg-load`s, and which the plain prefix swap produces correctly). It was never a "shape change". |

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
| `src/util/request_manager.ts` | ~14 | **`async`**, and it `await`s the application callback. `mapSession.signUrl(params.url)` runs **after** any application-supplied `transformRequest` and cannot be clobbered by it. Return type is `Promise<RequestParameters>`. **See §3 item 13 — dropping the `await` is silent and grep cannot see it.** |
| `src/source/vector_tile_source.ts` | ~113 | `mapSession` inbound hook, plus the legacy v1 cookie-prefetch path. |
| `src/source/vector_tile_worker_source.ts` | ~28 | Plumbs `response.mapSessionHeaders` back to the main thread. Since v5.24.0 this is **one line in `_getExpiryData`**, next to upstream's `etag`: upstream built exactly this response-header→main-thread channel for its own reasons, and the fork now follows it instead of hand-patching the `loadTile` and `reloadTile` halves separately. The single choke point also covers the etag-unmodified path, which the two-half version missed. |
| `src/source/worker.ts` | ~30 | `loadTile`/`reloadTile` made async and routed through one shared `forceGatewayTileRequest()` helper that sets `credentials:'include'`, `Accept: application/x-protobuf` and `type:'arrayBuffer'` for gateway hosts (fonts/sprites excluded). One helper, not two copies, so the halves cannot drift. **NOT made redundant by upstream #7451 — verified, see §3 item 8.** |
| `src/util/image_request.ts` | ~3 | Clears credentials for credential-exempt gateway assets (sprites/fonts) so they do not force a non-wildcard CORS preflight. |
| `src/tile/tile_manager.ts` | ~8 | Adds `hasErroredTiles()`. **Moved**: upstream #6635 dissolved `SourceCache` into `TileManager`, so `this._tiles` became `this._inViewTiles.getAllTiles()`. |
| `src/ui/map.ts` | ~629 | `mapSession.addCredentialListener(() => this._reloadErroredTiles())` in the constructor; `_reloadErroredTiles()` **gated on `tileManager.hasErroredTiles()`** (`style.sourceCaches` became `style.tileManagers` in #6635); `_mapSessionUnsubscribe`. Plus non-billing: tile-grid overlay, `SeoManager` wiring, `_markers` registry, `tileLoadingManager`, `showTileGrids`, mandatory attribution control. |
| `src/index.ts` | ~8 | Exports `configureMapSession()` and the `mapSession` singleton; re-exports `MapSessionOptions`. The entire public entry point to billing. |

### 2.3 Real patches — product / UX / branding

| File | Δ | What changed |
|---|---|---|
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
| `src/tile/tile_manager.test.ts` | ~18 | Tests for `hasErroredTiles()`. **Re-created here**: upstream #6635 deleted `source_cache.test.ts` (2,127 lines) outright, so these had no file to land on. They are the only automated evidence for §3 item 5. |
| `src/util/dom.ts` | ~2 | **Security.** `DOM.removeAttributes` snapshots the live `NamedNodeMap` via `Array.from(...)` before mutating it. Upstream PR **#8189**, fixed upstream in v6.4.1 and **NOT present in v5.24.0** — so it must be replayed, and there is no double-apply risk. |
| `src/util/dom.test.ts` | ~18 | The two regression tests for the above. They are specifically about *adjacency*: a single dangerous attribute was always removed correctly, which is why every other test in that file passed with the bug present. |

### 2.4 Files that differ with ZERO semantic change — take from upstream wholesale

Do **not** hand-merge these. Take the upstream version, apply the rename, done. Hand-merging them is
how a real patch elsewhere gets lost in the noise.

`src/style/style.ts`, `src/ui/camera.ts`, `src/ui/popup.ts`,
`src/source/geojson_source.ts`, `src/source/query_features.ts`, `src/source/raster_tile_source.ts`,
`src/source/raster_dem_tile_source.ts`, `src/source/image_source.ts`, `src/source/video_source.ts`,
`src/ui/control/control.ts`, `src/geo/lng_lat.ts`,
`src/util/create_tile_mesh.ts`, `src/util/vectortile_to_geojson.ts`, `src/shaders/README.md`,
`src/shaders/glsl/atmosphere.fragment.glsl`.

**Two files were removed from this list at the v5.24.0 re-vendor, and the reasons are opposite:**

  here was the exact failure mode this section warns about, inverted. A hand-merger who takes
  upstream's file and then meets a compile error in `covering_tiles.ts` will be tempted to "fix" it by
  deleting the feature.
* `src/ui/events.ts` — the fork's `MapEventType` was **missing** upstream's `dataabort`,
  `sourcedataabort`, `boxzoomstart`, `boxzoomend` and `touchcancel`. That was an accidental deletion
  in an earlier vendor drop, not a feature: nothing in `src/` referenced the removal.
  **Upstream's version was taken and the five event types are back.**

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
| **4** | `vector_tile_worker_source.ts` — plumbing `response.mapSessionHeaders` to the main thread | Same failure as #3, from the other side of the worker boundary. Since v5.24.0 this is **one line in `_getExpiryData`**, riding upstream's `etag` channel, so there is a single place to lose rather than two. Lose it and every rollover credential is dropped on the floor. |
| **5** | `tile_manager.hasErroredTiles()` **and** the `map.ts` gate on it (was `source_cache`; moved by upstream #6635) | Note the direction: the gate is what *prevents* a full-viewport re-download on **every** 30-minute renewal. Lose the gate — or lose `hasErroredTiles` and "fix" the compile error by reverting to an unconditional `reload(true)` — and the entire viewport is re-fetched twice an hour, on cellular, for a navigation client. Pure cost, zero visible symptom. Losing the *whole* mechanism instead is subtler but visible: errored tiles never recover after a credential adoption. |
| **6** | `map.ts` — `mapSession.addCredentialListener(...)` in the constructor | Credentials are adopted but nothing nudges errored tiles. Cold start leaves a partially blank map that "fixes itself" on the next pan; the give-up/recovery path never recovers. Renders *almost* fine. |
| **7** | `ajax.ts` — the `isMapMetricsRequest` gate and `credentials:'include'` | Cookie-based v1 credentials stop being sent; every legacy-path tile 401s or bills as anonymous. The gate's **exclusions** (`/fonts/`, `/basemaps-assets/fonts/`, `/styles/`, `/sprites/`) are load-bearing in the opposite direction: re-adding credentials to those paths breaks CORS and blanks the map. That failure at least is loud. |
| **8** | `worker.ts` — `forceGatewayTileRequest()` in `loadTile`/`reloadTile` | Worker-thread tile fetches go out without cookies. Same silent class as #7. **The #7451 question is now CLOSED: it does not make this redundant.** Verified against v5.24.0 — #7451 assigns `self.makeRequest` so third-party worker code (custom protocols, plugins) can issue requests, and touches nothing about credentials, `Accept` or request type. Do not re-litigate this. (An old inline comment claimed `type:'arrayBuffer'` "forces XMLHttpRequest"; that was never true in any version — `makeRequest` prefers `fetch` whenever it exists. The line still matters, for how the body is parsed. The comment is corrected in place.) |
| **9** | `marker.ts` — `_addMarker` / `_removeMarker` | The SEO marker registry never populates. Markers still render perfectly. The SEO/AEO feature — the entire reason `src/seo/` exists — emits nothing, and no test covers the wiring. |
| **10** | `scroll_zoom.ts` — `defaultZoomRate` 1/100 → **1/1000** (and `wheelZoomRate` → 1/1000) | Deliberate, tuned, and completely invisible if reverted. Zoom simply feels 10x twitchier than it was designed to. Nobody diffs a constant. |
| **11** | `glyph_manager.ts` — `@mapmetrics/tiny-sdf` | A one-line import. Reverting swaps a MapMetrics-controlled dependency back to `@mapbox/tiny-sdf` — a supply-chain and licence change hiding inside a rename diff. |
| **12** | The non-removable attribution (`map.ts` `defaultAttributionControlOptions` merge, `attribution_control.ts`, `logo_control.ts`) | Not billing — **licence and contractual.** Commit `932a7cf` exists specifically so consumers cannot strip the attribution: `attributionControl: false` is coerced back to the defaults rather than honoured. A re-vendor restores upstream's removable attribution and nobody notices until someone ships a MapMetrics-free-looking map. |

| **13** | `request_manager.ts` — `transformRequest` being **`async`**, and the **`await`** on the application callback | **THIS ONE HAS NO MARKER, AND CANNOT HAVE ONE.** Upstream #7184 lets an application's `transformRequest` return a Promise. If someone "simplifies" this back to the synchronous form, then for any integrator using an async callback `params` is a `Promise`, `params.url` is `undefined`, `signUrl(undefined)` returns undefined, and the signed value is written to an **expando property on the Promise object**. The URL actually requested is whatever the promise resolves to — **unsigned**. Nothing throws. The map renders perfectly. And **grep marker 15 (`mapSession.signUrl` present) passes on the broken version**, because the call is still there; it is just writing to the wrong object. Measured, not theorised: removing the `await` leaves marker 15 returning 2 while every tile ships unsigned. The nets are **marker 44** (the test exists) and the test itself, `map_session.test.ts` → 'awaits an async transformRequest before signing'. `tsc` also catches it *only because* the return type is explicitly `Promise<RequestParameters>` — drop the annotation too and it goes quiet again. |
| **14** | `dom.ts` — `Array.from(elem.attributes)` in `removeAttributes` | **A security bug, and it is invisible.** `elem.attributes` is a live `NamedNodeMap`: removing one attribute shifts the next into an index the iterator has already passed, so **a dangerous attribute adjacent to another dangerous one survives sanitisation and executes**. A single dangerous attribute is always removed correctly, which is why the pre-existing tests all passed with the bug present. Upstream #8189, fixed upstream in v6.4.1 and **absent from v5.24.0** — so an upgrade does not bring it, and re-vendoring silently reverts it. |

Items 1–8 and 13 break **billing or auth** rather than rendering. Items 1, 2, 3, 4, 5 and 13 lose
money with *no visible symptom whatsoever*. Item 12 is a licence exposure and item 14 is an XSS.

---

### 3.1 ⚠️ BRANDING IS MANDATORY — and a grep marker CANNOT see it

`src/ui/map.ts` adds `LogoControl` **unconditionally**. `mapmetricsLogo` selects POSITION only,
never presence, and its default is irrelevant.

**This was lost in the v5.24.0 re-vendor and nothing caught it.** Upstream gates its own logo on the
equivalent option and defaults it to `false`; the re-vendor inherited that one word. The SVG shipped,
the CSS matched, `logo_control.ts` kept its patch, the option stayed declared, the control stayed
imported and wired — and **all 47 grep markers passed**. The only way to see it was to look at a map.

A marker cannot check a DEFAULT or an absent call. Two tests can, and both must survive a re-vendor:

| test | asserts |
|---|---|
| `src/ui/control/logo_control.test.ts` — `'appears by default'`, `'is STILL displayed when the mapmetricsLogo property is false'`, `'BRANDING IS NOT OPTIONAL'` | upstream's versions of the first two assert `toHaveLength(0)`. **They are deliberately inverted here.** Taking upstream's file wholesale silently restores opt-in branding. |
| `src/ui/map_tests/map_control.test.ts` — `DEFAULT_CONTROL_COUNT = 2` | upstream's value is different; the constant is the only evidence that both the mandatory attribution AND the mandatory logo are attached at `Map` level |

Mutation-verified 2026-08-20: re-gating the logo on `resolvedOptions.mapmetricsLogo` fails **5**
tests. Before these existed it failed none.

**The general lesson, and it applies beyond the logo:** grep markers verify that code is PRESENT.
They cannot verify that a default is correct, that a call is unconditional, or that anything happens
at all. Every patch whose whole effect is a default or a conditional needs a test, not a marker.

## 4. Grep markers — one per patch

Run these after a re-vendor. Each must return at least the stated count. They are ugly and
mechanical, and that is the point: ten lines of `grep` in a test file beats any amount of code
review, because grep does not get tired at file 400 of a 624-file diff. Automate them as a test.

Verified against 1.0.0 on upstream v5.24.0. Counts are minimums unless marked exact.

**They are mechanised: `bash build/revendor/check-markers.sh`. All 47 pass on this tree.**

### Phase 1 — new files present

| # | Marker | Expect |
|---|---|---|
| 1 | `grep -c 'export class MapSession' src/util/map_session.ts` | 1 |
| 2 | `src/util/map_session.test.ts` runs, all green | — |
| 3 | `grep -c 'MAPMETRICS_GATEWAY_HOSTS' src/util/mapmetrics_hosts.ts` | ≥1 |
| 4 | `grep -c 'gateway.mapmetrics-atlas.net' src/util/mapmetrics_hosts.ts` | ≥1 |
| 5 | `grep -c 'waitForZoomOutTiles' src/ui/handler/tile_loading_manager.ts` | ≥1 |
| 6 | `git ls-files src/seo \| wc -l` | 36 — **`git ls-files`, not `find`**: `src/seo/demo.ts` is present but untracked, so `find` returns 37 |
| 7 | `src/geo/geojson-rewind/index.ts` present | — |
| 8 | `src/style/mapmetrics-style.json` present **and re-validated against the target style-spec version** | — |
| 9 | `src/css/svg/mapmetricsgl-ctrl-globe.svg` present | — — this is the one the CSS `@svg-load`s. The old marker checked `mapmetricsgl-globe.svg`, a dead unreferenced duplicate, now **deleted** |

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
| 16 | `grep -c 'mapSessionHeaders' src/source/vector_tile_worker_source.ts` | **exactly 2** — the destructure and the assignment inside `_getExpiryData`. **NOT "both halves" any more**: v5.24.0 unified `loadTile`/`reloadTile` into that one helper. Still 2, but a *different* 2 — do not read the old wording and add a redundant third |
| 17 | `grep -c 'mapSession' src/source/vector_tile_source.ts` | ≥1 |
| 18 | `grep -c 'forceGatewayTileRequest' src/source/worker.ts` | **exactly 3** — one definition plus the `loadTile` and `reloadTile` call sites. #7451 does **not** make it redundant (§3 item 8, closed) |
| 19 | `grep -c 'isCredentialExemptUrl' src/util/image_request.ts` | ≥1 |
| 20 | `grep -c 'hasErroredTiles' src/tile/tile_manager.ts` | ≥1 — **moved**: upstream #6635 deleted `source_cache.ts` |
| 21 | `grep -c 'addCredentialListener' src/ui/map.ts` | ≥1 |
| 22 | `grep -c 'hasErroredTiles' src/ui/map.ts` | ≥1 — **the gate. Not an unconditional `reload(true)`.** |
| 23 | `grep -c 'configureMapSession' src/index.ts` | ≥1 |
| 24 | `grep -c 'mapSession' src/index.ts` | ≥1 |

### Phase 3 — product / UX / branding patches

| # | Marker | Expect |
|---|---|---|
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
| 39 | `grep -c "import TinySDF from '@mapmetrics/tiny-sdf'" src/render/glyph_manager.ts` | 1 — match the **import line**, not prose mentions |
| 40 | `mapmetricsgl-ctrl-logo.svg`, `mapmetricsgl-ctrl-attrib.svg` present and MapMetrics-branded | — |

### Phase 4 — added at the v5.24.0 re-vendor

| # | Marker | Expect |
|---|---|---|
| 41 | `grep -c 'Array.from(elem.attributes)' src/util/dom.ts` | 1 — the #8189 XSS fix (§3 item 14). **Absent from v5.24.0; an upgrade will not bring it** |
| 43 | `grep -c 'async transformRequest(url: string, type: ResourceType)' src/util/request_manager.ts` | 1 — **must be `async`** |
| 44 | `grep -c 'awaits an async transformRequest before signing' src/util/map_session.test.ts` | 1 — **the test must exist.** This marker proves the test is present; only the test itself proves the `await` is. See §3 item 13 |
| 45 | `grep -c 'hasErroredTiles' src/tile/tile_manager.test.ts` | ≥1 — re-created; `source_cache.test.ts` no longer exists upstream |
| 46 | `grep -c 'DEFAULT_CONTROL_COUNT' src/ui/map_tests/map_control.test.ts` | ≥1 — the last automated check on the non-removable attribution (§3 item 12) |
| 47 | `grep -c 'singleTickZoomDelta' src/ui/handler/scroll_zoom.test.ts` | ≥1 — guards the 1/1000 zoom retune (§3 item 10), which is otherwise invisible if reverted |
| 48 | `grep -c '_showTileGrids' src/ui/map.ts` | ≥2 — `showTileGrids` is actually read now; see §6 |

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

# Prove the billing entry point survived minification into the shipped bundle.
# Better than grep: LOAD it and read the exports, which also proves the bundle executes.
node --input-type=module -e "
import {JSDOM} from 'jsdom'; import fs from 'fs';
const w = new JSDOM('<!doctype html>', {pretendToBeVisual: true}).window;
w.URL.createObjectURL = () => 'blob:stub';
w.eval(fs.readFileSync('dist/mapmetrics-gl.js','utf8'));
for (const k of ['configureMapSession','mapSession','Map','addProtocol','setWorkerUrl'])
  console.log(k, w.mapmetricsgl?.[k] === undefined ? 'MISSING' : 'ok');
"

# And grep the BUILT bundle for the fails-silently markers that survive minification.
# Identifiers get mangled; STRING LITERALS do not, so match on those:
for s in 'x-map-session-sig' '/v2/map-sessions' 'gateway.mapmetrics-atlas.net' \
         'application/x-protobuf' '/rtile/' '/vector-tile/' 'basemaps-assets/fonts'; do
  printf '%-34s %s\n' "$s" "$(grep -c -- "$s" dist/mapmetrics-gl.js)"
done
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

### What the v5.24.0 re-vendor actually ran, and what it proved

`build/revendor/staging-billing-check.mjs` is committed for the next re-vendor to repeat. It loads
the **built** bundle in jsdom, shims `XMLHttpRequest` over `fetch` (the SDK routes gateway requests
through XHR, not fetch — see `makeRequest`'s `isMapMetricsRequest` gate), buys a real session against
staging, fetches tiles, and reads the meter. Credentials come from a path passed on the command line;
nothing is hardcoded.

Result on this tree: **12 tiles requested, 12 signed, 12 accepted (HTTP 200), meter +1.** One billed
map load for twelve tiles — per-window billing, not per-tile.

The negative control matters as much as the result: the same tile path **without** a signature
returns `401 {"error":"invalid map session","reason":"malformed"}`. So the twelve 200s are evidence
the signature was present and valid, not evidence the gateway waves everything through.

Two caveats, stated plainly rather than papered over:

* `RequestManager` is not on the public export surface and a real `Map` needs a WebGL context jsdom
  cannot provide, so the staging run exercises `mapSession.signUrl` — the same signing call
  `transformRequest` makes — rather than `transformRequest` itself. The **async composition** is
  proven separately and more precisely by the unit test (§3 item 13): with the `await` removed the
  test fails on an unsigned URL while marker 15 still passes.
* This was a single-window run, not the ≥90-minute three-window soak described above. **That soak is
  still owed** and is the only thing that exercises gateway rollover end to end.

---

## 5.5 REMOVED — do NOT reinstate

| What | Why |
|---|---|
| `expandTileCoverage()` in `src/geo/projection/covering_tiles.ts`, and `expandTileCoverage?: number` on the source options type in `src/source/source.ts` | A fork feature that padded tile coverage with neighbouring tiles for smoother panning. **It was defined but NEVER CALLED** — no call site existed anywhere in `src/`. Removed 2026-08-20 by product decision. If a future re-vendor's normalised diff surfaces this as a "missing patch", it is not missing: it was deleted deliberately. Do not replay it. |

## 6. Known defects and open decisions, as of the v5.24.0 re-vendor

These are recorded rather than fixed silently. Each needs a human decision.

### 6.1 `@mapmetrics/tiny-sdf` is stuck at 0.0.1 and ignores upstream's `lang`

Upstream v5.24.0 pins `@mapbox/tiny-sdf@^2.1.0` and passes a **`lang`** option through
`GlyphManager._createTinySDF` for language-aware glyph rendering. `@mapmetrics/tiny-sdf` is published
only as **0.0.1**, forked from a much older tiny-sdf, and neither types nor reads `lang`.

The option is therefore passed and **ignored**, behind an explicit cast at the call site that exists
as a marker, not as a fix. This is a **feature gap, not a regression** — the fork never had `lang` —
but it means MapMetrics does not get upstream's language-aware rendering.

Reverting to `@mapbox/tiny-sdf` would resolve it and is **not** the right fix: §3 item 11 exists
because that dependency swap is a supply-chain and licence decision.
**Resolution: republish `@mapmetrics/tiny-sdf` from `@mapbox/tiny-sdf@2.x`, then delete the cast.**

### 6.2 `showTileGrids` was declared and never read — now it is honoured

`MapOptions.showTileGrids` was documented as `@defaultValue false` and then **never read anywhere**.
The whole tile-grid debug overlay ran on every map, and `_createDefaultBackgroundPattern()` injected
`background-pattern: grid-pulse-pattern` into the caller's style — so `map.getStyle()` no longer
round-tripped the style that was passed in. Upstream's `map_style.test.ts` catches this; the fork's
older copy of that test did not.

**Changed at this re-vendor: the option is now actually honoured** (`Map._showTileGrids`, marker 48).
Mutating a customer's stylesheet by default is not defensible. This *is* a visible behaviour change —
default maps no longer flash grid overlays during load — so it wants sign-off, but the previous
behaviour was a bug, not a feature.

### 6.3 Dependency drift breaks gates that upstream itself passes

Three separate gate failures during this re-vendor were **version drift, not fork breakage**. The
fork's `package.json` uses caret ranges; upstream's `package-lock.json` pins exact versions, and
upstream's green CI is measured against those pins. Resolving a caret range to something newer than
upstream ever tested reliably produces failures in upstream's own code:

| package | resolved | upstream lockfile | symptom |
|---|---|---|---|
| `@rollup/plugin-typescript` | 12.3.0 | **12.1.4** | `build-dist` dies: "Path of Typescript compiler option 'outDir' must be located inside Rollup 'dir' option" |
| `earcut` | 3.2.3 | **3.0.2** | 10 `subdivision.test.ts` failures — same triangles, rotated index order |
| `@typescript-eslint/*` | 8.67.0 | **8.58.2** | 222 spurious `no-unnecessary-type-assertion` errors in upstream's own `src/webgl/`, `src/geo/` |

All four are now pinned exactly. **When a re-vendor gate fails in a file the fork never touched,
check the version against upstream's lockfile before debugging the code.**

### 6.4 Still owed

- The **≥90-minute, three-window staging soak** (§5). The run performed was a single window.
- A decision on whether `remove-client-renewal-timer` merges to `Main` before this branch lands —
  this branch descends from it, and §3 item 3 already depends on it.
- `test/integration/` was taken from upstream wholesale. It was stale enough to break the build
  (`map.style.sourceCaches`), and the fork had no catalogued patches there, but nobody has audited
  whether any fork-specific integration fixtures were lost.
