import {describe, test, expect} from 'vitest';
import fs from 'fs';

describe('dev build', () => {
    test('file is not empty', () => {
        expect(fs.readFileSync('dist/mapmetrics-gl-dev.js', 'utf8').length).toBeGreaterThan(0);
    });
});
