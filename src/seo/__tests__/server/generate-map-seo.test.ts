import {describe, it, expect} from 'vitest';
import {generateMapSEO} from '../../server/index';
import {restaurantsAmsterdam} from '../fixtures/restaurants';
import {cyclingRouteVondelpark} from '../fixtures/cycling-route';
import {deliveryZones} from '../fixtures/delivery-zones';
import {edgeCases} from '../fixtures/edge-cases';
import type {GenerateMapSEOInput} from '../../shared/types';

const defaultCenter: [number, number] = [4.8832, 52.3742];
const defaultBounds: [[number, number], [number, number]] = [[4.85, 52.35], [4.92, 52.40]];

describe('generateMapSEO', () => {
    it('returns all expected keys', () => {
        const input: GenerateMapSEOInput = {
            geojson: restaurantsAmsterdam,
            center: defaultCenter,
            bounds: defaultBounds,
            sources: [{id: 'restaurants', schemaType: 'restaurant'}],
        };

        const result = generateMapSEO(input);

        expect(result).toHaveProperty('jsonLd');
        expect(result).toHaveProperty('noscriptHtml');
        expect(result).toHaveProperty('metaTags');
        expect(result).toHaveProperty('staticImageUrl');
        expect(result).toHaveProperty('schema');
        expect(result).toHaveProperty('stats');

        expect(typeof result.jsonLd).toBe('string');
        expect(typeof result.noscriptHtml).toBe('string');
        expect(typeof result.metaTags).toBe('string');
        expect(typeof result.schema).toBe('object');
        expect(typeof result.stats).toBe('object');
    });

    it('stats reflect correct feature count (3 restaurants)', () => {
        const input: GenerateMapSEOInput = {
            geojson: restaurantsAmsterdam,
            center: defaultCenter,
            bounds: defaultBounds,
            sources: [{id: 'restaurants', schemaType: 'restaurant'}],
        };

        const result = generateMapSEO(input);

        expect(result.stats.featuresIndexed).toBe(3);
    });

    it('stats include Restaurant in schemaTypes', () => {
        const input: GenerateMapSEOInput = {
            geojson: restaurantsAmsterdam,
            center: defaultCenter,
            bounds: defaultBounds,
            sources: [{id: 'restaurants', schemaType: 'restaurant'}],
        };

        const result = generateMapSEO(input);

        expect(result.stats.schemaTypes).toContain('Restaurant');
    });

    it('handles empty GeoJSON without crashing', () => {
        const emptyGeoJson = {type: 'FeatureCollection' as const, features: []};
        const input: GenerateMapSEOInput = {
            geojson: emptyGeoJson,
            center: defaultCenter,
            bounds: defaultBounds,
            sources: [{id: 'empty', schemaType: 'restaurant'}],
        };

        const result = generateMapSEO(input);

        expect(result.stats.featuresIndexed).toBe(0);
        // Map schema should always be present
        expect(result.jsonLd).toContain('Map');
    });

    it('handles edge case features from fixtures', () => {
        const input: GenerateMapSEOInput = {
            geojson: edgeCases,
            center: defaultCenter,
            bounds: defaultBounds,
            sources: [{id: 'edge', schemaType: 'poi'}],
        };

        // Should not throw
        const result = generateMapSEO(input);

        expect(result.stats.featuresIndexed).toBe(5);
        expect(typeof result.jsonLd).toBe('string');
        expect(typeof result.noscriptHtml).toBe('string');
    });

    it('applies privacy filter (excludeProperties removes osm_id from jsonLd)', () => {
        const input: GenerateMapSEOInput = {
            geojson: restaurantsAmsterdam,
            center: defaultCenter,
            bounds: defaultBounds,
            sources: [{id: 'restaurants', schemaType: 'restaurant'}],
            options: {
                privacy: {
                    excludeProperties: ['osm_id'],
                },
            },
        };

        const result = generateMapSEO(input);

        // osm_id should not appear in any output
        expect(result.jsonLd).not.toContain('osm_id');
        expect(result.jsonLd).not.toContain('node/123456');
    });

    it('routes produce Trip in schemaTypes and routesIndexed=1', () => {
        const input: GenerateMapSEOInput = {
            geojson: cyclingRouteVondelpark,
            center: defaultCenter,
            bounds: defaultBounds,
            sources: [{id: 'cycling', schemaType: 'cycling'}],
        };

        const result = generateMapSEO(input);

        expect(result.stats.schemaTypes).toContain('Trip');
        expect(result.stats.routesIndexed).toBe(1);
    });

    it('zones produce zonesIndexed=2', () => {
        const input: GenerateMapSEOInput = {
            geojson: deliveryZones,
            center: defaultCenter,
            bounds: defaultBounds,
            sources: [{id: 'zones', schemaType: 'serviceArea'}],
        };

        const result = generateMapSEO(input);

        expect(result.stats.zonesIndexed).toBe(2);
    });

    it('staticImageUrl is null when no image config', () => {
        const input: GenerateMapSEOInput = {
            geojson: restaurantsAmsterdam,
            center: defaultCenter,
            bounds: defaultBounds,
            sources: [{id: 'restaurants', schemaType: 'restaurant'}],
        };

        const result = generateMapSEO(input);

        expect(result.staticImageUrl).toBeNull();
    });
});
