import {beforeEach, test, expect, vi} from 'vitest';
import {createMap, beforeMapTest} from '../../util/test/util';
import {type IControl} from '../control/control';

/**
 * MapMetrics fork behaviour: every `Map` is constructed with two mandatory controls
 * already attached - an `AttributionControl` (attribution cannot be disabled, so that
 * OpenStreetMap/ODbL attribution is always shown; `attributionControl: false` only
 * resets it to defaults) and a `LogoControl` (`mapmetricsLogo` defaults to `true`).
 * Upstream MapLibre starts with an empty `_controls` array when attribution is off.
 * Tests therefore index/count relative to these built-ins rather than from zero.
 */
const DEFAULT_CONTROL_COUNT = 2;

beforeEach(() => {
    beforeMapTest();
    global.fetch = null;
});

test('#addControl', () => {
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

test('#removeControl errors on invalid arguments', () => {
    const map = createMap();
    const control = {} as any as IControl;
    const stub = vi.spyOn(console, 'error').mockImplementation(() => {});

    map.addControl(control);
    map.removeControl(control);
    expect(stub).toHaveBeenCalledTimes(2);

});

test('#removeControl', () => {
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

test('#hasControl', () => {
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
