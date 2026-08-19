import { Event, ErrorEvent, Evented } from "../util/evented";

import { extend, pick } from "../util/util";
import { loadTileJson } from "./load_tilejson";
import { TileBounds } from "./tile_bounds";
import { ResourceType } from "../util/request_manager";
import {mapSession} from '../util/map_session';

import type { Source } from "./source";
import type { OverscaledTileID } from "./tile_id";
import type { Map } from "../ui/map";
import type { Dispatcher } from "../util/dispatcher";
import type { Tile } from "./tile";
import type {
    VectorSourceSpecification,
    PromoteIdSpecification,
} from "@maplibre/maplibre-gl-style-spec";
import type { WorkerTileParameters, WorkerTileResult } from "./worker_source";
import { MessageType } from "../util/actor_messages";

export type VectorTileSourceOptions = VectorSourceSpecification & {
    collectResourceTiming?: boolean;
    tileSize?: number;
};

// Cookie prefetch mechanism
let globalCookiePrefetchPromise: Promise<void> | null = null;
const cookiePrefetchDomains = new Set<string>();

// Use a valid tile URL pattern for MapMetrics to ensure the proper cookie is set
/**
 * Performs a single cookie prefetch request for a domain
 */
async function prefetchSingleDomain(domain: string): Promise<void> {
    if (cookiePrefetchDomains.has(domain)) return;
    
    console.log(`🍪 Starting prefetch for domain: ${domain}`);
    
    try {
        // Use the same URL pattern as the working example
        const prefetchUrl = `https://twilight-bush-94ef.jim9710.workers.dev/20250110/1/1/0.mvt?token=`;
        
        console.log(`🍪 Prefetching URL: ${prefetchUrl}`);
        
        const prefetchResponse = await fetch(prefetchUrl, {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Accept': 'application/x-protobuf',
                'Origin': 'https://localhost:8000'
            },
            cache: 'no-store'
        });
        
        console.log(`🍪 Prefetch completed for ${domain} with status: ${prefetchResponse.status}`);
        cookiePrefetchDomains.add(domain);
    } catch (e) {
        console.warn(`🍪 Cookie prefetch failed for ${domain}:`, e);
        cookiePrefetchDomains.add(domain);
    }
}

/**
 * Ensures cookies are fetched for any MapMetrics domains
 * @returns Promise that resolves when all prefetches are complete
 */
function ensureGlobalCookiePrefetch(): Promise<void> {
    if (globalCookiePrefetchPromise) {
        return globalCookiePrefetchPromise;
    }
    
    console.log(`🍪 Starting global cookie prefetch`);
    
    globalCookiePrefetchPromise = prefetchSingleDomain('twilight-bush-94ef.jim9710.workers.dev')
        .then(() => {
            console.log('🍪 Global cookie prefetch completed');
        })
        .catch(err => {
            console.warn('🍪 Global cookie prefetch failed:', err);
        });
    
    return globalCookiePrefetchPromise;
}

/**
 * A source containing vector tiles in [Mapbox Vector Tile format](https://docs.mapbox.com/vector-tiles/reference/).
 * (See the [Style Specification]() for detailed documentation of options.)
 *
 * @group Sources
 *
 * @example
 * ```ts
 * map.addSource('some id', {
 *     type: 'vector',
 *     url: 'https://demotiles.maplibre.org/tiles/tiles.json'
 * });
 * ```
 *
 * @example
 * ```ts
 * map.addSource('some id', {
 *     type: 'vector',
 *     tiles: ['https://d25uarhxywzl1j.cloudfront.net/v0.1/{z}/{x}/{y}.mvt'],
 *     minzoom: 6,
 *     maxzoom: 14
 * });
 * ```
 *
 * @example
 * ```ts
 * map.getSource('some id').setUrl("https://demotiles.maplibre.org/tiles/tiles.json");
 * ```
 *
 * @example
 * ```ts
 * map.getSource('some id').setTiles(['https://d25uarhxywzl1j.cloudfront.net/v0.1/{z}/{x}/{y}.mvt']);
 * ```
 * @see [Add a vector tile source](https://maplibre.org/maplibre-gl-js/docs/examples/vector-source/)
 */
export class VectorTileSource extends Evented implements Source {
    type: "vector";
    id: string;
    minzoom: number;
    maxzoom: number;
    url: string;
    scheme: string;
    tileSize: number;
    promoteId: PromoteIdSpecification;

    _options: VectorSourceSpecification;
    _collectResourceTiming: boolean;
    dispatcher: Dispatcher;
    map: Map;
    bounds: [number, number, number, number];
    tiles: Array<string>;
    tileBounds: TileBounds;
    reparseOverscaled: boolean;
    isTileClipped: boolean;
    _tileJSONRequest: AbortController;
    _loaded: boolean;
    _prefetchCompleted: boolean = false;

    constructor(
        id: string,
        options: VectorTileSourceOptions,
        dispatcher: Dispatcher,
        eventedParent: Evented
    ) {
        super();
        this.id = id;
        this.dispatcher = dispatcher;

        this.type = "vector";
        this.minzoom = 0;
        this.maxzoom = 22;
        this.scheme = "xyz";
        this.tileSize = 512;
        this.reparseOverscaled = true;
        this.isTileClipped = true;
        this._loaded = false;
        this._prefetchCompleted = false;

        extend(this, pick(options, ["url", "scheme", "tileSize", "promoteId"]));
        this._options = extend({ type: "vector" }, options);

        this._collectResourceTiming = options.collectResourceTiming;

        if (this.tileSize !== 512) {
            throw new Error("vector tile sources must have a tileSize of 512");
        }

        this.setEventedParent(eventedParent);
        
        // Start cookie prefetch immediately for MapMetrics domains
        if (options.tiles && options.tiles.some(url => url.includes('mapmetrics.org'))) {
            this._startCookiePrefetch();
        }
    }
    
    /**
     * Starts the cookie prefetch process for MapMetrics domains
     */
    private _startCookiePrefetch(): void {
        // Start global prefetch
        ensureGlobalCookiePrefetch()
            .then(() => {
                this._prefetchCompleted = true;
                console.log(`🍪 Cookie prefetch completed for source ${this.id}`);
            })
            .catch(() => {
                // Set prefetch completed even on error to allow tiles to load
                this._prefetchCompleted = true;
            });
    }

    async load() {
        this._loaded = false;
        this.fire(new Event("dataloading", { dataType: "source" }));
        this._tileJSONRequest = new AbortController();
        try {
            const tileJSON = await loadTileJson(
                this._options,
                this.map._requestManager,
                this._tileJSONRequest
            );
            this._tileJSONRequest = null;
            this._loaded = true;
            this.map.style.sourceCaches[this.id].clearTiles();
            if (tileJSON) {
                extend(this, tileJSON);
                if (tileJSON.bounds)
                    this.tileBounds = new TileBounds(
                        tileJSON.bounds,
                        this.minzoom,
                        this.maxzoom
                    );

                // Check if we need to start cookie prefetch
                if (this.tiles && this.tiles.some(url => url.includes('mapmetrics.org')) && !this._prefetchCompleted) {
                    this._startCookiePrefetch();
                }

                // `content` is included here to prevent a race condition where `Style#_updateSources` is called
                // before the TileJSON arrives. this makes sure the tiles needed are loaded once TileJSON arrives
                // ref: https://github.com/mapbox/mapbox-gl-js/pull/4347#discussion_r104418088
                this.fire(
                    new Event("data", {
                        dataType: "source",
                        sourceDataType: "metadata",
                    })
                );
                this.fire(
                    new Event("data", {
                        dataType: "source",
                        sourceDataType: "content",
                    })
                );
            }
        } catch (err) {
            this._tileJSONRequest = null;
            this.fire(new ErrorEvent(err));
        }
    }

    loaded(): boolean {
        return this._loaded;
    }

    hasTile(tileID: OverscaledTileID) {
        return !this.tileBounds || this.tileBounds.contains(tileID.canonical);
    }

    onAdd(map: Map) {
        this.map = map;
        this.load();
    }

    setSourceProperty(callback: Function) {
        if (this._tileJSONRequest) {
            this._tileJSONRequest.abort();
        }

        callback();

        this.load();
    }

    /**
     * Sets the source `tiles` property and re-renders the map.
     *
     * @param tiles - An array of one or more tile source URLs, as in the TileJSON spec.
     */
    setTiles(tiles: Array<string>): this {
        // Check if we need to start prefetch for MapMetrics domains
        if (tiles.some(url => url.includes('mapmetrics.org'))) {
            this._startCookiePrefetch();
        }
        
        this.setSourceProperty(() => {
            this._options.tiles = tiles;
        });

        return this;
    }

    /**
     * Sets the source `url` property and re-renders the map.
     *
     * @param url - A URL to a TileJSON resource. Supported protocols are `http:` and `https:`.
     */
    setUrl(url: string): this {
        this.setSourceProperty(() => {
            this.url = url;
            this._options.url = url;
        });

        return this;
    }

    onRemove() {
        if (this._tileJSONRequest) {
            this._tileJSONRequest.abort();
            this._tileJSONRequest = null;
        }
    }

    serialize(): VectorSourceSpecification {
        return extend({}, this._options);
    }

    async loadTile(tile: Tile): Promise<void> {
        // For MapMetrics domains, wait for cookie prefetch to complete
        if (!this._prefetchCompleted && this.tiles && this.tiles.some(url => url.includes('mapmetrics.org'))) {
            console.log(`🍪 Waiting for cookie prefetch to complete before loading tile ${tile.tileID.canonical.z}/${tile.tileID.canonical.x}/${tile.tileID.canonical.y}`);
            try {
                // Wait for global prefetch to complete
                await ensureGlobalCookiePrefetch();
                this._prefetchCompleted = true;
            } catch (e) {
                // Continue even if prefetch failed
                console.warn(`🍪 Error waiting for cookie prefetch, proceeding with tile load anyway:`, e);
                this._prefetchCompleted = true;
            }
        }
        
        const url = tile.tileID.canonical.url(
            this.tiles,
            this.map.getPixelRatio(),
            this.scheme
        );
        
        const request = this.map._requestManager.transformRequest(
            url,
            ResourceType.Tile
        );
        
        // Ensure credentials and headers are set correctly for MapMetrics domains
        if (url.includes('mapmetrics.org') || url.includes('gateway.mapmetrics.org')) {
            request.credentials = 'include';
            request.headers = {
                ...request.headers,
                'Accept': 'application/x-protobuf',
                'Origin': 'https://localhost:8000'
            };
            console.log(`🍪 Setting credentials and headers for tile request: ${url.substring(0, 50)}...`);
        }
        
        const params: WorkerTileParameters = {
            request,
            uid: tile.uid,
            tileID: tile.tileID,
            zoom: tile.tileID.overscaledZ,
            tileSize: this.tileSize * tile.tileID.overscaleFactor(),
            type: this.type,
            source: this.id,
            pixelRatio: this.map.getPixelRatio(),
            showCollisionBoxes: this.map.showCollisionBoxes,
            promoteId: this.promoteId,
            subdivisionGranularity:
                this.map.style.projection.subdivisionGranularity,
        };
        params.request.collectResourceTiming = this._collectResourceTiming;
        let messageType: MessageType.loadTile | MessageType.reloadTile =
            MessageType.reloadTile;
        if (!tile.actor || tile.state === "expired") {
            tile.actor = this.dispatcher.getActor();
            messageType = MessageType.loadTile;
        } else if (tile.state === "loading") {
            return new Promise<void>((resolve, reject) => {
                tile.reloadPromise = { resolve, reject };
            });
        }
        tile.abortController = new AbortController();
        try {
            const data = await tile.actor.sendAsync(
                { type: messageType, data: params },
                tile.abortController
            );
            delete tile.abortController;

            if (tile.aborted) {
                return;
            }
            // The v2 map-session response hook. `params.request.url` is the URL WE SENT — signed or
            // not — which is what decides whether a 401 is about the credential we hold and whether
            // rollover headers may be adopted. A no-op unless map sessions are configured.
            mapSession.onTileResponse(params.request.url, 200, data && data.mapSessionHeaders);
            this._afterTileLoadWorkerResponse(tile, data);
        } catch (err) {
            delete tile.abortController;

            if (tile.aborted) {
                return;
            }
            mapSession.onTileResponse(params.request.url, (err && err.status) || 0);
            if (err && err.status !== 404) {
                throw err;
            }
            this._afterTileLoadWorkerResponse(tile, null);
        }
    }

    private _afterTileLoadWorkerResponse(tile: Tile, data: WorkerTileResult) {
        if (data && data.resourceTiming) {
            tile.resourceTiming = data.resourceTiming;
        }

        if (data && this.map._refreshExpiredTiles) {
            tile.setExpiryData(data);
        }
        tile.loadVectorData(data, this.map.painter);

        if (tile.reloadPromise) {
            const reloadPromise = tile.reloadPromise;
            tile.reloadPromise = null;
            this.loadTile(tile)
                .then(reloadPromise.resolve)
                .catch(reloadPromise.reject);
        }
    }

    async abortTile(tile: Tile): Promise<void> {
        if (tile.abortController) {
            tile.abortController.abort();
            delete tile.abortController;
        }
        if (tile.actor) {
            await tile.actor.sendAsync({
                type: MessageType.abortTile,
                data: { uid: tile.uid, type: this.type, source: this.id },
            });
        }
    }

    async unloadTile(tile: Tile): Promise<void> {
        tile.unloadVectorData();
        if (tile.actor) {
            await tile.actor.sendAsync({
                type: MessageType.removeTile,
                data: {
                    uid: tile.uid,
                    type: this.type,
                    source: this.id,
                },
            });
        }
    }

    hasTransition() {
        return false;
    }
}
