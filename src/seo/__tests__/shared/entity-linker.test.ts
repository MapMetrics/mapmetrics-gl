import {describe, it, expect} from 'vitest';
import {generateEntityLinks} from '../../shared/entity-linker';

describe('generateEntityLinks', () => {
    it('generates sameAs for osm_id', () => {
        const result = generateEntityLinks({osm_id: 'node/123456'});
        expect(result.sameAs).toContain('https://www.openstreetmap.org/node/123456');
    });

    it('generates identifier for osm_id', () => {
        const result = generateEntityLinks({osm_id: 'node/123456'});
        expect(result.identifier).toBeDefined();
        expect(result.identifier!['@type']).toBe('PropertyValue');
        expect(result.identifier!.value).toBe('node/123456');
    });

    it('generates sameAs for wikidata', () => {
        const result = generateEntityLinks({wikidata: 'Q12345'});
        expect(result.sameAs).toContain('https://www.wikidata.org/wiki/Q12345');
    });

    it('generates sameAs for url property', () => {
        const result = generateEntityLinks({url: 'https://example.com'});
        expect(result.sameAs).toContain('https://example.com');
    });

    it('generates sameAs for website property', () => {
        const result = generateEntityLinks({website: 'https://example.org'});
        expect(result.sameAs).toContain('https://example.org');
    });

    it('returns empty sameAs array for unknown properties', () => {
        const result = generateEntityLinks({name: 'Test', rating: 4.5});
        expect(result.sameAs).toEqual([]);
        expect(result.identifier).toBeUndefined();
    });

    it('combines multiple sources', () => {
        const result = generateEntityLinks({
            osm_id: 'way/789',
            wikidata: 'Q99999',
            url: 'https://example.com'
        });
        expect(result.sameAs).toHaveLength(3);
        expect(result.sameAs).toContain('https://www.openstreetmap.org/way/789');
        expect(result.sameAs).toContain('https://www.wikidata.org/wiki/Q99999');
        expect(result.sameAs).toContain('https://example.com');
        expect(result.identifier).toBeDefined();
    });

    it('does not duplicate url and website if they are the same', () => {
        const result = generateEntityLinks({
            url: 'https://example.com',
            website: 'https://example.com'
        });
        // Both map to sameAs, but same URL should not be duplicated
        const unique = new Set(result.sameAs);
        expect(unique.size).toBe(result.sameAs.length);
    });
});
