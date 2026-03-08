import type {SeoConfig, SourceConfig} from '../shared/types';
import type {FeatureCollection} from 'geojson';
import {generateJsonLd} from '../server/json-ld-generator';
import {generateNoscriptHtml} from '../server/noscript-generator';
import {SeoCache} from './cache';
import {DomInjector} from './dom-injector';

const DEBOUNCE_MS = 5000;

/**
 * Client-side SEO manager that automatically generates and injects
 * structured data (JSON-LD) and noscript fallback content into the DOM
 * based on map data.
 *
 * Created by the Map constructor when SEO config is provided.
 */
export class SeoManager {
    private _map: any;
    private _config: SeoConfig;
    private _cache: SeoCache;
    private _injector: DomInjector;
    private _debounceTimer: ReturnType<typeof setTimeout> | null = null;
    private _loadHandler: (() => void) | null = null;
    private _sourceDataHandler: (() => void) | null = null;

    constructor(map: any, config: SeoConfig) {
        this._map = map;
        this._config = config;
        this._cache = new SeoCache();
        this._injector = new DomInjector();

        if (!config.enabled) {
            return;
        }

        this._loadHandler = () => this._onLoad();
        this._sourceDataHandler = () => this._onSourceData();

        map.on('load', this._loadHandler);
        map.on('sourcedata', this._sourceDataHandler);
    }

    /**
     * Removes event listeners, clears cache, and removes all injected DOM elements.
     */
    destroy(): void {
        if (this._loadHandler) {
            this._map.off('load', this._loadHandler);
        }
        if (this._sourceDataHandler) {
            this._map.off('sourcedata', this._sourceDataHandler);
        }

        if (this._debounceTimer !== null) {
            clearTimeout(this._debounceTimer);
            this._debounceTimer = null;
        }

        this._cache.clear();
        this._injector.removeAll();

        this._loadHandler = null;
        this._sourceDataHandler = null;
    }

    /**
     * Handler for the map 'load' event.
     * Generates JSON-LD and noscript content and injects it into the DOM.
     */
    private _onLoad(): void {
        this._generateAndInject();
    }

    /**
     * Handler for the map 'sourcedata' event.
     * Debounces regeneration to avoid excessive updates.
     */
    private _onSourceData(): void {
        if (this._debounceTimer !== null) {
            clearTimeout(this._debounceTimer);
        }

        this._debounceTimer = setTimeout(() => {
            this._debounceTimer = null;
            this._generateAndInject();
        }, DEBOUNCE_MS);
    }

    /**
     * Collects features from all indexed sources, generates structured data,
     * and injects it into the DOM if the data has changed.
     */
    private _generateAndInject(): void {
        const {geojson, sources, dataString} = this._collectSourceData();

        // Check if data has changed since last injection
        if (!this._cache.hasChanged(dataString)) {
            return;
        }

        const center = this._map.getCenter();
        const bounds = this._map.getBounds();
        const sw = bounds.getSouthWest();
        const ne = bounds.getNorthEast();

        const jsonLdInput = {
            geojson,
            center: [center.lng, center.lat] as [number, number],
            bounds: [[sw.lng, sw.lat], [ne.lng, ne.lat]] as [[number, number], [number, number]],
            sources,
            options: {
                trustLevel: this._config.trustLevel,
                provider: this._config.provider,
                featureLimit: this._config.featureLimit,
            },
        };

        const jsonLdString = generateJsonLd(jsonLdInput);
        const noscriptHtml = generateNoscriptHtml(geojson, sources, {
            featureLimit: this._config.featureLimit,
        });

        // Cache the generated markup
        this._cache.set({jsonLd: jsonLdString, noscript: noscriptHtml});

        // Inject into DOM
        this._injector.injectJsonLd(jsonLdString);
        this._injector.injectNoscript(noscriptHtml, this._map.getContainer());

        // Log feature count
        const featureCount = geojson.features.length;
        console.log(`MapMetrics GL SEO: indexed ${featureCount} features from ${sources.length} source(s)`);
    }

    /**
     * Collects features from all configured source IDs using the map's
     * querySourceFeatures method.
     */
    private _collectSourceData(): {
        geojson: FeatureCollection;
        sources: SourceConfig[];
        dataString: string;
    } {
        const sourceIds = this._getSourceIds();
        const allFeatures: any[] = [];
        const sources: SourceConfig[] = [];

        for (const sourceId of sourceIds) {
            const features = this._map.querySourceFeatures(sourceId);
            if (features && features.length > 0) {
                allFeatures.push(...features);
                sources.push({
                    id: sourceId,
                    schemaType: this._getSchemaTypeForSource(sourceId),
                });
            }
        }

        const geojson: FeatureCollection = {
            type: 'FeatureCollection',
            features: allFeatures,
        };

        // Build a string representation for hash comparison
        const dataString = JSON.stringify(allFeatures.map((f: any) => ({
            g: f.geometry,
            p: f.properties,
        })));

        return {geojson, sources, dataString};
    }

    /**
     * Determines which source IDs to index. Uses the config's indexSources
     * if provided, otherwise discovers all geojson sources from the map style.
     */
    private _getSourceIds(): string[] {
        if (this._config.indexSources && this._config.indexSources.length > 0) {
            return this._config.indexSources;
        }

        // Auto-discover geojson sources from the map style
        const style = this._map.getStyle();
        if (!style || !style.sources) {
            return [];
        }

        return Object.entries(style.sources)
            .filter(([_, source]: [string, any]) => source.type === 'geojson')
            .map(([id]: [string, any]) => id);
    }

    /**
     * Gets the schema type for a given source from the config's propertyMap.
     */
    private _getSchemaTypeForSource(sourceId: string): any {
        if (this._config.propertyMap && this._config.propertyMap[sourceId]) {
            return this._config.propertyMap[sourceId].schemaType;
        }
        return undefined;
    }
}
