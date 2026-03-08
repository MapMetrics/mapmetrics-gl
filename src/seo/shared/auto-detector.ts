/**
 * Property name inference engine.
 * Maps common GeoJSON property names to schema.org properties
 * using regex patterns (case-insensitive).
 */

const PROPERTY_PATTERNS: Array<{pattern: RegExp; schemaProperty: string}> = [
    {pattern: /^(name|title|label)$/i, schemaProperty: 'name'},
    {pattern: /^(address|addr|street|location)$/i, schemaProperty: 'address'},
    {pattern: /^(rating|stars|score)$/i, schemaProperty: 'aggregateRating'},
    {pattern: /^(phone|tel|telephone)$/i, schemaProperty: 'telephone'},
    {pattern: /^(url|website|href|link)$/i, schemaProperty: 'url'},
    {pattern: /^(description|desc|summary|about)$/i, schemaProperty: 'description'},
];

/**
 * Auto-detect schema.org property mappings from GeoJSON property names.
 * Returns a mapping of source property name -> schema.org property name.
 */
export function autoDetectProperties(properties: Record<string, unknown>): Record<string, string> {
    const mappings: Record<string, string> = {};

    for (const key of Object.keys(properties)) {
        for (const {pattern, schemaProperty} of PROPERTY_PATTERNS) {
            if (pattern.test(key)) {
                mappings[key] = schemaProperty;
                break;
            }
        }
    }

    if (Object.keys(mappings).length > 0) {
        console.warn(
            `MapMetrics GL SEO: auto-detected property mappings: ${JSON.stringify(mappings)}. Use seo.propertyMap for explicit control.`
        );
    }

    return mappings;
}
