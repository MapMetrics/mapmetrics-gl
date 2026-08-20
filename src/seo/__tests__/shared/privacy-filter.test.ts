import {describe, it, expect} from 'vitest';
import {applyPrivacyFilter} from '../../shared/privacy-filter';
import type {FeatureCollection} from 'geojson';

const makeCollection = (): FeatureCollection => ({
    type: 'FeatureCollection',
    features: [
        {
            type: 'Feature',
            geometry: {type: 'Point', coordinates: [4.8832456, 52.3742789]},
            properties: {
                name: 'Test Place',
                secret: 'hidden-value',
                rating: 4.5
            }
        },
        {
            type: 'Feature',
            geometry: {type: 'Point', coordinates: [4.8810123, 52.3730456]},
            properties: {
                name: 'Another Place',
                secret: 'also-hidden',
                rating: 3.0,
                category: 'restaurant'
            }
        }
    ]
});

describe('applyPrivacyFilter', () => {
    it('removes excluded properties from features', () => {
        const collection = makeCollection();
        const result = applyPrivacyFilter(collection, {
            excludeProperties: ['secret']
        });
        for (const feature of result.features) {
            expect(feature.properties).not.toHaveProperty('secret');
        }
    });

    it('preserves non-excluded properties', () => {
        const collection = makeCollection();
        const result = applyPrivacyFilter(collection, {
            excludeProperties: ['secret']
        });
        expect(result.features[0].properties.name).toBe('Test Place');
        expect(result.features[0].properties.rating).toBe(4.5);
    });

    it('filters features via excludeFeatures callback', () => {
        const collection = makeCollection();
        const result = applyPrivacyFilter(collection, {
            excludeFeatures: (f) => f.properties?.rating < 4
        });
        expect(result.features).toHaveLength(1);
        expect(result.features[0].properties.name).toBe('Test Place');
    });

    it('rounds Point coordinates to specified decimal places', () => {
        const collection = makeCollection();
        const result = applyPrivacyFilter(collection, {
            roundCoordinates: 2
        });
        const coords = (result.features[0].geometry as any).coordinates;
        expect(coords[0]).toBe(4.88);
        expect(coords[1]).toBe(52.37);
    });

    it('rounds LineString coordinates', () => {
        const collection: FeatureCollection = {
            type: 'FeatureCollection',
            features: [
                {
                    type: 'Feature',
                    geometry: {
                        type: 'LineString',
                        coordinates: [
                            [4.8832456, 52.3742789],
                            [4.8810123, 52.3730456]
                        ]
                    },
                    properties: {}
                }
            ]
        };
        const result = applyPrivacyFilter(collection, {roundCoordinates: 3});
        const coords = (result.features[0].geometry as any).coordinates;
        expect(coords[0]).toEqual([4.883, 52.374]);
        expect(coords[1]).toEqual([4.881, 52.373]);
    });

    it('rounds Polygon coordinates', () => {
        const collection: FeatureCollection = {
            type: 'FeatureCollection',
            features: [
                {
                    type: 'Feature',
                    geometry: {
                        type: 'Polygon',
                        coordinates: [[
                            [4.8832456, 52.3742789],
                            [4.8810123, 52.3730456],
                            [4.8800000, 52.3750000],
                            [4.8832456, 52.3742789]
                        ]]
                    },
                    properties: {}
                }
            ]
        };
        const result = applyPrivacyFilter(collection, {roundCoordinates: 2});
        const ring = (result.features[0].geometry as any).coordinates[0];
        expect(ring[0]).toEqual([4.88, 52.37]);
    });

    it('rounds MultiPolygon coordinates', () => {
        const collection: FeatureCollection = {
            type: 'FeatureCollection',
            features: [
                {
                    type: 'Feature',
                    geometry: {
                        type: 'MultiPolygon',
                        coordinates: [[[
                            [4.8832456, 52.3742789],
                            [4.8810123, 52.3730456],
                            [4.8800000, 52.3750000],
                            [4.8832456, 52.3742789]
                        ]]]
                    },
                    properties: {}
                }
            ]
        };
        const result = applyPrivacyFilter(collection, {roundCoordinates: 2});
        const ring = (result.features[0].geometry as any).coordinates[0][0];
        expect(ring[0]).toEqual([4.88, 52.37]);
    });

    it('returns unmodified collection when config is empty', () => {
        const collection = makeCollection();
        const result = applyPrivacyFilter(collection, {});
        expect(result.features).toHaveLength(2);
        expect(result.features[0].properties.secret).toBe('hidden-value');
        const coords = (result.features[0].geometry as any).coordinates;
        expect(coords[0]).toBe(4.8832456);
    });

    it('does not mutate the original collection', () => {
        const collection = makeCollection();
        const originalName = collection.features[0].properties.name;
        applyPrivacyFilter(collection, {excludeProperties: ['name']});
        expect(collection.features[0].properties.name).toBe(originalName);
    });
});
