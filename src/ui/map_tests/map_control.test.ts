import {beforeEach, test, expect, vi} from 'vitest';
import {createMap, beforeMapTest} from '../../util/test/util';
import {type IControl} from '../control/control';

/**
 * MapMetrics fork behaviour: attribution is MANDATORY, so every `Map` is constructed with an
 * `AttributionControl` already attached. `attributionControl: false` -- which the shared
 * `createMap` test helper passes -- only resets it to `defaultAttributionControlOptions`
 * rather than omitting it. Upstream MapLibre starts with an EMPTY `_controls` array here.
 *
 * The count is 2 because BRANDING IS NOT OPTIONAL: the `LogoControl` is added
 * unconditionally, so `mapmetricsLogo: false` -- which the shared `createMap` helper passes --
 * no longer suppresses it. `mapmetricsLogo` now selects POSITION only.
 *
 * That flag WAS honoured until 2026-08-20. Upstream gates its own logo on the equivalent
 * option and defaults it to false, and the v5.24.0 re-vendor inherited that default: the logo
 * silently vanished while the SVG, the CSS and the control were all still perfectly intact,
 * and all 47 manifest grep markers passed. Hence unconditional, and hence this count.
 *
 * This constant is the ONLY automated evidence that the non-removable attribution
 * (MAPMETRICS-FORK.md §3 item 12, a licence/contractual obligation) is wired up at the `Map`
 * level. If a re-vendor takes upstream's `map_control.test.ts`, that obligation loses its last
 * check here -- and a map that renders perfectly is not evidence it survived.
 */
const DEFAULT_CONTROL_COUNT = 2;

beforeEach(() => {
    beforeMapTest();
    global.fetch = null;
});

test('addControl', () => {
    const map = createMap();
    const control = {
        onAdd(_) {
            expect(map).toBe(_);
            return window.document.createElement('div');
        }
    } as any as IControl;
    map.addControl(control);
    expect(map._controls).toHaveLength(DEFAULT_CONTROL_COUNT + 1);
    expect(map._controls[DEFAULT_CONTROL_COUNT]).toBe(control);
});

test('removeControl errors on invalid arguments', () => {
    const map = createMap();
    const control = {} as any as IControl;
    const stub = vi.spyOn(console, 'error').mockImplementation(() => {});

    map.addControl(control);
    map.removeControl(control);
    expect(stub).toHaveBeenCalledTimes(2);

});

test('removeControl', () => {
    const map = createMap();
    const control = {
        onAdd() {
            return window.document.createElement('div');
        },
        onRemove(_) {
            expect(map).toBe(_);
        }
    };
    map.addControl(control);
    map.removeControl(control);
    expect(map._controls).toHaveLength(DEFAULT_CONTROL_COUNT);

});

test('hasControl', () => {
    const map = createMap();
    function Ctrl() {}
    Ctrl.prototype = {
        onAdd(_) {
            return window.document.createElement('div');
        }
    };

    const control = new Ctrl();
    expect(map.hasControl(control)).toBe(false);
    map.addControl(control);
    expect(map.hasControl(control)).toBe(true);
});
