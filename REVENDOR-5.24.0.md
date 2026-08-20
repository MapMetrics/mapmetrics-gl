# Re-vendor to upstream maplibre-gl-js v5.24.0 — working document

Branch: `revendor/v5.24.0`.
Base commit: `d623983` (`remove-client-renewal-timer` = `Main`@`9f57b41` + the
client-side-renewal-timer removal).

> **Base discrepancy, read this.** The re-vendor was commissioned against `Main`@`9f57b41`, but the
> checked-out tree was `remove-client-renewal-timer`@`d623983`, one commit ahead. That commit is
> *not* cosmetic — `MAPMETRICS-FORK.md` §3 item 3 already depends on it ("Since the client-side
> renewal timer was removed this is the ONLY path by which the credential is ever replaced").
> Re-basing onto `Main` would silently drop it and re-introduce a renewal timer the manifest assumes
> is gone. This work therefore branches from `d623983`. **Someone must decide whether
> `remove-client-renewal-timer` merges to `Main` before this re-vendor lands.**

---

## Phase 1 — the diffable base (COMPLETE)

### 1.1 Method

Upstream was cloned to a scratch directory outside this repo (no remote was added here) and
`v5.2.0` / `v5.24.0` checked out as worktrees. The comparison tool is committed at
`build/revendor/normdiff.py`.

It does what `MAPMETRICS-FORK.md` §1.1 says a raw diff cannot: it applies the MapLibre→MapMetrics
rename to upstream, strips comments, normalises quote style, collapses whitespace inside template
literals, drops trailing commas and semicolons, and compares the resulting **token streams**. Files
whose token streams are equal are cosmetic-only regardless of how many lines the raw diff shows.

```
python3 build/revendor/normdiff.py <fork-root> <upstream-worktree> summary
python3 build/revendor/normdiff.py <fork-root> <upstream-worktree> detail <path-substring>
```

### 1.2 Result — the fork against upstream v5.2.0

| bucket | count |
|---|---|
| byte-identical after rename | 458 |
| cosmetic-only (Prettier / stripped comments) | 19 |
| **semantic change** | **50** |
| new in fork | 124 |
| deleted in fork | 0 |

The 124 "new" files are **not** 124 patches:

| | |
|---|---|
| 78 | `*.g.ts` — codegen output (shaders, style-layer properties, `data/array_types.g.ts`). Upstream gitignores these; the fork commits them. **They must be regenerated from v5.24.0, not copied.** |
| 36 | `src/seo/**` — the product feature (manifest lists 36; `find` reports 37 because `src/seo/demo.ts` is untracked/ignored in the working tree) |
| 8 | the real new files the manifest lists |
| 2 | `.DS_Store` (`src/`, `src/css/`) — junk, untracked |

### 1.3 Reconciliation against MAPMETRICS-FORK.md

**Found and listed: 24 / 24. Missing: 0. Unlisted: 26.**

(The manifest's prose says "22 real patches"; §2.2 and §2.3 actually tabulate 9 + 15 = **24** rows.
Every one of the 24 was located.)

Manifest §2.4 claims 17 files differ with *zero* semantic change. 15 of those confirm. **Two do
not** — see U1 and U2 below. That is the exact failure mode §2.4 warns about, inverted: two real
patches are filed under "take from upstream wholesale".

#### Unlisted divergences that are REAL (must be replayed)

| id | path | what | why it matters |
|---|---|---|---|
| **U1** | `src/util/dom.ts` | `DOM.removeAttributes` snapshots the live `NamedNodeMap` via `Array.from(...)` before mutating it | The XSS fix, fork commit `07a70ba`, upstream PR **#8189**. Manifest does not mention `dom.ts` anywhere. **#8189 is NOT in v5.24.0** (it is on `main`, fixed upstream in v6.4.1) — so it must be replayed, and there is no double-apply risk. |
| **U2** | `src/util/dom.test.ts` | two regression tests for U1 (consecutive dangerous attributes; attribute following a removed one) | The only net under U1. Manifest lists neither. |
| **U3** | `src/source/source.ts` | adds `expandTileCoverage?: number` to the source options type | Manifest files `source.ts` under §2.4 "zero semantic change". It is the type that makes the `covering_tiles.ts` patch (§2.3) compile. Drop it and `covering_tiles` fails loudly — but a hand-merger following §2.4 will take upstream's file and then be tempted to "fix" the error by deleting the feature. |
| **U4** | `src/ui/events.ts` | fork's `MapEventType` is **missing** upstream's `dataabort`, `sourcedataabort`, `boxzoomstart`, `boxzoomend`, `touchcancel` | Manifest files `events.ts` under §2.4 too. This looks like an accidental deletion in a previous vendor drop, not a feature — nothing in `src/` references the removal. **Recommendation: do not replay. Take upstream v5.24.0's `events.ts` and let the five event types come back.** Flagged for a human. |

#### Unlisted divergences that are CONSEQUENCES of listed patches (replay follows automatically)

| path | driven by |
|---|---|
| `src/ui/handler/scroll_zoom.test.ts` | §2.3 `scroll_zoom.ts` rate retune — `0.0285` → `singleTickZoomDelta = 0.1404`, `11.6371` → `48.3721` |
| `src/ui/handler/cooperative_gestures.test.ts` | same constant, same retune |
| `src/ui/handler/keyboard.test.ts` | §2.3 `keyboard.ts` `cameraAnimation` made async — adds `flushCameraAnimation()` and `await`s |
| `src/ui/map_tests/map_control.test.ts` | §3 item 12 mandatory attribution — `DEFAULT_CONTROL_COUNT = 2` instead of upstream's `0` |
| `src/ui/control/attribution_control.test.ts` | §2.3 `attribution_control.ts` |
| `src/ui/control/logo_control.test.ts` | §2.3 `logo_control.ts` |

`map_control.test.ts` is worth naming out loud: it is the **only** automated evidence that the
non-removable attribution (§3 item 12, licence/contractual) is wired up. If a re-vendor takes
upstream's `map_control.test.ts`, that obligation loses its last check.

#### Unlisted divergences that are NOISE (take upstream wholesale)

Prettier paren/wrap artefacts the tokeniser cannot cancel, or rename residue:
`ui/camera.ts`, `ui/popup.ts`, `style/style.ts`, `source/query_features.ts`, `source/image_source.ts`,
`source/geojson_source.ts`, `source/video_source.ts`, `ui/control/control.ts`,
`shaders/atmosphere.fragment.glsl` (a `Globe`→`GLobe` typo in a comment).

Rename residue — places a previous vendor's rename *missed*, so the fork still says `maplibre`:
`ui/map_tests/map_style.test.ts`, `ui/map_tests/map_layer.test.ts` (`"maplibre-satellite"`),
`ui/map_tests/map_events.test.ts` (`"maplibre://nonexistent"`), `util/test/util.ts` (`maplibreLogo`),
`source/terrain_source_cache.test.ts`, `source/vector_tile_source.test.ts`,
`ui/default_locale.ts` (`"MapMetrics logo"` — casing differs from the mechanical `Mapmetrics`).
These are cosmetic, but they are the reason the rename script must be committed: each re-vendor has
produced a *different* residue set.

### 1.4 Manifest grep markers verified against the base commit

All 39 mechanical markers in `MAPMETRICS-FORK.md` §4 were run against `d623983`. **39/39 pass.**
One footnote: marker 6 (`find src/seo -type f | wc -l`) returns **37**, not 36, because
`src/seo/demo.ts` is present in the working tree but not tracked by git. `git ls-files src/seo | wc -l`
returns 36. The marker should be changed to use `git ls-files`.

### 1.5 Upstream tag facts established for Phase 2

- `v5.2.0` = `c238479fb`, `v5.24.0` = `fd31bd859` — v5.24.0 is the **latest** v5 tag.
- PR **#7184** (async `RequestTransformFunction`) — **IS** in v5.24.0 (`7aae2263e`).
- PR **#7451** (`makeRequest` usable in workers) — **IS** in v5.24.0 (`d5c86fe50`).
- PR **#8071** (abort reaching a load still transforming its request) — **NOT** in v5.24.0; on `main` only.
- PR **#8004** — no commit found by that number in this repository's history.
- PR **#8189** (the `DOM.removeAttributes` fix, = fork commit `07a70ba`) — **NOT** in v5.24.0; on
  `main` only. **Replay it; do not expect upstream to have it; no double-apply risk.**

---

## Phase 2 — the upstream delta v5.2.0 → v5.24.0 (COMPLETE)

**1,229 commits. `src/` goes from 527 files to 579.** v5.24.0 is the newest v5 tag; there is no
newer v5 to consider.

### 2.1 The tree was restructured. Paths in the manifest no longer exist.

| v5.2.0 | v5.24.0 | consequence |
|---|---|---|
| `src/source/source_cache.ts` | **deleted** → `src/tile/tile_manager.ts` (+ `tile_manager_in_view_tiles.ts`, `tile_manager_raster.ts`, `tile_manager_raster_dem.ts`, `terrain_tile_manager.ts`) | "Refactor SourceCache to TileManager" (#6635). `SourceCache` no longer exists. |
| `style.sourceCaches` | `style.tileManagers` | every fork call site changes |
| `src/render/**` | much of it → `src/webgl/`, `src/webgl/draw/`, `src/webgl/program/` | #7422, #7370 |
| `src/shaders/*.glsl` | `src/shaders/glsl/` | #7418 |
| `src/gl/` | gone | folded into `src/webgl/` |

`src/source/source_cache.test.ts` (2,127 lines) is likewise gone. **The fork's
`source_cache.test.ts` patch (§2.3, the tests for `hasErroredTiles`) has no upstream file to land
on and must be re-created as `src/tile/tile_manager.test.ts` additions.** It is the only automated
evidence for §3 item 5.

Good news on the port itself: `TileManager` keeps `this._tiles` keyed by id with a `state` field,
and keeps `reload(sourceDataChanged?)` with the same "expired vs reloading" semantics. So
`hasErroredTiles()` transplants almost verbatim; only its home and the map.ts registry name change.

### 2.2 `setTransformRequest` accepting an ASYNC function (#7184, commit `7aae2263e`) — RESOLVED

This is the one the brief called the single most likely place for the billing patch to silently
mis-merge, and it is real. Upstream v5.24.0:

```ts
export type RequestTransformFunction = (url, resourceType?) => RequestParameters | Promise<RequestParameters> | undefined;

transformRequest(url: string, type: ResourceType) {          // <- NOT async, but MAY return a Promise
    if (this._transformRequestFn) return this._transformRequestFn(url, type) || {url};
    return {url};
}
```

The fork's patch is synchronous:

```ts
const params = (this._transformRequestFn && this._transformRequestFn(url, type)) || {url};
params.url = mapSession.signUrl(params.url);
```

**Replayed verbatim onto v5.24.0 this fails silently, exactly as §3 item 1 describes.** If an
integrator supplies an async `transformRequest`, `params` is a `Promise`, `params.url` is
`undefined`, `mapSession.signUrl(undefined)` is called, and the signed result is assigned as an
expando property onto the Promise object. The URL that is actually requested is whatever the
promise resolves to — **unsigned**. Nothing throws. `tsc` will not catch it either, because
`Promise<RequestParameters>` is an object type and `params.url` type-errors only under a stricter
config than this repo runs. It renders perfectly and bills on the v1 path.

**Decision: make the fork's `transformRequest` `async` and `await` the application callback.**
This is safe, and verifiably so: **every one of the 15 upstream call sites already `await`s**
`transformRequest` (`ui/map.ts` ×2, `source/vector_tile_source.ts` ×2, `geojson_source.ts`,
`image_source.ts`, `video_source.ts`, `raster_tile_source.ts`, `raster_dem_tile_source.ts`,
`load_tilejson.ts`, `style/style.ts`, `load_sprite.ts` ×2, `load_glyph_range.ts`), because upstream
had to make them await for #7184 itself. The replayed patch is:

```ts
async transformRequest(url: string, type: ResourceType): Promise<RequestParameters> {
    const params = (this._transformRequestFn && await this._transformRequestFn(url, type)) || {url};
    if (type === ResourceType.Style) {
        mapSession.learnFromStyleUrl(params.url);
        mapSession.learnFromStyleUrl(url);
    }
    params.url = mapSession.signUrl(params.url);
    return params;
}
```

Also note upstream widened the field to `RequestTransformFunction | null` and normalises `undefined`
to `null` in the constructor — keep that; the fork's version leaves it `undefined`.

**Add a regression test.** Marker 15 (`grep -c 'mapSession.signUrl' src/util/request_manager.ts`)
passes just as happily on the broken synchronous version. Grep cannot see this bug. The test must
be: register an async `transformRequest`, await `transformRequest()`, assert the returned `.url`
carries the signing params.

### 2.3 `makeRequest` usable inside workers (#7451, commit `d5c86fe50`) — KEEP the worker.ts hack

**Verified, not assumed** (as §3 item 8 demands). #7451 is six lines in `src/source/worker.ts`:

```ts
this.self.makeRequest = makeRequest;
```

plus a type on `WorkerGlobalScopeInterface` and a `getGlobalDispatcher` export. It exposes
`makeRequest` to *third-party code running in the worker* (custom protocols, plugins). It does
nothing whatsoever about credentials, `Accept` headers, or request type.

The fork's `worker.ts` patch does something different in kind: it intercepts the `loadTile` /
`reloadTile` actor messages and, when `shouldForceGatewayCredentials(params.request.url)`, sets
`credentials: 'include'`, `Accept: application/x-protobuf` and `type: 'arrayBuffer'`.

**Verdict: not redundant. Keep it, in both handlers.** The manifest's speculation is now closed —
record it there so the next re-vendor does not re-litigate it.

One correction while replaying it: the inline comment says `type: 'arrayBuffer'` "Force[s]
XMLHttpRequest for all requests to MapMetrics domains". That was never true, in v5.2.0 or v5.24.0 —
`makeRequest` prefers `fetch` whenever `fetch`/`Request`/`AbortController` exist, regardless of
`type`. The line still matters (it selects how the response body is parsed), but the comment
explaining why it is there is wrong and should be fixed rather than copied forward.

### 2.4 Abort handling for tiles awaiting transformRequest (#8071, #8004) — NOT APPLICABLE

`#8071` ("let an abort reach a load that is still transforming its request", `5f00f87f5`) is on
upstream `main` and is **not in v5.24.0**. No commit matching `#8004` exists in the repository.
There is therefore nothing to merge against here and no blast radius on the map_session work at
this target. It becomes relevant only if the target is moved to v6.x — which the brief rules out.

Related and *in* scope: v5.24.0 does rework abort plumbing generally — `createAbortError()` is
replaced by `new AbortError(signal.reason)` / `throwIfAborted(signal)` / `isAbortError(e)` in
`src/util/abort_error.ts`, and `makeFetchRequest` now rethrows abort errors before wrapping
anything in `AJAXError`. The fork's `makeFetchRequest` rewrite must be replayed on top of that, not
around it.

### 2.5 `ajax.ts` — the largest hand-merge, but v5.24.0 makes one patch easier

Upstream churn is modest in line count (+34 −21) but touches exactly the fork's edit sites:

- `ExpiryData` gained **`etag?: string`**. The fork adds `mapSessionHeaders` to the same type.
  Purely additive, no conflict.
- **This is the useful part:** both `makeFetchRequest` and `makeXMLHttpRequest` now read `ETag`
  off the response and return it, and `vector_tile_worker_source.ts` plumbs it through the worker
  boundary via a new single helper `_getExpiryData({expires, cacheControl, etag})`. **Upstream has
  built, for its own reasons, precisely the response-header→main-thread channel the fork's
  `mapSessionHeaders` patch hand-rolled.** Replay `mapSessionHeaders` by following `etag`
  line-for-line.
- `makeRequest` is now `async`; `/:\/\//.test()` → `.includes('://')`; `hasOwnProperty` →
  `Object.hasOwn`; `self.worker && self.worker.actor` → `self.worker?.actor`.
- `RequestParameters` gained `referrerPolicy`, threaded into the `Request` constructor — the fork's
  `makeFetchRequest` rewrite must not drop it.

**Manifest marker 16 will need rewording.** It currently demands `grep -c 'mapSessionHeaders'
src/source/vector_tile_worker_source.ts` == **exactly 2**, meaning the `loadTile` and `reloadTile`
halves. In v5.24.0 those two halves have been unified into `_getExpiryData`, so the natural replay
is 1 in `loadVectorTile`'s return + 1 in `_getExpiryData` = still 2, but they are *different* two.
Update the marker's description or the next re-vendor will read "both halves" and add a redundant
third.

### 2.6 The rest of the risk surface, by file

| file | upstream churn | note |
|---|---|---|
| `src/ui/map.ts` | +662 −233 | largest hand-merge. Fork delta is 3,420 tokens on top. `sourceCaches`→`tileManagers`. |
| `src/render/glyph_manager.ts` | +152 −91 | the fork patch is one import line (`@mapmetrics/tiny-sdf`), trivially re-applied — but the file moved and was rewritten around it. Do not hand-merge; take upstream and change the one import. |
| `src/source/vector_tile_worker_source.ts` | +154 −114 | see §2.5 |
| `src/geo/projection/covering_tiles.ts` | +83 −55 | `expandTileCoverage` (496-token fork patch) must be re-derived, not pasted. Affects tile volume ⇒ affects cost. |
| `src/ui/marker.ts` | +82 −52 | `_addMarker`/`_removeMarker` hook; also #7442 changed the opacity option type. |
| `src/index.ts` | +162 −31 | large export-surface growth; fork adds `configureMapSession` / `mapSession` / `MapSessionOptions`. Trivial to re-add, catastrophic to forget (§3 item 2). |
| `src/util/dom.ts` | +5 −54 | upstream shrank it. **The XSS fix (U1, #8189) is still absent at v5.24.0 — verify against the rewritten `removeAttributes` before replaying.** |
| `src/ui/events.ts` | +76 −61 | see U4 — recommend taking upstream wholesale and letting the five missing event types return. |
| `src/ui/handler/{scroll_zoom,keyboard,tap_zoom,click_zoom}.ts`, `navigation_control.ts` | small | the `waitForZoomOutTiles` family; mechanical. |
| `src/css/maplibre-gl.css` | +49 −17 | branding merge. |
| `src/style/style.test.ts` | +1,313 −396 | fork delta is rename-only (`mapLibre`→`mapmetrics`) ⇒ take upstream and re-run the rename script. Do not hand-merge. |
| `src/ui/handler/scroll_zoom.test.ts` | +308 −131 | must re-derive `singleTickZoomDelta` for the retuned rate rather than porting `0.1404`. |

### 2.7 Also new since v5.2.0 and worth a decision, not just a merge

`src/source/vector_tile_mlt.ts` (MapLibre Tiles / MLT format) and `vector_tile_overzoomed.ts` are
new source paths that bypass nothing but do add tile-fetch code paths. Confirm they route through
`RequestManager.transformRequest` — if a new tile path does not, it is an unsigned tile path, which
is §3 item 1 arriving through a door that did not exist when the manifest was written.

---

## Phase 3 — re-vendor (COMPLETE)

**Delivered: `build/revendor/rename.py`.** MAPMETRICS-FORK.md §1.2 says the rename script "is not
committed anywhere" and "each re-vendor therefore reinvents it". It is committed now, documented,
and **validated**: run against a pristine `v5.2.0` `src/` it reproduces the fork's filename set
exactly — 11 paths renamed, 70 files rewritten, and `--verify` reports **zero** paths that exist on
one side only besides the 124 genuinely fork-only files. The mechanical rule is therefore complete;
it was never the lossy part.

It also settles a manifest error — see the `mapmetricsgl-globe.svg` note in its docstring, and §4
below.

**Phase 3 completed 2026-08.** Upstream v5.24.0 `src/`, `build/`, `test/{unit,build,bench,integration}`
and the root configs were taken wholesale and renamed; the fork's patches were replayed on top.
All 24 manifest patches plus U1/U2/U3 are in. See the commit message on `revendor/v5.24.0` for the
detail, and MAPMETRICS-FORK.md §6 for the defects and open decisions this surfaced.

## Phase 4 — verify (COMPLETE, except the 90-minute soak)

---

## 4. Corrections owed to MAPMETRICS-FORK.md — ALL 8 APPLIED

All eight were folded into MAPMETRICS-FORK.md in the same commit as the patches, as required.
Kept here as the record of what changed and why:

1. §2.1 / marker 9 — `mapmetricsgl-globe.svg` is **not** a "shape change no mechanical rename would
   produce". The fork has both it and `mapmetricsgl-ctrl-globe.svg`, byte-identical; the CSS
   `@svg-load`s the *ctrl* one; `mapmetricsgl-globe.svg` is referenced by nothing. Marker 9 checks
   the dead file.
2. §2.4 — `src/source/source.ts` and `src/ui/events.ts` do **not** have zero semantic change (U3, U4).
3. §2.2/§2.3 — the tables list 24 files; the prose says 22.
4. `src/util/dom.ts` and `src/util/dom.test.ts` (the #8189 XSS fix) are absent from the manifest
   entirely and belong in §2.2 with a §3 entry: dropping it is silent, and it is a security bug.
5. Marker 6 should be `git ls-files src/seo | wc -l` (36); `find` returns 37 because
   `src/seo/demo.ts` is untracked.
6. Marker 16's "both halves" wording is stale at v5.24.0 — see §2.5.
7. §3 item 8 is now answered: #7451 does **not** make `worker.ts`'s patch redundant.
8. A new §3 entry is owed for the async-`transformRequest` hazard in §2.2: grep marker 15 passes on
   the broken version, so the manifest needs a *test*, not a marker.

---

## 5. Handover — what remains

**Items 1–7 below are DONE** (item 1 is a decision still owed to a human — see the note at the top of
this document; the branch descends from `remove-client-renewal-timer`). What actually remains is in
MAPMETRICS-FORK.md §6.4: the 90-minute three-window staging soak, the base-branch decision, and an
audit of `test/integration/` fixtures.

The original ordering, for the record:

1. Decide the base: merge `remove-client-renewal-timer` into `Main`, or rebase this branch. See the
   note at the top.
2. Decide U4 (`events.ts` five missing `MapEventType` members) — recommendation: take upstream.
3. Copy v5.24.0 `src/` in, run `build/revendor/rename.py`, restore the 8 new-file groups and
   `src/seo/**`, then **regenerate the 78 `*.g.ts`** (`npm run codegen`-equivalent — do not copy
   them from either side).
4. Replay the 24 manifest patches + U1/U2/U3, in the manifest's order (`map_session` before its
   consumers), starting with `request_manager.ts` in its **async** form (§2.2) and
   `vector_tile_worker_source.ts` following the `etag` channel (§2.5).
5. Re-home `hasErroredTiles` onto `src/tile/tile_manager.ts` and re-create its tests as
   `tile_manager.test.ts`; update `map.ts` to `style.tileManagers`.
6. Run `bash build/revendor/check-markers.sh` (paths need updating for the restructure), then the
   four gates, then the `dist/` checks in MAPMETRICS-FORK.md §5.
7. Update MAPMETRICS-FORK.md with §4 above.

### Baseline recorded at this checkpoint (base `d623983`, tree untouched)

| gate | result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm run lint` | 0 problems |
| `npm run test-unit` | **2420 passed / 0 failed**, 183 files |
| `npm run build-dist` | 6 bundles, all `node --check`-clean |

Note 2420, not the 2421 quoted for `Main`@`9f57b41` — the one-test difference is the
client-renewal-timer removal in `d623983`. **2420 is the number to restore on this branch.**
