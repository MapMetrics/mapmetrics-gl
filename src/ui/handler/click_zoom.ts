import type Point from '@mapbox/point-geometry';
import type {Map} from '../map';
import {TransformProvider} from './transform-provider';
import {type Handler} from '../handler_manager';
import {evaluateZoomSnap} from '../../util/util';

/**
 * The `ClickZoomHandler` allows the user to zoom the map at a point by double clicking
 * It is used by other handlers
 */
export class ClickZoomHandler implements Handler {

    _tr: TransformProvider;
    _enabled: boolean;
    _active: boolean;

    /** @internal */
    constructor(map: Map) {
        this._tr = new TransformProvider(map);
        this.reset();
    }

    reset() {
        this._active = false;
    }

    dblclick(e: MouseEvent, point: Point) {
        e.preventDefault();
        return {
            cameraAnimation: async (map: Map) => {
                const zoomDelta = e.shiftKey ? -1 : 1;
                const targetZoom = evaluateZoomSnap(this._tr.zoom + zoomDelta, map.getZoomSnap());

                // Zoom-out waits for the destination tiles. If they did not arrive in time we
                // still zoom, but with a longer 1800ms ease so the grey window reads as motion
                // rather than a stall.
                if (zoomDelta < 0 && map.tileLoadingManager) {
                    const tilesLoaded = await map.tileLoadingManager.waitForZoomOutTiles(targetZoom, 3500);
                    map.easeTo({
                        duration: tilesLoaded ? 300 : 1800,
                        zoom: targetZoom,
                        around: this._tr.unproject(point)
                    }, {originalEvent: e});
                    return;
                }

                map.easeTo({
                    duration: 300,
                    zoom: targetZoom,
                    around: this._tr.unproject(point)
                }, {originalEvent: e});
            }
        };
    }

    enable() {
        this._enabled = true;
    }

    disable() {
        this._enabled = false;
        this.reset();
    }

    isEnabled() {
        return this._enabled;
    }

    isActive() {
        return this._active;
    }
}
