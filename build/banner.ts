import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
import {dirname, join} from 'path';

const packageJSONPath = join(dirname(fileURLToPath(import.meta.url)), '../package.json');
const packageJSON = JSON.parse(readFileSync(packageJSONPath, 'utf8'));

export default
`/**
 * Mapmetrics GL JS
 * @license 3-Clause BSD. Full text of license: https://github.com/mapmetrics/mapmetrics-gl-js/blob/v${packageJSON.version}/LICENSE.txt
 */`;
