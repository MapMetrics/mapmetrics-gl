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

## Phase 2 — the upstream delta (NOT STARTED)

## Phase 3 — re-vendor (NOT STARTED)

## Phase 4 — verify (NOT STARTED)
