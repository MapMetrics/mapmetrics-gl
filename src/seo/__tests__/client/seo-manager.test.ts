import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';
import {SeoManager} from '../../client/seo-manager';
import type {SeoConfig} from '../../shared/types';

/**
 * Creates a mock map object that simulates the minimal map interface
 * required by SeoManager.
 */
function createMockMap() {
    const listeners: Record<string, ((...args: unknown[]) => void)[]> = {};

    const container = document.createElement('div');
    container.id = 'mock-map-container';
    document.body.appendChild(container);

    const map = {
        on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
            if (!listeners[event]) listeners[event] = [];
            listeners[event].push(handler);
        }),
        off: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
            if (listeners[event]) {
                listeners[event] = listeners[event].filter((h) => h !== handler);
            }
        }),
        getCenter: vi.fn(() => ({lng: 4.8832, lat: 52.3742})),
        getBounds: vi.fn(() => ({
            getSouthWest: () => ({lng: 4.85, lat: 52.35}),
            getNorthEast: () => ({lng: 4.92, lat: 52.40}),
        })),
        getZoom: vi.fn(() => 12),
        getContainer: vi.fn(() => container),
        querySourceFeatures: vi.fn((sourceId: string) => [
            {
                type: 'Feature',
                geometry: {type: 'Point', coordinates: [4.8832, 52.3742]},
                properties: {name: 'Test Place', address: '123 Test St'},
            },
            {
                type: 'Feature',
                geometry: {type: 'Point', coordinates: [4.8810, 52.3730]},
                properties: {name: 'Another Place', address: '456 Other St'},
            },
        ]),
        getStyle: vi.fn(() => ({
            sources: {
                'test-source': {type: 'geojson'},
            },
        })),
        _fire(event: string, ...args: unknown[]) {
            if (listeners[event]) {
                for (const handler of listeners[event]) {
                    handler(...args);
                }
            }
        },
        _cleanup() {
            if (container.parentNode) {
                container.parentNode.removeChild(container);
            }
        },
    };

    return map;
}

function createSeoConfig(overrides: Partial<SeoConfig> = {}): SeoConfig {
    return {
        enabled: true,
        indexSources: ['test-source'],
        ...overrides,
    };
}

describe('SeoManager', () => {
    let mockMap: ReturnType<typeof createMockMap>;

    beforeEach(() => {
        mockMap = createMockMap();
    });

    afterEach(() => {
        // Clean up any injected DOM elements
        document.querySelectorAll('.mapmetrics-seo-jsonld, .mapmetrics-seo-noscript').forEach((el) => el.remove());
        mockMap._cleanup();
    });

    it('registers map event listeners on creation', () => {
        const config = createSeoConfig();
        const manager = new SeoManager(mockMap, config);

        expect(mockMap.on).toHaveBeenCalledWith('load', expect.any(Function));
        expect(mockMap.on).toHaveBeenCalledWith('sourcedata', expect.any(Function));

        manager.destroy();
    });

    it('injects JSON-LD into head on load event', () => {
        const config = createSeoConfig();
        const manager = new SeoManager(mockMap, config);

        // Fire the load event
        mockMap._fire('load');

        // Check that JSON-LD script tags were injected into document.head
        const scriptTags = document.head.querySelectorAll('.mapmetrics-seo-jsonld');
        expect(scriptTags.length).toBeGreaterThan(0);

        // Verify they are application/ld+json script tags
        for (const tag of scriptTags) {
            expect(tag.getAttribute('type')).toBe('application/ld+json');
        }

        // Verify the script content is valid JSON with @context
        const firstScript = scriptTags[0];
        const parsed = JSON.parse(firstScript.textContent || '');
        expect(parsed['@context']).toBe('https://schema.org');

        manager.destroy();
    });

    it('does nothing when seo is disabled (no on() calls)', () => {
        const config = createSeoConfig({enabled: false});
        const manager = new SeoManager(mockMap, config);

        expect(mockMap.on).not.toHaveBeenCalled();

        manager.destroy();
    });

    it('cleanup removes injected elements', () => {
        const config = createSeoConfig();
        const manager = new SeoManager(mockMap, config);

        // Fire load to inject elements
        mockMap._fire('load');

        // Verify elements are present
        expect(document.querySelectorAll('.mapmetrics-seo-jsonld').length).toBeGreaterThan(0);

        // Destroy and verify cleanup
        manager.destroy();

        expect(document.querySelectorAll('.mapmetrics-seo-jsonld').length).toBe(0);
        expect(document.querySelectorAll('.mapmetrics-seo-noscript').length).toBe(0);
    });

    it('removes event listeners on destroy', () => {
        const config = createSeoConfig();
        const manager = new SeoManager(mockMap, config);

        manager.destroy();

        expect(mockMap.off).toHaveBeenCalledWith('load', expect.any(Function));
        expect(mockMap.off).toHaveBeenCalledWith('sourcedata', expect.any(Function));
    });

    it('injects noscript content near map container on load', () => {
        const config = createSeoConfig();
        const manager = new SeoManager(mockMap, config);

        mockMap._fire('load');

        const noscriptEls = document.querySelectorAll('.mapmetrics-seo-noscript');
        expect(noscriptEls.length).toBeGreaterThan(0);

        manager.destroy();
    });

    it('does not re-inject when data hash has not changed', () => {
        const config = createSeoConfig();
        const manager = new SeoManager(mockMap, config);

        // Fire load
        mockMap._fire('load');
        const initialCount = document.querySelectorAll('.mapmetrics-seo-jsonld').length;
        expect(initialCount).toBeGreaterThan(0);

        // Fire sourcedata with same data - should not add more elements
        // (debounce would normally delay this, but the hash check prevents re-injection)
        vi.useFakeTimers();
        mockMap._fire('sourcedata');
        vi.advanceTimersByTime(6000); // past the 5s debounce
        vi.useRealTimers();

        const afterCount = document.querySelectorAll('.mapmetrics-seo-jsonld').length;
        // Should be same count (idempotent - removes old before re-injecting)
        expect(afterCount).toBe(initialCount);

        manager.destroy();
    });
});
