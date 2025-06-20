import {TapRecognizer} from './tap_recognizer';
import type Point from '@mapbox/point-geometry';
import type {Map} from '../map';
import {TransformProvider} from './transform-provider';
import {type Handler} from '../handler_manager';

/**
 * A `TapZoomHandler` allows the user to zoom the map at a point by double tapping
 */
export class TapZoomHandler implements Handler {
    _tr: TransformProvider;
    _enabled: boolean;
    _active: boolean;
    _zoomIn: TapRecognizer;
    _zoomOut: TapRecognizer;

    constructor(map: Map) {
        this._tr = new TransformProvider(map);
        this._zoomIn = new TapRecognizer({
            numTouches: 1,
            numTaps: 2
        });

        this._zoomOut = new TapRecognizer({
            numTouches: 2,
            numTaps: 1
        });

        this.reset();
    }

    reset() {
        this._active = false;
        this._zoomIn.reset();
        this._zoomOut.reset();
    }

    touchstart(e: TouchEvent, points: Array<Point>, mapTouches: Array<Touch>) {
        this._zoomIn.touchstart(e, points, mapTouches);
        this._zoomOut.touchstart(e, points, mapTouches);
    }

    touchmove(e: TouchEvent, points: Array<Point>, mapTouches: Array<Touch>) {
        this._zoomIn.touchmove(e, points, mapTouches);
        this._zoomOut.touchmove(e, points, mapTouches);
    }

    touchend(e: TouchEvent, points: Array<Point>, mapTouches: Array<Touch>) {
        const zoomInPoint = this._zoomIn.touchend(e, points, mapTouches);
        const zoomOutPoint = this._zoomOut.touchend(e, points, mapTouches);
        const tr = this._tr;

        if (zoomInPoint) {
            this._active = true;
            e.preventDefault();
            setTimeout(() => this.reset(), 0);
            return {
                cameraAnimation: (map: Map) => map.easeTo({
                    duration: 300,
                    zoom: tr.zoom + 1,
                    around: tr.unproject(zoomInPoint)
                }, {originalEvent: e})
            };
        } else if (zoomOutPoint) {
            this._active = true;
            e.preventDefault();
            setTimeout(() => this.reset(), 0);
            
            const targetZoom = tr.zoom - 1;
            
            return {
                cameraAnimation: async (map: Map) => {
                    // For zoom-out operations, wait for tiles to load before completing the animation
                    if (map.tileLoadingManager) {
                        const tilesLoaded = await map.tileLoadingManager.waitForZoomOutTiles(targetZoom, 4000);
                        if (tilesLoaded) {
                            // Tiles loaded successfully, proceed with animation
                            map.easeTo({
                                duration: 300,
                                zoom: targetZoom,
                                around: tr.unproject(zoomOutPoint)
                            }, {originalEvent: e});
                        } else {
                            // Timeout reached, proceed anyway
                            map.easeTo({
                                duration: 300,
                                zoom: targetZoom,
                                around: tr.unproject(zoomOutPoint)
                            }, {originalEvent: e});
                        }
                    } else {
                        // No tile loading manager, proceed normally
                        map.easeTo({
                            duration: 300,
                            zoom: targetZoom,
                            around: tr.unproject(zoomOutPoint)
                        }, {originalEvent: e});
                    }
                }
            };
        }
    }

    touchcancel() {
        this.reset();
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
