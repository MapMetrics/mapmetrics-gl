#!/usr/bin/env python3
"""
Mechanical MapLibre -> MapMetrics rename for a freshly vendored upstream `src/` tree.

MAPMETRICS-FORK.md 1.2: "That script is not committed anywhere. Each re-vendor therefore
reinvents it." This is that script. Committing it is the point.

    python3 build/revendor/rename.py <path-to-src>            # rewrite in place
    python3 build/revendor/rename.py <path-to-src> --dry-run  # report only

WHAT IT DOES
  paths     maplibregl -> mapmetricsgl, maplibre -> mapmetrics
  contents  maplibregl -> mapmetricsgl        (CSS class prefix, DOM ids, SVG filenames)
            MapLibreGL -> MapMetricsGL
            MapLibre   -> Mapmetrics          (NOTE the lowercase 'm' -- see below)
            maplibre   -> mapmetrics
            MAPLIBRE   -> MAPMETRICS

WHY `MapLibre -> Mapmetrics` AND NOT `MapMetrics`
  The fork's public API is `MapmetricsEvent` / `MapmetricsZoomEvent` (from upstream's
  `MapLibreEvent` / `MapLibreZoomEvent`), and those names are exported from src/index.ts and are
  therefore part of the published type surface. `MapMetricsEvent` would be a breaking API change
  dressed up as a cosmetic one. `MapMetrics` (capital M) is reserved for hand-written fork code
  (`isMapMetricsGatewayUrl`, `MAPMETRICS_GATEWAY_HOSTS`).

EXCEPTIONS -- deliberately NOT renamed
  1. `@maplibre/maplibre-gl-style-spec`   the real npm package this fork depends on.
  2. `https://maplibre.org/...`           upstream documentation links in TSDoc @see tags. The fork
                                          keeps these; they point at real pages that exist.

KNOWN MANUAL FOLLOW-UPS (no mechanical rule produces these -- do them by hand, then re-check)
  * MAPMETRICS-FORK.md 2.1 claims upstream's `maplibregl-ctrl-globe.svg` became
    `mapmetricsgl-globe.svg`, "a *shape* change, not a prefix swap", that "no mechanical rename
    would produce". THAT IS WRONG and this script disproves it: the fork contains BOTH
    `mapmetricsgl-ctrl-globe.svg` (which is what `src/css/mapmetrics-gl.css` actually
    `@svg-load`s, and which the plain prefix swap produces correctly) AND a byte-identical,
    entirely unreferenced copy at `mapmetricsgl-globe.svg`. The latter is dead weight, and
    manifest marker 9 checks the dead one. Drop it, or keep it and stop calling it special.
  * `src/ui/default_locale.ts` uses "MapMetrics logo" (capital M) in user-facing text, not the
    mechanical "Mapmetrics logo".
  * The MapMetrics-branded SVGs (`mapmetricsgl-ctrl-logo.svg`, `mapmetricsgl-ctrl-attrib.svg`)
    are replaced wholesale from the fork, not renamed.

VERIFY
    python3 build/revendor/rename.py <renamed-src> --verify <fork-src>
  lists paths that exist on exactly one side, i.e. everything the mechanical rule got wrong.
"""
import os
import re
import sys

# 'revendor' excludes THIS DIRECTORY. Running the script over `build/` walked into
# build/revendor and renamed rename.py itself, turning `rename_path` into a no-op
# (`replace('mapmetricsgl', 'mapmetricsgl')`) and corrupting normdiff.py the same way.
SKIP_DIRS = {'.git', 'node_modules', 'revendor'}
BINARY_EXT = {'.png', '.jpg', '.jpeg', '.gif', '.ico', '.woff', '.woff2', '.ttf', '.eot',
              '.webp', '.pbf', '.mp4', '.webm', '.DS_Store'}

# Any `@maplibre/...` specifier is a REAL npm package and must survive the rename.
# Do NOT reduce this to an allow-list of one: v5.24.0 added `@maplibre/vt-pbf`,
# `@maplibre/geojson-vt` and `@maplibre/mlt` since v5.2.0, and a single-package exemption
# silently renamed all three into `@mapmetrics/*` packages that do not exist.
NPM_SCOPE = re.compile(r'@maplibre/[A-Za-z0-9._-]+')
# Upstream documentation links. The fork KEEPS these -- measured against the fork's own src/:
# 76 `maplibre.org` doc URLs survive, against 3 `mapmetrics.org` ones which are the brand
# homepage. They point at real pages; renamed `mapmetrics.org/mapmetrics-gl-js/...` URLs 404.
DOC_URL = re.compile(r'https?://maplibre\.org[^\s\'")\]>]*')


def rename_text(s: str) -> str:
    # Protect exempt spans behind placeholders that contain NO renameable substring.
    # An earlier version wrapped the original text in sentinels but left `maplibre` VISIBLE
    # inside them, so the doc-URL exemption silently did nothing and every upstream doc link
    # was rewritten to a 404. Placeholders must be opaque.
    keep = []

    def _stash(m):
        keep.append(m.group(0))
        return '\x00{}\x00'.format(len(keep) - 1)

    s = NPM_SCOPE.sub(_stash, s)
    s = DOC_URL.sub(_stash, s)
    s = s.replace('maplibregl', 'mapmetricsgl')
    s = s.replace('MapLibreGL', 'MapMetricsGL')
    s = s.replace('MapLibre', 'Mapmetrics')
    s = s.replace('maplibre', 'mapmetrics')
    s = s.replace('MAPLIBRE', 'MAPMETRICS')
    s = re.sub(r'\x00(\d+)\x00', lambda m: keep[int(m.group(1))], s)
    return s


def rename_path(p: str) -> str:
    return p.replace('maplibregl', 'mapmetricsgl').replace('maplibre', 'mapmetrics')


def walk(root):
    # os.walk() on a FILE yields nothing at all, so passing a single path used to be a silent
    # no-op that looked like success ("0 files rewritten"). Handle it explicitly.
    if os.path.isfile(root):
        yield root
        return
    for dp, dn, fn in os.walk(root):
        dn[:] = [d for d in dn if d not in SKIP_DIRS]
        for f in fn:
            yield os.path.join(dp, f)


def run(root, dry):
    content_changed = renamed = 0
    for full in list(walk(root)):
        ext = os.path.splitext(full)[1]
        if ext not in BINARY_EXT and os.path.basename(full) != '.DS_Store':
            try:
                with open(full, 'r', encoding='utf-8') as fh:
                    src = fh.read()
            except (UnicodeDecodeError, OSError):
                src = None
            if src is not None:
                out = rename_text(src)
                if out != src:
                    content_changed += 1
                    if not dry:
                        with open(full, 'w', encoding='utf-8') as fh:
                            fh.write(out)
        new = rename_path(full)
        if new != full:
            renamed += 1
            print(f'  path: {os.path.relpath(full, root)} -> {os.path.relpath(new, root)}')
            if not dry:
                os.makedirs(os.path.dirname(new), exist_ok=True)
                os.rename(full, new)
    print(f'{"[dry-run] " if dry else ""}{content_changed} files rewritten, {renamed} paths renamed')


def verify(root, fork):
    a = {os.path.relpath(p, root) for p in walk(root)}
    b = {os.path.relpath(p, fork) for p in walk(fork)}
    only_new = sorted(a - b)
    only_fork = sorted(b - a)
    print(f'=== in renamed tree but not in fork ({len(only_new)}) -- rename rule produced a name the fork does not use')
    for p in only_new:
        print('   ', p)
    print(f'=== in fork but not in renamed tree ({len(only_fork)}) -- fork-only files, plus any name the rule failed to produce')
    for p in only_fork:
        print('   ', p)


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(2)
    target = sys.argv[1]
    if '--verify' in sys.argv:
        verify(target, sys.argv[sys.argv.index('--verify') + 1])
    else:
        run(target, '--dry-run' in sys.argv)
