import {describe, it, expect} from 'vitest';
import {generateJsonLd} from '../../server/json-ld-generator';
import {restaurantsAmsterdam} from '../fixtures/restaurants';
import {cyclingRouteVondelpark} from '../fixtures/cycling-route';
import {deliveryZones} from '../fixtures/delivery-zones';

const defaultCenter: [number, number] = [4.8832, 52.3742];
const defaultBounds: [[number, number], [number, number]] = [[4.85, 52.35], [4.92, 52.40]];

describe('generateJsonLd', () => {
    it('generates valid JSON-LD script tag', () => {
        const result = generateJsonLd({
            geojson: restaurantsAmsterdam,
            center: defaultCenter,
            bounds: defaultBounds,
            sources: [{id: 'restaurants', schemaType: 'restaurant'}],
        });

        expect(result).toContain('<script type="application/ld+json">');
        expect(result).toContain('</script>');

        // Extract all JSON blocks from script tags
        const jsonMatches = result.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g);
        expect(jsonMatches).not.toBeNull();
        expect(jsonMatches!.length).toBeGreaterThanOrEqual(1);

        // Each block should contain valid JSON with @context
        for (const match of jsonMatches!) {
            const jsonStr = match
                .replace('<script type="application/ld+json">', '')
                .replace('</script>', '');
            const parsed = JSON.parse(jsonStr);
            expect(parsed['@context']).toBe('https://schema.org');
        }
    });

    it('generates Map schema with Place and GeoShape', () => {
        const result = generateJsonLd({
            geojson: restaurantsAmsterdam,
            center: defaultCenter,
            bounds: defaultBounds,
            sources: [{id: 'restaurants', schemaType: 'restaurant'}],
        });

        const jsonMatches = result.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)!;
        const schemas = jsonMatches.map((m) => {
            const jsonStr = m
                .replace('<script type="application/ld+json">', '')
                .replace('</script>', '');
            return JSON.parse(jsonStr);
        });

        const mapSchema = schemas.find((s: Record<string, unknown>) => s['@type'] === 'Map');
        expect(mapSchema).toBeDefined();
        expect(mapSchema['contentLocation']).toBeDefined();
        expect(mapSchema['contentLocation']['@type']).toBe('Place');
        expect(mapSchema['contentLocation']['geo']).toBeDefined();
        expect(mapSchema['contentLocation']['geo']['@type']).toBe('GeoShape');
        expect(mapSchema['contentLocation']['geo']['box']).toContain('52.35');
    });

    it('generates ItemList with restaurant entities', () => {
        const result = generateJsonLd({
            geojson: restaurantsAmsterdam,
            center: defaultCenter,
            bounds: defaultBounds,
            sources: [{id: 'restaurants', schemaType: 'restaurant'}],
        });

        const jsonMatches = result.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)!;
        const schemas = jsonMatches.map((m) => {
            const jsonStr = m
                .replace('<script type="application/ld+json">', '')
                .replace('</script>', '');
            return JSON.parse(jsonStr);
        });

        // Should have multiple script blocks (Map + ItemList at minimum)
        expect(schemas.length).toBeGreaterThanOrEqual(2);

        const itemList = schemas.find((s: Record<string, unknown>) => s['@type'] === 'ItemList');
        expect(itemList).toBeDefined();
        expect(itemList['numberOfItems']).toBe(3);
        expect(itemList['itemListElement']).toHaveLength(3);
        expect(itemList['itemListElement'][0]['@type']).toBe('ListItem');
        expect(itemList['itemListElement'][0]['item']['@type']).toBe('Restaurant');
    });

    it('includes MapAtlas provider by default', () => {
        const result = generateJsonLd({
            geojson: restaurantsAmsterdam,
            center: defaultCenter,
            bounds: defaultBounds,
            sources: [{id: 'restaurants', schemaType: 'restaurant'}],
        });

        const jsonMatches = result.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)!;
        const schemas = jsonMatches.map((m) => {
            const jsonStr = m
                .replace('<script type="application/ld+json">', '')
                .replace('</script>', '');
            return JSON.parse(jsonStr);
        });

        const mapSchema = schemas.find((s: Record<string, unknown>) => s['@type'] === 'Map');
        expect(mapSchema['provider']).toBeDefined();
        expect(mapSchema['provider']['@type']).toBe('Organization');
        expect(mapSchema['provider']['name']).toBe('MapAtlas');
    });

    it('omits provider when false', () => {
        const result = generateJsonLd({
            geojson: restaurantsAmsterdam,
            center: defaultCenter,
            bounds: defaultBounds,
            sources: [{id: 'restaurants', schemaType: 'restaurant'}],
            options: {provider: false},
        });

        const jsonMatches = result.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)!;
        const schemas = jsonMatches.map((m) => {
            const jsonStr = m
                .replace('<script type="application/ld+json">', '')
                .replace('</script>', '');
            return JSON.parse(jsonStr);
        });

        const mapSchema = schemas.find((s: Record<string, unknown>) => s['@type'] === 'Map');
        expect(mapSchema['provider']).toBeUndefined();
    });

    it('generates Trip schema from LineString', () => {
        const result = generateJsonLd({
            geojson: cyclingRouteVondelpark,
            center: defaultCenter,
            bounds: defaultBounds,
            sources: [{id: 'cycling', schemaType: 'cycling'}],
        });

        const jsonMatches = result.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)!;
        const schemas = jsonMatches.map((m) => {
            const jsonStr = m
                .replace('<script type="application/ld+json">', '')
                .replace('</script>', '');
            return JSON.parse(jsonStr);
        });

        const itemList = schemas.find((s: Record<string, unknown>) => s['@type'] === 'ItemList');
        expect(itemList).toBeDefined();
        expect(itemList['itemListElement'][0]['item']['@type']).toBe('Trip');
        expect(itemList['itemListElement'][0]['item']['name']).toBe('Cycling route: Centraal to Vondelpark');
    });

    it('generates Service schema from Polygon', () => {
        const result = generateJsonLd({
            geojson: deliveryZones,
            center: defaultCenter,
            bounds: defaultBounds,
            sources: [{id: 'zones', schemaType: 'serviceArea'}],
        });

        const jsonMatches = result.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)!;
        const schemas = jsonMatches.map((m) => {
            const jsonStr = m
                .replace('<script type="application/ld+json">', '')
                .replace('</script>', '');
            return JSON.parse(jsonStr);
        });

        const itemList = schemas.find((s: Record<string, unknown>) => s['@type'] === 'ItemList');
        expect(itemList).toBeDefined();
        expect(itemList['itemListElement'][0]['item']['@type']).toBe('Service');
        expect(itemList['itemListElement'][0]['item']['name']).toBe('Free Delivery Zone');
    });

    it('respects featureLimit', () => {
        const result = generateJsonLd({
            geojson: restaurantsAmsterdam,
            center: defaultCenter,
            bounds: defaultBounds,
            sources: [{id: 'restaurants', schemaType: 'restaurant'}],
            options: {featureLimit: 1},
        });

        const jsonMatches = result.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)!;
        const schemas = jsonMatches.map((m) => {
            const jsonStr = m
                .replace('<script type="application/ld+json">', '')
                .replace('</script>', '');
            return JSON.parse(jsonStr);
        });

        const itemList = schemas.find((s: Record<string, unknown>) => s['@type'] === 'ItemList');
        expect(itemList).toBeDefined();
        expect(itemList['numberOfItems']).toBe(1);
        expect(itemList['itemListElement']).toHaveLength(1);
    });
});
