import fs from "fs";
import sourcemaps from "rollup-plugin-sourcemaps2";
import typescript from "@rollup/plugin-typescript";
import resolve from "@rollup/plugin-node-resolve";
import replace from "@rollup/plugin-replace";
import commonjs from "@rollup/plugin-commonjs";
import terser from "@rollup/plugin-terser";
import strip from "@rollup/plugin-strip";
import json from "@rollup/plugin-json";

// Common set of plugins/transformations shared across different rollup
// builds (main mapmetrics bundle, style-spec package, benchmarks bundle)
const nodeResolve = resolve({
    browser: true,
    preferBuiltins: false,
});
const plugins = (production) =>
    [
        json(),
        // https://github.com/zaach/jison/issues/351
        replace({
            preventAssignment: true,
            include: /\/jsonlint-lines-primitives\/lib\/jsonlint.js/,
            delimiters: ["", ""],
            values: {
                "_token_stack:": "",
            },
        }),
        production &&
            strip({
                sourceMap: true,
                functions: ["PerformanceUtils.*"],
            }),
        production &&
            terser({
                compress: {
                    pure_getters: true,
                    passes: 3,
                },
                sourceMap: true,
            }),
        nodeResolve,
        typescript(),
        commonjs({
            // global keyword handling causes Webpack compatibility issues, so we disabled it:
            // https://github.com/mapbox/mapbox-gl-js/pull/6956
            ignoreGlobal: true,
        }),
    ].filter(Boolean);
const watchStagingPlugin = {
    name: "watch-external",
    buildStart() {
        this.addWatchFile("staging/mapmetricsgl/index.js");
        this.addWatchFile("staging/mapmetricsgl/shared.js");
        this.addWatchFile("staging/mapmetricsgl/worker.js");
    },
};

const { BUILD } = process.env;
const production = BUILD === "production";
const outputFile = production
    ? "dist/mapmetrics-gl.js"
    : "dist/mapmetrics-gl-dev.js";
const config = [
    {
        input: ["src/index.ts", "src/source/worker.ts"],
        output: {
            dir: "staging/mapmetricsgl",
            format: "amd",
            sourcemap: "inline",
            indent: false,
            chunkFileNames: "shared.js",
            amd: {
                autoId: true,
            },
            minifyInternalExports: production,
        },
        onwarn: (message) => {
            console.error(message);
            throw message;
        },
        treeshake: production,
        plugins: plugins(production),
    },
    {
        input: "build/rollup/mapmetricsgl.js",
        output: {
            name: "mapmetricsgl",
            file: outputFile,
            format: "umd",
            sourcemap: true,
            indent: false,
            intro: fs.readFileSync("build/rollup/bundle_prelude.js", "utf8"),
            // banner,
        },
        watch: {
            // give the staging chunks a chance to finish before rebuilding the dev build
            buildDelay: 1000,
        },
        treeshake: false,
        plugins: [
            // Ingest the sourcemaps produced in the first step of the build.
            // This is the only reason we use Rollup for this second pass
            sourcemaps(),
            // When running in development watch mode, tell rollup explicitly to watch
            // for changes to the staging chunks built by the previous step. Otherwise
            // only they get built, but not the merged dev build js
            ...(production ? [] : [watchStagingPlugin]),
        ],
    },
];

export { config as default };
