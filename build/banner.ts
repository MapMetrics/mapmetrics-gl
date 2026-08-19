import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';

const packageJSONPath = join(dirname(fileURLToPath(import.meta.url)), '../package.json');
const packageJSON = JSON.parse(readFileSync(packageJSONPath, 'utf8'));

/**
 * Rollup's `output.banner` must be a string (or a function returning one) - it is prepended
 * to the bundle verbatim, so it has to be valid JavaScript.
 *
 * This module previously exported the parsed package.json OBJECT. Rollup stringified it, so
 * every CSP bundle shipped with the literal text `[object Object]` as its first line, which
 * is a syntax error: dist/mapmetrics-gl-csp.js and dist/mapmetrics-gl-csp-worker.js could not
 * be loaded at all. The breakage was invisible because terser (the only step that parses the
 * finished bundle) was disabled. Keep this a comment string.
 */
export default `/**
 * MapMetrics GL JS v${packageJSON.version}
 * ${packageJSON.homepage}
 * @license ${packageJSON.license}
 */`;
