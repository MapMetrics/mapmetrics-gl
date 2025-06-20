import {browser} from '../../util/browser';
import {coveringTiles} from '../../geo/projection/covering_tiles';
import type {Map} from '../map';
import type {SourceCache} from '../../source/source_cache';
import type {OverscaledTileID} from '../../source/tile_id';
import type {MapDataEvent} from '../events';

/**
 * Manages tile loading states and provides utilities to wait for tiles to load
 * before completing zoom animations.
 */
export class TileLoadingManager {
    private _map: Map;
    private _pendingTiles: Set<string> = new Set();
    private _loadingCallbacks: globalThis.Map<string, Array<() => void>> = new globalThis.Map();
    private _isWaitingForTiles: boolean = false;

    constructor(map: Map) {
        this._map = map;
        this._setupEventListeners();
    }

    /**
     * Sets up event listeners to track tile loading states
     */
    private _setupEventListeners(): void {
        // Listen for tile loading events
        this._map.on('sourcedata', (e: any) => {
            if (e.dataType === 'source' && e.tile) {
                const tileKey = e.tile.tileID.key;
                
                if (e.tile.state === 'loading') {
                    this._pendingTiles.add(tileKey);
                } else if (e.tile.state === 'loaded' || e.tile.state === 'errored') {
                    this._pendingTiles.delete(tileKey);
                    this._notifyTileLoaded(tileKey);
                }
            }
        });

        // Listen for source loading events
        this._map.on('data', (e: any) => {
            if (e.dataType === 'source' && e.tile) {
                const tileKey = e.tile.tileID.key;
                
                if (e.tile.state === 'loading') {
                    this._pendingTiles.add(tileKey);
                } else if (e.tile.state === 'loaded' || e.tile.state === 'errored') {
                    this._pendingTiles.delete(tileKey);
                    this._notifyTileLoaded(tileKey);
                }
            }
        });
    }

    /**
     * Notifies callbacks that a specific tile has loaded
     */
    private _notifyTileLoaded(tileKey: string): void {
        const callbacks = this._loadingCallbacks.get(tileKey);
        if (callbacks) {
            callbacks.forEach(callback => callback());
            this._loadingCallbacks.delete(tileKey);
        }
    }

    /**
     * Gets the current zoom level and calculates which tiles will be needed
     * at the target zoom level for zoom-out operations
     */
    private _getRequiredTilesForZoom(targetZoom: number): OverscaledTileID[] {
        if (!this._map.style) return [];

        const transform = this._map.transform;
        const currentZoom = transform.zoom;
        
        // Only handle zoom-out operations
        if (targetZoom >= currentZoom) return [];

        const requiredTiles: OverscaledTileID[] = [];
        
        // Get all source caches
        const sourceCaches = this._map.style.sourceCaches;
        for (const sourceId in sourceCaches) {
            const sourceCache = sourceCaches[sourceId];
            const source = sourceCache.getSource();
            
            // Create a temporary transform with the target zoom to calculate required tiles
            const tempTransform = transform.clone();
            tempTransform.setZoom(targetZoom);
            
            // Calculate which tiles will be needed at the target zoom
            const coveringTilesResult = coveringTiles(tempTransform, {
                tileSize: source.tileSize,
                minzoom: source.minzoom,
                maxzoom: source.maxzoom,
                roundZoom: source.roundZoom,
                reparseOverscaled: source.reparseOverscaled
            });

            // Filter to only include tiles that aren't already loaded
            for (const tileID of coveringTilesResult) {
                const tile = sourceCache.getTile(tileID);
                if (!tile || !tile.hasData()) {
                    requiredTiles.push(tileID);
                }
            }
        }

        return requiredTiles;
    }

    /**
     * Waits for all required tiles to load for a zoom-out operation
     * @param targetZoom - The target zoom level
     * @param timeout - Maximum time to wait in milliseconds (default: 5000ms)
     * @param enableFallback - Whether to pre-load fallback tiles from higher zoom levels (default: true)
     * @returns Promise that resolves when all tiles are loaded or timeout is reached
     */
    async waitForZoomOutTiles(targetZoom: number, timeout: number = 3500, enableFallback: boolean = true): Promise<boolean> {
        const requiredTiles = this._getRequiredTilesForZoom(targetZoom);
        
        if (requiredTiles.length === 0) {
            return true; // No tiles to wait for
        }

        return new Promise<boolean>((resolve) => {
            const startTime = browser.now();
            const tileKeys = new Set(requiredTiles.map(tile => tile.key));
            const loadedTiles = new Set<string>();
            const fallbackTileKeys = new Set<string>();
            const loadedFallbackTiles = new Set<string>();
            const rapidZoomFallbackKeys = new Set<string>();
            const loadedRapidZoomFallbackTiles = new Set<string>();
            let idleListener: any = null;
            let timeoutId: any = null;
            let renderTimeoutId: any = null;
            let fallbackTimeoutId: any = null;
            let rapidZoomTimeoutId: any = null;
            let finished = false;
            let fallbackZoom: number | null = null;
            let rapidZoomFallbackZoom: number | null = null;

            // Check if tiles are already loaded
            for (const tileID of requiredTiles) {
                const sourceCache = this._map.style?.sourceCaches[tileID.key.split('/')[0]];
                if (sourceCache) {
                    const tile = sourceCache.getTile(tileID);
                    if (tile && tile.hasData()) {
                        loadedTiles.add(tileID.key);
                    }
                }
            }

            // Helper to clean up listeners and resolve
            const finish = (result: boolean) => {
                if (finished) return;
                finished = true;
                if (idleListener) this._map.off('idle', idleListener);
                if (timeoutId) clearTimeout(timeoutId);
                if (renderTimeoutId) clearTimeout(renderTimeoutId);
                if (fallbackTimeoutId) clearTimeout(fallbackTimeoutId);
                if (rapidZoomTimeoutId) clearTimeout(rapidZoomTimeoutId);
                cleanup();
                resolve(result);
            };

            // Check if we have enough tiles loaded from any layer
            const checkCompletion = () => {
                const targetTilesReady = loadedTiles.size === tileKeys.size;
                const fallbackTilesReady = fallbackTileKeys.size > 0 && loadedFallbackTiles.size === fallbackTileKeys.size;
                const rapidZoomFallbackReady = rapidZoomFallbackKeys.size > 0 && loadedRapidZoomFallbackTiles.size === rapidZoomFallbackKeys.size;
                
                if (targetTilesReady || fallbackTilesReady || rapidZoomFallbackReady) {
                    // Wait for the map to become idle (all tiles rendered)
                    idleListener = () => finish(true);
                    this._map.once('idle', idleListener);
                    
                    // Fallback: if idle doesn't fire within 1 second, complete anyway
                    renderTimeoutId = setTimeout(() => {
                        if (!finished) {
                            finish(true);
                        }
                    }, 2000);
                }
            };

            // Listen for tile loading events
            const tileLoadHandler = (e: any) => {
                if (e.dataType === 'source' && e.tile) {
                    const tileKey = e.tile.tileID.key;
                    
                    // Check if it's a target tile
                    if (tileKeys.has(tileKey) && e.tile.state === 'loaded') {
                        loadedTiles.add(tileKey);
                        checkCompletion();
                    }
                    
                    // Check if it's a fallback tile
                    if (fallbackTileKeys.has(tileKey) && e.tile.state === 'loaded') {
                        loadedFallbackTiles.add(tileKey);
                        checkCompletion();
                    }
                    
                    // Check if it's a rapid zoom fallback tile
                    if (rapidZoomFallbackKeys.has(tileKey) && e.tile.state === 'loaded') {
                        loadedRapidZoomFallbackTiles.add(tileKey);
                        checkCompletion();
                    }
                }
            };

            // Clean up event listener when done
            const cleanup = () => {
                this._map.off('data', tileLoadHandler);
            };

            // Set up cleanup for both success and timeout cases
            this._map.on('data', tileLoadHandler);

            // Set up timeout
            timeoutId = setTimeout(() => finish(false), timeout);

            // Set up fallback tile pre-loading after a delay
            if (enableFallback) {
                fallbackTimeoutId = setTimeout(() => {
                    if (!finished && loadedTiles.size < tileKeys.size * 0.5) {
                        // If less than 50% of tiles are loaded, pre-load fallback tiles
                        // For zoom out, use lower zoom levels (targetZoom - 1)
                        fallbackZoom = targetZoom - 1;
                        const fallbackTiles = this._preloadFallbackTiles(targetZoom, fallbackZoom);
                        
                        // Track fallback tiles
                        for (const tileKey of fallbackTiles) {
                            fallbackTileKeys.add(tileKey);
                        }
                        
                        // Check if fallback tiles are already loaded
                        for (const tileKey of fallbackTileKeys) {
                            const [sourceId] = tileKey.split('/');
                            const sourceCache = this._map.style?.sourceCaches[sourceId];
                            if (sourceCache) {
                                const tile = sourceCache._tiles[tileKey];
                                if (tile && tile.hasData()) {
                                    loadedFallbackTiles.add(tileKey);
                                }
                            }
                        }
                        
                        checkCompletion();
                    }
                }, Math.min(timeout * 0.3, 1500)); // Pre-load after 30% of timeout or 1.5s, whichever is less
            }

            // Set up rapid zoom fallback - pre-load multiple zoom levels for rapid zooming
            rapidZoomTimeoutId = setTimeout(() => {
                if (!finished && loadedTiles.size < tileKeys.size * 0.3) {
                    // If less than 30% of tiles are loaded, pre-load multiple zoom levels
                    // For zoom out, use lower zoom levels (targetZoom - 1, targetZoom - 2, targetZoom - 3)
                    const rapidZoomLevels = [targetZoom - 1, targetZoom - 2, targetZoom - 3];
                    
                    for (const zoomLevel of rapidZoomLevels) {
                        if (zoomLevel >= 0) { // Min zoom level is 0
                            const rapidTiles = this._preloadFallbackTiles(targetZoom, zoomLevel);
                            
                            // Track rapid zoom fallback tiles
                            for (const tileKey of rapidTiles) {
                                rapidZoomFallbackKeys.add(tileKey);
                            }
                            
                            // Check if rapid zoom fallback tiles are already loaded
                            for (const tileKey of rapidTiles) {
                                const [sourceId] = tileKey.split('/');
                                const sourceCache = this._map.style?.sourceCaches[sourceId];
                                if (sourceCache) {
                                    const tile = sourceCache._tiles[tileKey];
                                    if (tile && tile.hasData()) {
                                        loadedRapidZoomFallbackTiles.add(tileKey);
                                    }
                                }
                            }
                        }
                    }
                    
                    checkCompletion();
                }
            }, Math.min(timeout * 0.5, 2000)); // Pre-load after 50% of timeout or 2s, whichever is less

            // Initial check
            checkCompletion();
        });
    }

    /**
     * Pre-loads tiles from the layer below the target zoom level as a fallback
     * @param targetZoom - The target zoom level
     * @param fallbackZoom - The zoom level below target to pre-load (default: targetZoom - 1)
     * @returns Array of tile keys that were pre-loaded
     */
    private _preloadFallbackTiles(targetZoom: number, fallbackZoom: number = targetZoom - 1): string[] {
        if (!this._map.style) return [];

        const transform = this._map.transform;
        const preloadedTiles: string[] = [];
        
        // Get all source caches
        const sourceCaches = this._map.style.sourceCaches;
        for (const sourceId in sourceCaches) {
            const sourceCache = sourceCaches[sourceId];
            const source = sourceCache.getSource();
            
            // Only pre-load if fallback zoom is within source bounds
            if (fallbackZoom > source.maxzoom || fallbackZoom < source.minzoom) {
                continue;
            }
            
            // Create a temporary transform with the fallback zoom to calculate tiles
            const tempTransform = transform.clone();
            tempTransform.setZoom(fallbackZoom);
            
            // Calculate which tiles will be needed at the fallback zoom
            const coveringTilesResult = coveringTiles(tempTransform, {
                tileSize: source.tileSize,
                minzoom: source.minzoom,
                maxzoom: source.maxzoom,
                roundZoom: source.roundZoom,
                reparseOverscaled: source.reparseOverscaled
            });

            // Pre-load tiles that aren't already loaded
            for (const tileID of coveringTilesResult) {
                const tile = sourceCache.getTile(tileID);
                if (!tile || !tile.hasData()) {
                    // Force load the tile
                    sourceCache._addTile(tileID);
                    preloadedTiles.push(tileID.key);
                }
            }
        }

        return preloadedTiles;
    }

    /**
     * Checks if the manager is currently waiting for tiles to load
     */
    isWaitingForTiles(): boolean {
        return this._isWaitingForTiles;
    }

    /**
     * Gets the number of pending tiles
     */
    getPendingTileCount(): number {
        return this._pendingTiles.size;
    }

    /**
     * Clears all pending tiles and callbacks
     */
    clear(): void {
        this._pendingTiles.clear();
        this._loadingCallbacks.clear();
        this._isWaitingForTiles = false;
    }
} 