
import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import replace from '@rollup/plugin-replace';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';
import strip from '@rollup/plugin-strip';
import {type Plugin} from 'rollup';
import json from '@rollup/plugin-json';

// Common set of plugins/transformations shared across different rollup
// builds (main maplibre bundle, style-spec package, benchmarks bundle)

export const nodeResolve = resolve({
    browser: true,
    preferBuiltins: false
});

export const plugins = (production: boolean): Plugin[] => [
    json(),
    replace({
        preventAssignment: true,
        include: /\/jsonlint-lines-primitives\/lib\/jsonlint.js/,
        delimiters: ['', ''],
        values: {
            '_token_stack:': ''
        }
    }),
    // Minify the production bundle. This runs on the staging AMD chunks, which
    // `rollup.config.ts` then concatenates into the UMD dist (that second pass has
    // `treeshake: false` and no transforms), so minifying here covers the published
    // artifact. `rollup.config.csp.ts` uses this same plugin list directly.
    //
    // This was commented out in 70ffb2c, the squashed initial import of the fork - no commit
    // ever records a reason, and re-enabling it leaves `test-build` (which evals the bundle)
    // and the unit suite green. It is NOT safe to disable again casually: without it the
    // published bundle is ~2.5 MB instead of ~0.9 MB, i.e. ~1.6 MB of dead weight on exactly
    // the mobile connections this SDK targets.
    production && terser({
        compress: {
            pure_getters: true,
            passes: 3
        },
        sourceMap: true
    }),
    nodeResolve,
    typescript(),
    // Strip developer-only output from the published bundle so consuming applications get a quiet
    // console. `console.warn` / `console.error` are deliberately NOT stripped: they report real
    // problems (misconfiguration, failed requests) that a consumer needs to see. The dev bundle
    // (`BUILD:dev`) keeps everything, so debugging this library is unaffected.
    //
    // NOTE: this must run AFTER typescript(). @rollup/plugin-strip parses with acorn, which cannot
    // read TypeScript syntax, and its default `include` is '**/*.js' only -- so placed before
    // typescript() it never touched any of our own .ts sources. `include` is widened to '.ts' so
    // that it does.
    production && strip({
        sourceMap: true,
        include: ['**/*.js', '**/*.ts'],
        functions: ['PerformanceUtils.*', 'console.log', 'console.debug', 'console.info', 'console.trace', 'console.dir', 'console.table']
    }),
    commonjs({
        ignoreGlobal: true
    })
].filter(Boolean) as Plugin[];


export const watchStagingPlugin: Plugin = {
    name: 'watch-external',
    buildStart() {
        this.addWatchFile('staging/mapmetricsgl/index.js');
        this.addWatchFile('staging/mapmetricsgl/shared.js');
        this.addWatchFile('staging/mapmetricsgl/worker.js');
    }
};
