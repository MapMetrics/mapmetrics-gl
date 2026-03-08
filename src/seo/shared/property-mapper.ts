import type {Feature} from 'geojson';
import type {PresetType} from './types';
import {getPreset} from './schema-presets';
import {autoDetectProperties} from './auto-detector';

/**
 * Maps a GeoJSON Feature to a schema.org-compatible object
 * using presets or auto-detection.
 */
export function mapFeatureToSchema(
    feature: Feature,
    presetType: PresetType | undefined,
    trustLevel: 'basic' | 'verified',
): Record<string, unknown> {
    const schema: Record<string, unknown> = {};
    const props = feature.properties ?? {};
    const preset = presetType ? getPreset(presetType) : undefined;

    // Set @type from preset or default to 'Place'
    schema['@type'] = preset ? preset.schemaType : 'Place';

    if (preset) {
        mapWithPreset(schema, props, preset, trustLevel);
    } else {
        mapWithAutoDetect(schema, props);
    }

    // Always add geo coordinates
    addGeoCoordinates(schema, feature);

    return schema;
}

function mapWithPreset(
    schema: Record<string, unknown>,
    props: Record<string, unknown>,
    preset: ReturnType<typeof getPreset>,
    trustLevel: 'basic' | 'verified',
): void {
    if (!preset) return;

    for (const [sourceKey, schemaKey] of Object.entries(preset.propertyMappings)) {
        const value = props[sourceKey];
        if (value === undefined || value === null || value === '') continue;

        // Skip trust-gated properties at basic level
        if (trustLevel === 'basic' && preset.trustGated.includes(sourceKey)) {
            continue;
        }

        // Handle aggregateRating specially
        if (schemaKey === 'aggregateRating') {
            handleAggregateRating(schema, props, sourceKey, trustLevel);
            continue;
        }

        // Skip sub-properties of aggregateRating (e.g. aggregateRating.ratingCount)
        if (schemaKey.startsWith('aggregateRating.')) {
            continue;
        }

        schema[schemaKey] = value;
    }
}

function handleAggregateRating(
    schema: Record<string, unknown>,
    props: Record<string, unknown>,
    ratingKey: string,
    trustLevel: 'basic' | 'verified',
): void {
    if (trustLevel !== 'verified') return;

    const ratingValue = props[ratingKey] as number | undefined;
    const ratingCount = props['ratingCount'] as number | undefined;

    // Only output when BOTH ratingValue (0-5) and ratingCount (>0) are present
    if (
        ratingValue !== undefined &&
        ratingValue !== null &&
        ratingCount !== undefined &&
        ratingCount !== null &&
        ratingValue >= 0 &&
        ratingValue <= 5 &&
        ratingCount > 0
    ) {
        schema['aggregateRating'] = {
            '@type': 'AggregateRating',
            ratingValue,
            ratingCount,
        };
    }
}

function mapWithAutoDetect(
    schema: Record<string, unknown>,
    props: Record<string, unknown>,
): void {
    const mappings = autoDetectProperties(props);

    for (const [sourceKey, schemaKey] of Object.entries(mappings)) {
        const value = props[sourceKey];
        if (value === undefined || value === null || value === '') continue;
        schema[schemaKey] = value;
    }
}

function addGeoCoordinates(schema: Record<string, unknown>, feature: Feature): void {
    const geometry = feature.geometry;

    if (geometry.type === 'Point') {
        const [longitude, latitude] = geometry.coordinates;
        schema['geo'] = {
            '@type': 'GeoCoordinates',
            latitude,
            longitude,
        };
    } else if (geometry.type === 'Polygon') {
        const ring = geometry.coordinates[0];
        const polygonString = ring
            .map(([lng, lat]) => `${lat},${lng}`)
            .join(' ');
        schema['geo'] = {
            '@type': 'GeoShape',
            polygon: polygonString,
        };
    }
}
