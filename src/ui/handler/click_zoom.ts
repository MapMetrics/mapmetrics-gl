import type Point from '@mapbox/point-geometry';
import type {Map} from '../map';
import {TransformProvider} from './transform-provider';
import {type Handler} from '../handler_manager';

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
        const zoomDelta = e.shiftKey ? -1 : 1;
        const targetZoom = this._tr.zoom + zoomDelta;
        
        return {
            cameraAnimation: async (map: Map) => {
                // For zoom-out operations, wait for tiles to load before completing the animation
                if (zoomDelta < 0 && map.tileLoadingManager) {
                    const tilesLoaded = await map.tileLoadingManager.waitForZoomOutTiles(targetZoom, 3500);
                    if (tilesLoaded) {
                        // Tiles loaded successfully, proceed with animation
                        map.easeTo({
                            duration: 300,
                            zoom: targetZoom,
                            around: this._tr.unproject(point)
                        }, {originalEvent: e});
                    } else {
                        // Timeout reached, proceed anyway
                        map.easeTo({
                            duration: 1800,
                            zoom: targetZoom,
                            around: this._tr.unproject(point)
                        }, {originalEvent: e});
                    }
                } else {
                    // Zoom-in or no tile loading manager, proceed normally
                    map.easeTo({
                        duration: 300,
                        zoom: targetZoom,
                        around: this._tr.unproject(point)
                    }, {originalEvent: e});
                }
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
