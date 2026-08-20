import type {Feature, FeatureCollection} from 'geojson';
import type {
    GenerateMapSEOInput,
    GenerateMapSEOResult,
    SeoStats,
    SourceConfig,
} from '../shared/types';
import {getPreset} from '../shared/schema-presets';
import {applyPrivacyFilter} from '../shared/privacy-filter';
import {generateJsonLd} from './json-ld-generator';
import {generateNoscriptHtml} from './noscript-generator';
import {generateMetaTags} from './meta-tags-generator';
import {buildStaticImageUrl} from './static-image-url';

// Re-export individual generators for direct use
export {generateJsonLd} from './json-ld-generator';
export {generateNoscriptHtml} from './noscript-generator';
export {generateMetaTags} from './meta-tags-generator';
export {buildStaticImageUrl} from './static-image-url';

/**
 * Normalizes input geojson to a single FeatureCollection.
 * Handles both a direct FeatureCollection and a `Record<string, FeatureCollection>`.
 */
function normalizeToFeatureCollection(
    geojson: FeatureCollection | Record<string, FeatureCollection>
): FeatureCollection {
    if ('type' in geojson && geojson.type === 'FeatureCollection') {
        return geojson as FeatureCollection;
    }

    const allFeatures: Feature[] = [];
    for (const fc of Object.values(geojson as Record<string, FeatureCollection>)) {
        if (fc?.features) {
            allFeatures.push(...fc.features);
        }
    }

    return {
        type: 'FeatureCollection',
        features: allFeatures,
    };
}

/**
 * Computes the byte length of a UTF-8 string for estimatedHtmlSize.
 */
function byteLength(str: string): number {
    let len = 0;
    for (let i = 0; i < str.length; i++) {
        const code = str.charCodeAt(i);
        if (code <= 0x7f) len += 1;
        else if (code <= 0x7ff) len += 2;
        else if (code >= 0xd800 && code <= 0xdbff) { len += 4; i++; }
        else len += 3;
    }
    return len;
}

/**
 * Formats a byte count into a human-readable string (e.g. "1.2KB").
 */
function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`;
    return `${(bytes / 1024).toFixed(1)}KB`;
}

/**
 * Collects the unique schema.org type strings from source configs.
 */
function collectSchemaTypes(sources: SourceConfig[]): string[] {
    const types = new Set<string>();
    // Always include Map as it is always generated
    types.add('Map');
    for (const source of sources) {
        if (source.schemaType) {
            const preset = getPreset(source.schemaType);
            if (preset) {
                types.add(preset.schemaType);
            }
        }
    }
    return Array.from(types);
}

/**
 * Counts features by geometry type category.
 */
function countByGeometry(features: Feature[], featureLimit: number) {
    const limited = features.slice(0, featureLimit);
    let routes = 0;
    let zones = 0;

    for (const feature of limited) {
        const geomType = feature.geometry?.type;
        if (geomType === 'LineString' || geomType === 'MultiLineString') {
            routes++;
        } else if (geomType === 'Polygon' || geomType === 'MultiPolygon') {
            zones++;
        }
    }

    return {featuresIndexed: limited.length, routes, zones};
}

/**
 * Main entry point: generates all SEO/AEO artifacts for server-side rendering.
 *
 * 1. Normalizes input geojson (FeatureCollection or `Record<string, FeatureCollection>`)
 * 2. Applies privacy filter if options.privacy is provided
 * 3. Calls generateJsonLd
 * 4. Calls generateNoscriptHtml
 * 5. Calls generateMetaTags
 * 6. Calls buildStaticImageUrl (or null if not configured)
 * 7. Computes stats
 */
export function generateMapSEO(input: GenerateMapSEOInput): GenerateMapSEOResult {
    const {center, bounds, sources, options} = input;
    const featureLimit = options?.featureLimit ?? 50;

    // 1. Normalize geojson
    let fc = normalizeToFeatureCollection(input.geojson);

    // 2. Apply privacy filter
    if (options?.privacy) {
        fc = applyPrivacyFilter(fc, options.privacy);
    }

    // 3. Generate JSON-LD
    const jsonLd = generateJsonLd({
        geojson: fc,
        center,
        bounds,
        area: input.area,
        sources,
        options: {
            trustLevel: options?.trustLevel,
            provider: options?.provider,
            provenance: options?.provenance,
            featureLimit,
        },
    });

    // 4. Generate noscript HTML
    const noscriptHtml = generateNoscriptHtml(fc, sources, {
        featureLimit,
    });

    // 5. Generate meta tags
    const metaTags = generateMetaTags({
        center,
        area: input.area,
    });

    // 6. Build static image URL
    let staticImageUrl: string | null = null;
    if (options?.staticImage) {
        staticImageUrl = buildStaticImageUrl({
            center,
            zoom: input.zoom ?? 12,
            width: options.staticImage.width ?? 600,
            height: options.staticImage.height ?? 400,
            baseUrl: options.staticImage.baseUrl,
            style: options.staticImage.style,
            apiKey: options.staticImage.apiKey,
        });
    }

    // 7. Compute stats
    const {featuresIndexed, routes, zones} = countByGeometry(fc.features, featureLimit);
    const schemaTypes = collectSchemaTypes(sources);

    const totalHtmlSize = byteLength(jsonLd) + byteLength(noscriptHtml) + byteLength(metaTags);

    const stats: SeoStats = {
        featuresIndexed,
        routesIndexed: routes,
        zonesIndexed: zones,
        schemaTypes,
        estimatedHtmlSize: formatBytes(totalHtmlSize),
    };

    return {
        jsonLd,
        noscriptHtml,
        metaTags,
        staticImageUrl,
        schema: {},
        stats,
    };
}
