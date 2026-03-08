import type {Feature, FeatureCollection} from 'geojson';
import type {SourceConfig} from '../shared/types';
import {getPreset} from '../shared/schema-presets';

const MAX_HTML_BYTES = 50 * 1024; // 50KB hard cap
const DEFAULT_FEATURE_LIMIT = 50;

export interface NoscriptOptions {
    featureLimit?: number;
}

/**
 * Escape HTML entities to prevent XSS in generated noscript content.
 */
function escapeHtml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Get the byte length of a string in UTF-8.
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
 * Resolve the schema.org type string for a source config.
 */
function resolveSchemaType(source: SourceConfig): string {
    if (source.schemaType) {
        const preset = getPreset(source.schemaType);
        if (preset) return preset.schemaType;
    }
    return 'Place';
}

/**
 * Render a single feature as an `<li>` element with microdata.
 */
function renderFeature(feature: Feature, schemaType: string): string {
    const props = feature.properties || {};
    const geomType = feature.geometry?.type;
    const name = props.name ? escapeHtml(String(props.name)) : '';
    const address = props.address ? escapeHtml(String(props.address)) : '';
    const description = props.description ? escapeHtml(String(props.description)) : '';

    let li = `<li itemscope itemtype="https://schema.org/${escapeHtml(schemaType)}">`;

    if (name) {
        li += `<span itemprop="name">${name}</span>`;
    }

    if (address) {
        li += ` <span itemprop="address">${address}</span>`;
    }

    if (description) {
        li += ` <span itemprop="description">${description}</span>`;
    }

    // Add coordinate meta tags for Point geometry
    if (geomType === 'Point' && feature.geometry && 'coordinates' in feature.geometry) {
        const coords = feature.geometry.coordinates as number[];
        const lng = coords[0];
        const lat = coords[1];
        li += `<span itemprop="geo" itemscope itemtype="https://schema.org/GeoCoordinates">`;
        li += `<meta itemprop="latitude" content="${lat}">`;
        li += `<meta itemprop="longitude" content="${lng}">`;
        li += `</span>`;
    }

    li += `</li>`;
    return li;
}

/**
 * Generates a `<noscript>` block containing a semantic HTML list of map features
 * with schema.org microdata for SEO/AEO purposes.
 */
export function generateNoscriptHtml(
    geojson: FeatureCollection,
    sources: SourceConfig[],
    options: NoscriptOptions
): string {
    const header = `<noscript><div class="mapmetrics-seo" role="complementary" aria-label="Map data">` +
        `<h2>Locations shown on this map</h2>`;
    const footer = `</div></noscript>`;

    let body = '';
    let currentBytes = byteLength(header) + byteLength(footer);

    for (const source of sources) {
        const featureLimit = source.featureLimit ?? options.featureLimit ?? DEFAULT_FEATURE_LIMIT;
        const schemaType = resolveSchemaType(source);

        const ulOpen = `<ul>`;
        const ulClose = `</ul>`;

        // Check if adding the ul tags would exceed the limit
        const ulOverhead = byteLength(ulOpen) + byteLength(ulClose);
        if (currentBytes + ulOverhead >= MAX_HTML_BYTES) break;

        let listItems = '';
        let featureCount = 0;

        for (const feature of geojson.features) {
            if (featureCount >= featureLimit) break;

            const li = renderFeature(feature, schemaType);
            const liBytes = byteLength(li);

            // Check if adding this feature would exceed the 50KB cap
            if (currentBytes + ulOverhead + byteLength(listItems) + liBytes >= MAX_HTML_BYTES) {
                break;
            }

            listItems += li;
            featureCount++;
        }

        if (featureCount > 0) {
            const section = ulOpen + listItems + ulClose;
            body += section;
            currentBytes += byteLength(section);
        }
    }

    return header + body + footer;
}
