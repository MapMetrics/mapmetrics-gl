import packageJSON from '../package.json' with {type: 'json'};
import {Map} from './ui/map';
import {NavigationControl} from './ui/control/navigation_control';
import {GeolocateControl} from './ui/control/geolocate_control';
import {AttributionControl} from './ui/control/attribution_control';
import {LogoControl} from './ui/control/logo_control';
import {ScaleControl} from './ui/control/scale_control';
import {FullscreenControl} from './ui/control/fullscreen_control';
import {TerrainControl} from './ui/control/terrain_control';
import {GlobeControl} from './ui/control/globe_control';
import {Popup} from './ui/popup';
import {Marker} from './ui/marker';
import {Style} from './style/style';
import {LngLat, type LngLatLike} from './geo/lng_lat';
import {LngLatBounds, type LngLatBoundsLike} from './geo/lng_lat_bounds';
import Point from '@mapbox/point-geometry';
import {MercatorCoordinate} from './geo/mercator_coordinate';
import {Evented, type ErrorEvent, Event} from './util/evented';
import {config} from './util/config';
import {mapSession, type MapSessionOptions} from './util/map_session';
import {rtlMainThreadPluginFactory} from './source/rtl_text_plugin_main_thread';
import {WorkerPool} from './util/worker_pool';
import {prewarm, clearPrewarmedResources} from './util/global_worker_pool';
import {AJAXError} from './util/ajax';
import {GeoJSONSource} from './source/geojson_source';
import {CanvasSource, type CanvasSourceSpecification} from './source/canvas_source';
import {ImageSource} from './source/image_source';
import {RasterDEMTileSource} from './source/raster_dem_tile_source';
import {RasterTileSource} from './source/raster_tile_source';
import {VectorTileSource} from './source/vector_tile_source';
import {VideoSource} from './source/video_source';
import {type Source, addSourceType} from './source/source';
import {addProtocol, removeProtocol} from './source/protocol_crud';
import {getGlobalDispatcher} from './util/dispatcher';
import {type IControl} from './ui/control/control';
import {EdgeInsets, type PaddingOptions} from './geo/edge_insets';
import {type MapTerrainEvent, type MapStyleImageMissingEvent, type MapStyleDataEvent, type MapSourceDataEvent, type MapmetricsZoomEvent, type MapmetricsEvent, type MapLayerTouchEvent, type MapLayerMouseEvent, type MapLayerEventType, type MapEventType, type MapDataEvent, type MapContextEvent, MapWheelEvent, MapTouchEvent, MapMouseEvent} from './ui/events';
import {BoxZoomHandler} from './ui/handler/box_zoom';
import {DragRotateHandler} from './ui/handler/shim/drag_rotate';
import {DragPanHandler} from './ui/handler/shim/drag_pan';
import {ScrollZoomHandler} from './ui/handler/scroll_zoom';
import {TwoFingersTouchZoomRotateHandler} from './ui/handler/shim/two_fingers_touch';
import {type CustomLayerInterface} from './style/style_layer/custom_style_layer';
import {type PointLike} from './ui/camera';
import {Hash} from './ui/hash';
import {CooperativeGesturesHandler} from './ui/handler/cooperative_gestures';
import {DoubleClickZoomHandler} from './ui/handler/shim/dblclick_zoom';
import {KeyboardHandler} from './ui/handler/keyboard';
import {TwoFingersTouchPitchHandler, TwoFingersTouchRotateHandler, TwoFingersTouchZoomHandler} from './ui/handler/two_fingers_touch';
import {MessageType} from './util/actor_messages';
import {createTileMesh} from './util/create_tile_mesh';
import type {GeoJSONFeature} from './util/vectortile_to_geojson';
const version = packageJSON.version;

export type * from '@maplibre/maplibre-gl-style-spec';
function setRTLTextPlugin(pluginURL: string, lazy: boolean): Promise<void> {
    return rtlMainThreadPluginFactory().setRTLTextPlugin(pluginURL, lazy);
}
function getRTLTextPluginStatus(): string {
    return rtlMainThreadPluginFactory().getRTLTextPluginStatus();
}
function getVersion() { return version; }
function getWorkerCount() { return WorkerPool.workerCount; }
function setWorkerCount(count: number) { WorkerPool.workerCount = count; }
function getMaxParallelImageRequests() { return config.MAX_PARALLEL_IMAGE_REQUESTS; }
function setMaxParallelImageRequests(numRequests: number) { config.MAX_PARALLEL_IMAGE_REQUESTS = numRequests; }
function getWorkerUrl() { return config.WORKER_URL; }
function setWorkerUrl(value: string) { config.WORKER_URL = value; }
/**
 * Enables v2 map-session authentication.
 *
 * The gateway bills one map load per 30-minute window of use. With an API key configured the SDK
 * buys a short-lived, maps-only, account-bound credential and signs the tile URLs the style already
 * emits with it, instead of putting a permanent full-scope key on every request. Until this is
 * called nothing changes: tiles go out exactly as they do today.
 *
 * All `Map` instances on the page share ONE session, otherwise each map would buy its own window.
 * @param options - see {@link MapSessionOptions}. Pass `gatewayOrigin` to pin the origin the API key
 * may be POSTed to; without it the origin is learned once from the first https tile URL.
 * @example
 * ```ts
 * mapmetricsgl.configureMapSession({apiKey: MY_KEY, gatewayOrigin: 'https://gateway.mapmetrics.org'});
 * ```
 */
function configureMapSession(options: MapSessionOptions) { mapSession.configure(options); }
function importScriptInWorkers(workerUrl: string) { return getGlobalDispatcher().broadcast(MessageType.importScript, workerUrl); }

export {
    Map,
    NavigationControl,
    GeolocateControl,
    AttributionControl,
    LogoControl,
    ScaleControl,
    FullscreenControl,
    TerrainControl,
    GlobeControl,
    Hash,
    Popup,
    Marker,
    Style,
    LngLat,
    LngLatBounds,
    Point,
    MercatorCoordinate,
    Evented,
    Event,
    AJAXError,
    config,
    CanvasSource,
    GeoJSONSource,
    ImageSource,
    RasterDEMTileSource,
    RasterTileSource,
    VectorTileSource,
    VideoSource,
    EdgeInsets,
    BoxZoomHandler,
    DragRotateHandler,
    DragPanHandler,
    ScrollZoomHandler,
    TwoFingersTouchZoomRotateHandler,
    CooperativeGesturesHandler,
    DoubleClickZoomHandler,
    KeyboardHandler,
    TwoFingersTouchZoomHandler,
    TwoFingersTouchRotateHandler,
    TwoFingersTouchPitchHandler,
    MapWheelEvent,
    MapTouchEvent,
    MapMouseEvent,
    type IControl,
    type CustomLayerInterface,
    type CanvasSourceSpecification,
    type PaddingOptions,
    type LngLatLike,
    type PointLike,
    type LngLatBoundsLike,
    type Source,
    type MapTerrainEvent,
    type MapStyleImageMissingEvent,
    type MapStyleDataEvent,
    type MapSourceDataEvent,
    type MapmetricsZoomEvent,
    type MapmetricsEvent,
    type MapLayerTouchEvent,
    type MapLayerMouseEvent,
    type MapLayerEventType,
    type MapEventType,
    type MapDataEvent,
    type MapContextEvent,
    type ErrorEvent,
    type GeoJSONFeature,
    setRTLTextPlugin,
    getRTLTextPluginStatus,
    prewarm,
    clearPrewarmedResources,
    getVersion,
    getWorkerCount,
    setWorkerCount,
    getMaxParallelImageRequests,
    setMaxParallelImageRequests,
    getWorkerUrl,
    setWorkerUrl,
    addProtocol,
    removeProtocol,
    addSourceType,
    importScriptInWorkers,
    createTileMesh,
    configureMapSession,
    mapSession
};
