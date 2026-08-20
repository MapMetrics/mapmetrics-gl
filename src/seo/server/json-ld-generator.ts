import type {Feature, FeatureCollection} from 'geojson';
import type {SourceConfig, ProvenanceConfig} from '../shared/types';
import {mapFeatureToSchema} from '../shared/property-mapper';
import {generateEntityLinks} from '../shared/entity-linker';
import {validateSchema} from '../shared/validator';
import {generateProvenanceSchema} from '../shared/provenance';

export type JsonLdInput = {
    geojson: FeatureCollection | Record<string, FeatureCollection>;
    center: [number, number];
    bounds: [[number, number], [number, number]];
    area?: string;
    sources: SourceConfig[];
    options?: {
        trustLevel?: 'basic' | 'verified';
        provider?: {name: string} | false;
        provenance?: ProvenanceConfig;
        featureLimit?: number;
    };
};

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

    // Record<string, FeatureCollection> - merge all features
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

function wrapScriptTag(schema: Record<string, unknown>): string {
    return `<script type="application/ld+json">${JSON.stringify(schema, null, 2)}</script>`;
}

/**
 * Generates the Map schema with Place/GeoShape for the center and bounds.
 */
function generateMapSchema(
    center: [number, number],
    bounds: [[number, number], [number, number]],
    provider?: {name: string} | false,
): Record<string, unknown> {
    const [[swLng, swLat], [neLng, neLat]] = bounds;

    const schema: Record<string, unknown> = {
        '@context': 'https://schema.org',
        '@type': 'Map',
        'contentLocation': {
            '@type': 'Place',
            'geo': {
                '@type': 'GeoShape',
                'box': `${swLat} ${swLng} ${neLat} ${neLng}`,
            },
        },
    };

    // Include provider (default: MapAtlas, omit if explicitly false)
    if (provider !== false) {
        const providerName = provider?.name ?? 'MapAtlas';
        schema['provider'] = {
            '@type': 'Organization',
            'name': providerName,
        };
    }

    return schema;
}

/**
 * Generates an ItemList schema for a source's features.
 */
function generateItemListSchema(
    features: Feature[],
    source: SourceConfig,
    trustLevel: 'basic' | 'verified',
    featureLimit: number,
): Record<string, unknown> {
    const limitedFeatures = features.slice(0, featureLimit);

    const itemListElement = limitedFeatures.map((feature, index) => {
        // Map feature to schema
        let itemSchema = mapFeatureToSchema(feature, source.schemaType, trustLevel);

        // Add entity links
        const props = feature.properties ?? {};
        const links = generateEntityLinks(props);
        if (links.sameAs.length > 0) {
            itemSchema['sameAs'] = links.sameAs;
        }
        if (links.identifier) {
            itemSchema['identifier'] = links.identifier;
        }

        // Validate schema (strip unknown properties)
        itemSchema = validateSchema(itemSchema);

        return {
            '@type': 'ListItem',
            'position': index + 1,
            'item': itemSchema,
        };
    });

    return {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        'numberOfItems': limitedFeatures.length,
        itemListElement,
    };
}

/**
 * Generates JSON-LD `<script type="application/ld+json">` tags for server-side rendering.
 */
export function generateJsonLd(input: JsonLdInput): string {
    const {center, bounds, sources, options} = input;
    const trustLevel = options?.trustLevel ?? 'basic';
    const globalFeatureLimit = options?.featureLimit ?? 50;
    const provider = options?.provider;
    const provenance = options?.provenance;
    const area = input.area;

    const fc = normalizeToFeatureCollection(input.geojson);
    const tags: string[] = [];

    // 1. Map schema with Place/GeoShape
    const mapSchema = generateMapSchema(center, bounds, provider);
    tags.push(wrapScriptTag(mapSchema));

    // 2. For each source, generate ItemList
    for (const source of sources) {
        const featureLimit = source.featureLimit ?? globalFeatureLimit;
        const itemListSchema = generateItemListSchema(fc.features, source, trustLevel, featureLimit);
        tags.push(wrapScriptTag(itemListSchema));
    }

    // 3. Provenance Dataset schema
    if (provenance) {
        const provenanceSchema = generateProvenanceSchema(provenance, area ?? '');
        provenanceSchema['@context'] = 'https://schema.org';
        tags.push(wrapScriptTag(provenanceSchema));
    }

    return tags.join('\n');
}
