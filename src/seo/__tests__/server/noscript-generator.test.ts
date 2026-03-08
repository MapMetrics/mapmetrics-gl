import {describe, it, expect} from 'vitest';
import type {FeatureCollection} from 'geojson';
import {generateNoscriptHtml} from '../../server/noscript-generator';
import {restaurantsAmsterdam} from '../fixtures/restaurants';
import {cyclingRouteVondelpark} from '../fixtures/cycling-route';
import type {SourceConfig} from '../../shared/types';

const defaultSources: SourceConfig[] = [
    {id: 'restaurants', schemaType: 'restaurant'}
];

describe('noscript-generator', () => {
    it('wraps output in <noscript> tag', () => {
        const html = generateNoscriptHtml(restaurantsAmsterdam, defaultSources, {});
        expect(html).toMatch(/^<noscript>/);
        expect(html).toMatch(/<\/noscript>$/);
    });

    it('includes mapmetrics-seo class and aria attributes', () => {
        const html = generateNoscriptHtml(restaurantsAmsterdam, defaultSources, {});
        expect(html).toContain('class="mapmetrics-seo"');
        expect(html).toContain('role="complementary"');
        expect(html).toContain('aria-label="Map data"');
    });

    it('lists features with microdata', () => {
        const html = generateNoscriptHtml(restaurantsAmsterdam, defaultSources, {});
        expect(html).toContain('itemscope');
        expect(html).toContain('itemprop="name"');
        expect(html).toContain('Cafe de Klos');
    });

    it('includes coordinates as meta tags', () => {
        const html = generateNoscriptHtml(restaurantsAmsterdam, defaultSources, {});
        expect(html).toContain('itemprop="latitude"');
        expect(html).toContain('content="52.3742"');
    });

    it('respects feature limit', () => {
        const sources: SourceConfig[] = [
            {id: 'restaurants', schemaType: 'restaurant', featureLimit: 1}
        ];
        const html = generateNoscriptHtml(restaurantsAmsterdam, sources, {});
        const liCount = (html.match(/<li /g) || []).length;
        expect(liCount).toBe(1);
    });

    it('stays under 50KB', () => {
        // Create a large FeatureCollection with many features
        const manyFeatures: FeatureCollection = {
            type: 'FeatureCollection',
            features: Array.from({length: 2000}, (_, i) => ({
                type: 'Feature' as const,
                geometry: {type: 'Point' as const, coordinates: [4.88 + i * 0.001, 52.37 + i * 0.001]},
                properties: {
                    name: `Location ${i} with a moderately long name to use up space`,
                    address: `Street ${i}, Amsterdam, Netherlands, 1000AA`
                }
            }))
        };
        const sources: SourceConfig[] = [
            {id: 'big-source', schemaType: 'restaurant', featureLimit: 2000}
        ];
        const html = generateNoscriptHtml(manyFeatures, sources, {});
        const byteSize = new TextEncoder().encode(html).length;
        expect(byteSize).toBeLessThanOrEqual(50 * 1024);
    });

    it('generates route description for LineString', () => {
        const sources: SourceConfig[] = [
            {id: 'routes', schemaType: 'cycling'}
        ];
        const html = generateNoscriptHtml(cyclingRouteVondelpark, sources, {});
        expect(html).toContain('Cycling route');
    });
});
