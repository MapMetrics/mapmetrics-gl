import {describe, it, expect} from 'vitest';
import {getPreset, ALL_PRESETS} from '../../shared/schema-presets';

describe('schema-presets', () => {
    it('returns restaurant preset with correct schema type', () => {
        const preset = getPreset('restaurant');
        expect(preset).toBeDefined();
        expect(preset.schemaType).toBe('Restaurant');
        expect(preset.geometryTypes).toContain('Point');
    });

    it('returns route preset for LineString', () => {
        const preset = getPreset('route');
        expect(preset.schemaType).toBe('Trip');
        expect(preset.geometryTypes).toContain('LineString');
    });

    it('returns serviceArea preset for Polygon', () => {
        const preset = getPreset('serviceArea');
        expect(preset.schemaType).toBe('Service');
        expect(preset.geometryTypes).toContain('Polygon');
    });

    it('returns undefined for unknown preset', () => {
        const preset = getPreset('unknown' as any);
        expect(preset).toBeUndefined();
    });

    it('has all 15 presets defined', () => {
        expect(Object.keys(ALL_PRESETS)).toHaveLength(15);
    });

    it('restaurant preset maps cuisine to servesCuisine', () => {
        const preset = getPreset('restaurant');
        expect(preset.propertyMappings['cuisine']).toBe('servesCuisine');
    });

    it('restaurant preset trust-gates rating and priceRange', () => {
        const preset = getPreset('restaurant');
        expect(preset.trustGated).toContain('rating');
        expect(preset.trustGated).toContain('priceRange');
    });

    it('store preset has no trust-gated properties', () => {
        const preset = getPreset('store');
        expect(preset.trustGated).toHaveLength(0);
    });

    it('route preset maps distance and duration', () => {
        const preset = getPreset('route');
        expect(preset.propertyMappings['distance']).toBe('distance');
        expect(preset.propertyMappings['duration']).toBe('duration');
    });

    it('serviceArea preset maps description', () => {
        const preset = getPreset('serviceArea');
        expect(preset.propertyMappings['description']).toBe('description');
    });
});
