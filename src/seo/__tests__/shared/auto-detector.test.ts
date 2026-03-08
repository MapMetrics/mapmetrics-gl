import {describe, it, expect, vi} from 'vitest';
import {autoDetectProperties} from '../../shared/auto-detector';

describe('autoDetectProperties', () => {
    it('detects title → name', () => {
        const result = autoDetectProperties({title: 'My Place'});
        expect(result['title']).toBe('name');
    });

    it('detects addr → address', () => {
        const result = autoDetectProperties({addr: '123 Main St'});
        expect(result['addr']).toBe('address');
    });

    it('detects stars → aggregateRating', () => {
        const result = autoDetectProperties({stars: 4.5});
        expect(result['stars']).toBe('aggregateRating');
    });

    it('detects tel → telephone', () => {
        const result = autoDetectProperties({tel: '+1234567890'});
        expect(result['tel']).toBe('telephone');
    });

    it('detects website → url', () => {
        const result = autoDetectProperties({website: 'https://example.com'});
        expect(result['website']).toBe('url');
    });

    it('returns empty mapping for unknown properties', () => {
        const result = autoDetectProperties({foo: 'bar', baz: 42});
        expect(Object.keys(result)).toHaveLength(0);
    });

    it('logs warning when auto-detection is used', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        autoDetectProperties({title: 'Test'});
        expect(warnSpy).toHaveBeenCalledWith(
            expect.stringContaining('MapMetrics GL SEO: auto-detected property mappings:')
        );
        warnSpy.mockRestore();
    });
});
