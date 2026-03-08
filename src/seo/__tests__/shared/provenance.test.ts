import {describe, it, expect} from 'vitest';
import {generateProvenanceSchema} from '../../shared/provenance';

describe('provenance', () => {
    it('generates Dataset schema with all fields', () => {
        const schema = generateProvenanceSchema({
            source: 'OpenStreetMap contributors',
            license: 'ODbL',
            organization: 'MapAtlas',
            updated: '2026-03',
        }, 'Jordaan, Amsterdam');
        expect(schema['@type']).toBe('Dataset');
        expect(schema['provider']['name']).toBe('OpenStreetMap contributors');
        expect(schema['creator']['name']).toBe('MapAtlas');
        expect(schema['license']).toContain('odbl');
        expect(schema['spatialCoverage']['name']).toBe('Jordaan, Amsterdam');
    });

    it('includes dateModified from config', () => {
        const schema = generateProvenanceSchema({updated: '2026-03'}, 'Test');
        expect(schema['dateModified']).toBe('2026-03');
    });

    it('uses current date when updated not provided', () => {
        const schema = generateProvenanceSchema({}, 'Test');
        expect(schema['dateModified']).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('omits provider when source not provided', () => {
        const schema = generateProvenanceSchema({}, 'Test');
        expect(schema['provider']).toBeUndefined();
    });

    it('omits creator when organization not provided', () => {
        const schema = generateProvenanceSchema({}, 'Test');
        expect(schema['creator']).toBeUndefined();
    });
});
