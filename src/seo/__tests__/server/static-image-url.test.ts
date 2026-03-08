import {describe, it, expect} from 'vitest';
import {buildStaticImageUrl} from '../../server/static-image-url';

describe('static-image-url', () => {
    it('returns deterministic URL from same input', () => {
        const input = {center: [-73.9857, 40.7484] as [number, number], zoom: 12, width: 800, height: 600};
        const url1 = buildStaticImageUrl(input);
        const url2 = buildStaticImageUrl(input);
        expect(url1).toBe(url2);
    });

    it('includes center and zoom', () => {
        const url = buildStaticImageUrl({center: [-73.9857, 40.7484], zoom: 14, width: 800, height: 600});
        expect(url).toContain('center=40.7484,-73.9857');
        expect(url).toContain('zoom=14');
    });

    it('includes dimensions as size=WxH', () => {
        const url = buildStaticImageUrl({center: [0, 0], zoom: 1, width: 1024, height: 768});
        expect(url).toContain('size=1024x768');
    });

    it('uses custom baseUrl', () => {
        const url = buildStaticImageUrl({
            center: [0, 0],
            zoom: 1,
            width: 400,
            height: 300,
            baseUrl: 'https://custom.example.com/static',
        });
        expect(url).toMatch(/^https:\/\/custom\.example\.com\/static\?/);
    });

    it('returns null when input is null', () => {
        expect(buildStaticImageUrl(null)).toBeNull();
        expect(buildStaticImageUrl(undefined)).toBeNull();
    });
});
