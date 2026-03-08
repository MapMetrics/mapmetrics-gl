import {describe, it, expect} from 'vitest';
import type {Feature, Point, Polygon} from 'geojson';
import {mapFeatureToSchema} from '../../shared/property-mapper';

const restaurantFeature: Feature<Point> = {
    type: 'Feature',
    geometry: {type: 'Point', coordinates: [4.8832, 52.3742]},
    properties: {
        name: 'Cafe de Klos',
        address: 'Keizersgracht 177, Amsterdam',
        cuisine: 'Dutch',
        rating: 4.7,
        ratingCount: 312,
        priceRange: '$$',
    },
};

const emptyFeature: Feature<Point> = {
    type: 'Feature',
    geometry: {type: 'Point', coordinates: [4.88, 52.37]},
    properties: {},
};

describe('mapFeatureToSchema', () => {
    it('maps Point to Restaurant schema with preset', () => {
        const schema = mapFeatureToSchema(restaurantFeature, 'restaurant', 'verified');
        expect(schema['@type']).toBe('Restaurant');
        expect(schema['name']).toBe('Cafe de Klos');
        expect(schema['address']).toBe('Keizersgracht 177, Amsterdam');
        expect(schema['servesCuisine']).toBe('Dutch');
    });

    it('includes geo coordinates for Point geometry', () => {
        const schema = mapFeatureToSchema(restaurantFeature, 'restaurant', 'verified');
        expect(schema['geo']).toEqual({
            '@type': 'GeoCoordinates',
            latitude: 52.3742,
            longitude: 4.8832,
        });
    });

    it('excludes trust-gated properties at basic trust level', () => {
        const schema = mapFeatureToSchema(restaurantFeature, 'restaurant', 'basic');
        expect(schema['aggregateRating']).toBeUndefined();
        expect(schema['priceRange']).toBeUndefined();
        expect(schema['name']).toBe('Cafe de Klos');
    });

    it('includes trust-gated properties at verified trust level', () => {
        const schema = mapFeatureToSchema(restaurantFeature, 'restaurant', 'verified');
        expect(schema['priceRange']).toBe('$$');
        expect(schema['aggregateRating']).toBeDefined();
        expect(schema['aggregateRating']).toEqual({
            '@type': 'AggregateRating',
            ratingValue: 4.7,
            ratingCount: 312,
        });
    });

    it('returns minimal schema for empty properties', () => {
        const schema = mapFeatureToSchema(emptyFeature, 'restaurant', 'basic');
        expect(schema['@type']).toBe('Restaurant');
        expect(schema['geo']).toEqual({
            '@type': 'GeoCoordinates',
            latitude: 52.37,
            longitude: 4.88,
        });
        expect(schema['name']).toBeUndefined();
    });
});
