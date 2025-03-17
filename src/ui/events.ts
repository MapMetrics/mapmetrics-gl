import { Event } from "../util/evented";

import { DOM } from "../util/dom";
import Point from "@mapbox/point-geometry";
import { extend } from "../util/util";
import type { MapGeoJSONFeature } from "../util/vectortile_to_geojson";

import type { Map } from "./map";
import type { LngLat } from "../geo/lng_lat";
import type {
    ProjectionSpecification,
    SourceSpecification,
} from "@maplibre/maplibre-gl-style-spec";

/**
 * An event from the mouse relevant to a specific layer.
 *
 * @group Event Related
 */
export type MapLayerMouseEvent = MapMouseEvent & {
    features?: MapGeoJSONFeature[];
};

/**
 * An event from a touch device relevant to a specific layer.
 *
 * @group Event Related
 */
export type MapLayerTouchEvent = MapTouchEvent & {
    features?: MapGeoJSONFeature[];
};

/**
 * The source event data type
 */
export type MapSourceDataType = "content" | "metadata" | "visibility" | "idle";
export type MapLayerEventType = {
    click: MapLayerMouseEvent;
    dblclick: MapLayerMouseEvent;
    mousedown: MapLayerMouseEvent;
    mouseup: MapLayerMouseEvent;
    mousemove: MapLayerMouseEvent;
    mouseenter: MapLayerMouseEvent;
    mouseleave: MapLayerMouseEvent;
    mouseover: MapLayerMouseEvent;
    mouseout: MapLayerMouseEvent;
    contextmenu: MapLayerMouseEvent;
    touchstart: MapLayerTouchEvent;
    touchend: MapLayerTouchEvent;
    touchcancel: MapLayerTouchEvent;
};
export type MapEventType = {
    error: ErrorEvent;
    load: MapmetricsEvent;
    idle: MapmetricsEvent;
    remove: MapmetricsEvent;
    render: MapmetricsEvent;
    resize: MapmetricsEvent;
    webglcontextlost: MapContextEvent;
    webglcontextrestored: MapContextEvent;
    dataloading: MapDataEvent;
    data: MapDataEvent;
    tiledataloading: MapDataEvent;
    sourcedataloading: MapSourceDataEvent;
    styledataloading: MapStyleDataEvent;
    sourcedata: MapSourceDataEvent;
    styledata: MapStyleDataEvent;
    styleimagemissing: MapStyleImageMissingEvent;
    boxzoomcancel: MapmetricsZoomEvent;
    touchmove: MapTouchEvent;
    touchend: MapTouchEvent;
    touchstart: MapTouchEvent;
    click: MapMouseEvent;
    contextmenu: MapMouseEvent;
    dblclick: MapMouseEvent;
    mousemove: MapMouseEvent;
    mouseup: MapMouseEvent;
    mousedown: MapMouseEvent;
    mouseout: MapMouseEvent;
    mouseover: MapMouseEvent;
    movestart: MapmetricsEvent<
        MouseEvent | TouchEvent | WheelEvent | undefined
    >;
    move: MapmetricsEvent<MouseEvent | TouchEvent | WheelEvent | undefined>;
    moveend: MapmetricsEvent<MouseEvent | TouchEvent | WheelEvent | undefined>;
    zoomstart: MapmetricsEvent<
        MouseEvent | TouchEvent | WheelEvent | undefined
    >;
    zoom: MapmetricsEvent<MouseEvent | TouchEvent | WheelEvent | undefined>;
    zoomend: MapmetricsEvent<MouseEvent | TouchEvent | WheelEvent | undefined>;
    rotatestart: MapmetricsEvent<MouseEvent | TouchEvent | undefined>;
    rotate: MapmetricsEvent<MouseEvent | TouchEvent | undefined>;
    rotateend: MapmetricsEvent<MouseEvent | TouchEvent | undefined>;
    dragstart: MapmetricsEvent<MouseEvent | TouchEvent | undefined>;
    drag: MapmetricsEvent<MouseEvent | TouchEvent | undefined>;
    dragend: MapmetricsEvent<MouseEvent | TouchEvent | undefined>;
    pitchstart: MapmetricsEvent<MouseEvent | TouchEvent | undefined>;
    pitch: MapmetricsEvent<MouseEvent | TouchEvent | undefined>;
    pitchend: MapmetricsEvent<MouseEvent | TouchEvent | undefined>;
    wheel: MapWheelEvent;
    terrain: MapTerrainEvent;
    cooperativegestureprevented: MapmetricsEvent<WheelEvent | TouchEvent> & {
        gestureType: "wheel_zoom" | "touch_pan";
    };
    projectiontransition: MapProjectionEvent;
};

export type MapmetricsEvent<TOrig = unknown> = {
    type: keyof MapEventType | keyof MapLayerEventType;
    target: Map;
    originalEvent: TOrig;
};

/**
 * The style data event
 *
 * @group Event Related
 */
export type MapStyleDataEvent = MapmetricsEvent & {
    dataType: "style";
};

/**
 * The source data event interface
 *
 * @group Event Related
 */
export type MapSourceDataEvent = MapmetricsEvent & {
    dataType: "source";
    /**
     * True if the event has a `dataType` of `source` and the source has no outstanding network requests.
     */
    isSourceLoaded: boolean;
    /**
     * The [style spec representation of the source](#sources) if the event has a `dataType` of `source`.
     */
    source: SourceSpecification;
    sourceId: string;
    sourceDataType: MapSourceDataType;
    sourceDataChanged?: boolean;
    /**
     * The tile being loaded or changed, if the event has a `dataType` of `source` and
     * the event is related to loading of a tile.
     */
    tile: any;
};
/**
 * `MapMouseEvent` is the event type for mouse-related map events.
 *
 * @group Event Related
 *
 * @example
 * ```ts
 * // The `click` event is an example of a `MapMouseEvent`.
 * // Set up an event listener on the map.
 * map.on('click', (e) => {
 *   // The event object (e) contains information like the
 *   // coordinates of the point on the map that was clicked.
 *   console.log('A click event has occurred at ' + e.lngLat);
 * });
 * ```
 */
export class MapMouseEvent
    extends Event
    implements MapmetricsEvent<MouseEvent>
{
    /**
     * The event type
     */
    type:
        | "mousedown"
        | "mouseup"
        | "click"
        | "dblclick"
        | "mousemove"
        | "mouseover"
        | "mouseenter"
        | "mouseleave"
        | "mouseout"
        | "contextmenu";

    /**
     * The `Map` object that fired the event.
     */
    target: Map;

    /**
     * The DOM event which caused the map event.
     */
    originalEvent: MouseEvent;

    /**
     * The pixel coordinates of the mouse cursor, relative to the map and measured from the top left corner.
     */
    point: Point;

    /**
     * The geographic location on the map of the mouse cursor.
     */
    lngLat: LngLat;

    /**
     * Prevents subsequent default processing of the event by the map.
     *
     * Calling this method will prevent the following default map behaviors:
     *
     *   * On `mousedown` events, the behavior of {@link DragPanHandler}
     *   * On `mousedown` events, the behavior of {@link DragRotateHandler}
     *   * On `mousedown` events, the behavior of {@link BoxZoomHandler}
     *   * On `dblclick` events, the behavior of {@link DoubleClickZoomHandler}
     *
     */
    preventDefault() {
        this._defaultPrevented = true;
    }

    /**
     * `true` if `preventDefault` has been called.
     */
    get defaultPrevented(): boolean {
        return this._defaultPrevented;
    }

    _defaultPrevented: boolean;

    constructor(
        type: string,
        map: Map,
        originalEvent: MouseEvent,
        data: any = {}
    ) {
        const point = DOM.mousePos(map.getCanvas(), originalEvent);
        const lngLat = map.unproject(point);
        super(type, extend({ point, lngLat, originalEvent }, data));
        this._defaultPrevented = false;
        this.target = map;
    }
}

/**
 * `MapTouchEvent` is the event type for touch-related map events.
 *
 * @group Event Related
 */
export class MapTouchEvent
    extends Event
    implements MapmetricsEvent<TouchEvent>
{
    /**
     * The event type.
     */
    type: "touchstart" | "touchmove" | "touchend" | "touchcancel";

    /**
     * The `Map` object that fired the event.
     */
    target: Map;

    /**
     * The DOM event which caused the map event.
     */
    originalEvent: TouchEvent;

    /**
     * The geographic location on the map of the center of the touch event points.
     */
    lngLat: LngLat;

    /**
     * The pixel coordinates of the center of the touch event points, relative to the map and measured from the top left
     * corner.
     */
    point: Point;

    /**
     * The array of pixel coordinates corresponding to a
     * [touch event's `touches`](https://developer.mozilla.org/en-US/docs/Web/API/TouchEvent/touches) property.
     */
    points: Array<Point>;

    /**
     * The geographical locations on the map corresponding to a
     * [touch event's `touches`](https://developer.mozilla.org/en-US/docs/Web/API/TouchEvent/touches) property.
     */
    lngLats: Array<LngLat>;

    /**
     * Prevents subsequent default processing of the event by the map.
     *
     * Calling this method will prevent the following default map behaviors:
     *
     *   * On `touchstart` events, the behavior of {@link DragPanHandler}
     *   * On `touchstart` events, the behavior of {@link TwoFingersTouchZoomRotateHandler}
     *
     */
    preventDefault() {
        this._defaultPrevented = true;
    }

    /**
     * `true` if `preventDefault` has been called.
     */
    get defaultPrevented(): boolean {
        return this._defaultPrevented;
    }

    _defaultPrevented: boolean;

    constructor(type: string, map: Map, originalEvent: TouchEvent) {
        const touches =
            type === "touchend"
                ? originalEvent.changedTouches
                : originalEvent.touches;
        const points = DOM.touchPos(map.getCanvasContainer(), touches);
        const lngLats = points.map((t) => map.unproject(t));
        const point = points.reduce((prev, curr, i, arr) => {
            return prev.add(curr.div(arr.length));
        }, new Point(0, 0));
        const lngLat = map.unproject(point);
        super(type, { points, point, lngLats, lngLat, originalEvent });
        this._defaultPrevented = false;
    }
}

/**
 * `MapWheelEvent` is the event type for the `wheel` map event.
 *
 * @group Event Related
 */
export class MapWheelEvent extends Event {
    /**
     * The event type.
     */
    type: "wheel";

    /**
     * The `Map` object that fired the event.
     */
    target: Map;

    /**
     * The DOM event which caused the map event.
     */
    originalEvent: WheelEvent;

    /**
     * Prevents subsequent default processing of the event by the map.
     *
     * Calling this method will prevent the behavior of {@link ScrollZoomHandler}.
     */
    preventDefault() {
        this._defaultPrevented = true;
    }

    /**
     * `true` if `preventDefault` has been called.
     */
    get defaultPrevented(): boolean {
        return this._defaultPrevented;
    }

    _defaultPrevented: boolean;

    /** */
    constructor(type: string, map: Map, originalEvent: WheelEvent) {
        super(type, { originalEvent });
        this._defaultPrevented = false;
    }
}

/**
 * A `MapmetricsZoomEvent` is the event type for the boxzoom-related map events emitted by the {@link BoxZoomHandler}.
 *
 * @group Event Related
 */
export type MapmetricsZoomEvent = {
    /**
     * The type of boxzoom event. One of `boxzoomstart`, `boxzoomend` or `boxzoomcancel`
     */
    type: "boxzoomstart" | "boxzoomend" | "boxzoomcancel";
    /**
     * The `Map` instance that triggered the event
     */
    target: Map;
    /**
     * The DOM event that triggered the boxzoom event. Can be a `MouseEvent` or `KeyboardEvent`
     */
    originalEvent: MouseEvent;
};

/**
 * A `MapDataEvent` object is emitted with the `data`
 * and `dataloading` events. Possible values for
 * `dataType`s are:
 *
 * - `'source'`: The non-tile data associated with any source
 * - `'style'`: The [style]() used by the map
 *
 * Possible values for `sourceDataType`s are:
 *
 * - `'metadata'`: indicates that any necessary source metadata has been loaded (such as TileJSON) and it is ok to start loading tiles
 * - `'content'`: indicates the source data has changed (such as when source.setData() has been called on GeoJSONSource)
 * - `'visibility'`: send when the source becomes used when at least one of its layers becomes visible in style sense (inside the layer's zoom range and with layout.visibility set to 'visible')
 * - `'idle'`: indicates that no new source data has been fetched (but the source has done loading)
 *
 * @group Event Related
 *
 * @example
 * ```ts
 * // The sourcedata event is an example of MapDataEvent.
 * // Set up an event listener on the map.
 * map.on('sourcedata', (e) => {
 *    if (e.isSourceLoaded) {
 *        // Do something when the source has finished loading
 *    }
 * });
 * ```
 */
export type MapDataEvent = {
    /**
     * The event type.
     */
    type: string;
    /**
     * The type of data that has changed. One of `'source'`, `'style'`.
     */
    dataType: string;
    /**
     *  Included if the event has a `dataType` of `source` and the event signals that internal data has been received or changed. Possible values are `metadata`, `content`, `visibility` and `idle`.
     */
    sourceDataType: MapSourceDataType;
};

/**
 * The terrain event
 *
 * @group Event Related
 */
export type MapTerrainEvent = {
    type: "terrain";
};

/**
 * The map projection event
 *
 * @group Event Related
 */
export type MapProjectionEvent = {
    type: "projectiontransition";
    /**
     * Specifies the name of the new projection.
     * Additionally includes 'globe-mercator' to describe globe that has internally switched to mercator.
     */
    newProjection: ProjectionSpecification["type"] | "globe-mercator";
};

/**
 * An event related to the web gl context
 *
 * @group Event Related
 */
export type MapContextEvent = {
    type: "webglcontextlost" | "webglcontextrestored";
    originalEvent: WebGLContextEvent;
};

/**
 * The style image missing event
 *
 * @group Event Related
 *
 * @see [Generate and add a missing icon to the map](https://maplibre.org/maplibre-gl-js/docs/examples/add-image-missing-generated/)
 */
export type MapStyleImageMissingEvent = MapmetricsEvent & {
    type: "styleimagemissing";
    id: string;
};
