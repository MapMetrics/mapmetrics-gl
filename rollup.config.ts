import fs from 'fs';
import sourcemaps from 'rollup-plugin-sourcemaps2';
import {plugins, watchStagingPlugin} from './build/rollup_plugins';
import banner from './build/banner';
import {type RollupOptions} from 'rollup';

const {BUILD} = process.env;

const production = BUILD === 'production';
const outputFile = production
    ? 'dist/mapmetrics-gl.js'
    : 'dist/mapmetrics-gl-dev.js';

const config: RollupOptions[] = [
    {
        input: ['src/index.ts', 'src/source/worker.ts'],
        output: {
            dir: 'staging/mapmetricsgl',
            format: 'amd',
            sourcemap: 'inline',
            indent: false,
            chunkFileNames: 'shared.js',
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
        input: 'build/rollup/mapmetricsgl.js',
        output: {
            name: 'mapmetricsgl',
            file: outputFile,
            format: 'umd',
            sourcemap: true,
            indent: false,
            intro: fs.readFileSync('build/rollup/bundle_prelude.js', 'utf8'),
            banner,
        },
        watch: {
            buildDelay: 1000,
        },
        treeshake: false,
        plugins: [
            sourcemaps(),
            ...(production ? [] : [watchStagingPlugin]),
        ],
    },
];

export default config;
