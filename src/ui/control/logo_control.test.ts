import {describe, beforeEach, test, expect} from 'vitest';
import {createMap as globalCreateMap, beforeMapTest} from '../../util/test/util';
import {LogoControl} from './logo_control';

function createMap(logoPosition, mapmetricsLogo) {

    const mapobj = {
        logoPosition,
        mapmetricsLogo,
        style: {
            version: 8,
            sources: {},
            layers: []
        }
    };

    return globalCreateMap(mapobj);
}

beforeEach(() => {
    beforeMapTest();
});

describe('LogoControl', () => {
    test('does not appear by default', async () => {
        const map = createMap(undefined, undefined);
        await map.once('load');
        expect(map.getContainer().querySelectorAll(
            '.mapmetricsgl-ctrl-logo'
        )).toHaveLength(0);
    });

    test('is not displayed when the mapmetricsLogo property is false', async () => {
        const map = createMap(undefined, false);
        await map.once('load');
        expect(map.getContainer().querySelectorAll(
            '.mapmetricsgl-ctrl-logo'
        )).toHaveLength(0);
    });

    test('appears in bottom-left when mapmetricsLogo is true and logoPosition is undefined', async () => {
        const map = createMap(undefined, true);
        await map.once('load');
        expect(map.getContainer().querySelectorAll(
            '.mapmetricsgl-ctrl-bottom-left .mapmetricsgl-ctrl-logo'
        )).toHaveLength(1);
    });

    test('appears in the position specified by the position option', async () => {
        const map = createMap('top-left', true);
        await map.once('load');
        expect(map.getContainer().querySelectorAll(
            '.mapmetricsgl-ctrl-top-left .mapmetricsgl-ctrl-logo'
        )).toHaveLength(1);
    });

    /**
     * MapMetrics fork behaviour: unlike upstream MapLibre, the logo does NOT collapse to
     * compact automatically on narrow (under 640px) containers - see `_updateCompact` in
     * `logo_control.ts`, which only applies `mapmetricsgl-compact` when `compact: true` was
     * explicitly requested. This keeps the brand mark at a fixed 180px on mobile.
     */
    test('does not collapse to compact on narrow containers (fork behaviour)', () => {
        const map = createMap(undefined, true);
        const container = map.getContainer();

        Object.defineProperty(map.getCanvasContainer(), 'offsetWidth', {value: 645, configurable: true});
        map.resize();
        expect(
            container.querySelectorAll('.mapmetricsgl-ctrl-logo:not(.mapmetricsgl-compact)')
        ).toHaveLength(1);

        Object.defineProperty(map.getCanvasContainer(), 'offsetWidth', {value: 635, configurable: true});
        map.resize();
        expect(
            container.querySelectorAll('.mapmetricsgl-ctrl-logo.mapmetricsgl-compact')
        ).toHaveLength(0);
        expect(
            container.querySelectorAll('.mapmetricsgl-ctrl-logo:not(.mapmetricsgl-compact)')
        ).toHaveLength(1);
    });

    test('appears in compact mode only when compact is explicitly requested', () => {
        const map = createMap(undefined, false);
        const container = map.getContainer();
        map.addControl(new LogoControl({compact: true}));

        Object.defineProperty(map.getCanvasContainer(), 'offsetWidth', {value: 1000, configurable: true});
        map.resize();
        expect(
            container.querySelectorAll('.mapmetricsgl-ctrl-logo.mapmetricsgl-compact')
        ).toHaveLength(1);
    });

    test('has `rel` noopener and nofollow', async () => {
        const map = createMap(undefined, true);

        await map.once('load');
        const container = map.getContainer();
        const logo = container.querySelector('.mapmetricsgl-ctrl-logo');
        expect(logo).toHaveProperty('rel', 'noopener nofollow');
    });
});
