/**
 * Schema.org validation utilities for SEO metadata generation.
 * Validates ratings, strips invalid schema properties, and detects spam patterns.
 */

const VALID_SCHEMA_PROPERTIES = new Set([
    '@type',
    '@context',
    'name',
    'address',
    'description',
    'url',
    'telephone',
    'geo',
    'aggregateRating',
    'servesCuisine',
    'priceRange',
    'openingHours',
    'starRating',
    'amenityFeature',
    'maximumAttendeeCapacity',
    'additionalType',
    'additionalProperty',
    'price',
    'numberOfRooms',
    'distance',
    'duration',
    'itinerary',
    'areaServed',
    'population',
    'transitTime',
    'shippingRate',
    'sameAs',
    'identifier',
    'image',
    'provider',
    'dateModified',
    'license',
    'creator',
    'spatialCoverage',
    'mainEntity',
    'numberOfItems',
    'itemListElement',
    'position',
    'item'
]);

/**
 * Validates a rating value and count for schema.org AggregateRating.
 * Returns null if the rating is invalid (undefined, out of 0-5 range, or count `<=` 0).
 */
export function validateRating(
    ratingValue: number | undefined,
    ratingCount: number
): {ratingValue: number; ratingCount: number} | null {
    if (ratingValue === undefined) return null;
    if (ratingValue < 0 || ratingValue > 5) return null;
    if (ratingCount <= 0) return null;

    return {ratingValue, ratingCount};
}

/**
 * Strips unknown properties from a schema object, keeping only schema.org valid ones.
 */
export function validateSchema(
    schema: Record<string, unknown>
): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(schema)) {
        if (VALID_SCHEMA_PROPERTIES.has(key)) {
            result[key] = schema[key];
        }
    }
    return result;
}

/**
 * Detects spam patterns in feature properties.
 * Warns via console.warn if all features share identical rating values.
 */
export function detectSpamPatterns(
    featureProps: Array<Record<string, unknown>>
): void {
    const ratings = featureProps
        .map((p) => p.rating)
        .filter((r) => r !== undefined && r !== null) as number[];

    if (ratings.length < 2) return;

    const allIdentical = ratings.every((r) => r === ratings[0]);
    if (allIdentical) {
        console.warn(
            `[mapmetrics-gl/seo] Spam pattern detected: all ${ratings.length} features have identical ratings (${ratings[0]})`
        );
    }
}
