/**
 * Generates entity links (sameAs and identifier) from feature properties
 * for schema.org linked data.
 */

export type EntityLinks = {
    sameAs: string[];
    identifier?: Record<string, unknown>;
};

/**
 * Generates schema.org entity links from feature properties.
 * Recognizes osm_id, wikidata, url, and website properties.
 */
export function generateEntityLinks(
    properties: Record<string, unknown>
): EntityLinks {
    const sameAs: string[] = [];
    let identifier: Record<string, unknown> | undefined;

    // OSM ID
    if (properties.osm_id && typeof properties.osm_id === 'string') {
        const osmId = properties.osm_id;
        sameAs.push(`https://www.openstreetmap.org/${osmId}`);
        identifier = {
            '@type': 'PropertyValue',
            propertyID: 'osm_id',
            value: osmId
        };
    }

    // Wikidata
    if (properties.wikidata && typeof properties.wikidata === 'string') {
        sameAs.push(`https://www.wikidata.org/wiki/${properties.wikidata}`);
    }

    // URL
    if (properties.url && typeof properties.url === 'string') {
        if (!sameAs.includes(properties.url)) {
            sameAs.push(properties.url);
        }
    }

    // Website (alternative property name)
    if (properties.website && typeof properties.website === 'string') {
        if (!sameAs.includes(properties.website)) {
            sameAs.push(properties.website);
        }
    }

    return identifier ? {sameAs, identifier} : {sameAs};
}
