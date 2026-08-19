import {describe, test, expect} from 'vitest';
import {
    MAPMETRICS_GATEWAY_HOSTS,
    isMapMetricsGatewayUrl,
    isCredentialExemptUrl,
    shouldForceGatewayCredentials
} from './mapmetrics_hosts';

/**
 * These are billing/auth guards, not formatting tests. Every case below fails loudly if the
 * predicate is loosened back into a substring match or if a host is added or dropped by accident.
 */
describe('isMapMetricsGatewayUrl', () => {

    test('matches the live production gateway', () => {
        expect(isMapMetricsGatewayUrl('https://gateway.mapmetrics-atlas.net/planet/12/2094/1362.mvt?token=x')).toBe(true);
    });

    test('matches the documented legacy gateway', () => {
        expect(isMapMetricsGatewayUrl('https://gateway.mapmetrics.org/styles/light.json')).toBe(true);
    });

    test('is case-insensitive on the host', () => {
        expect(isMapMetricsGatewayUrl('https://GATEWAY.MapMetrics-Atlas.NET/a/1/2/3.mvt')).toBe(true);
    });

    // The reason this module exists. `url.includes('gateway.mapmetrics.org')` said true here and
    // would have handed a third party the session cookie.
    test('does NOT match a foreign host that merely contains a gateway name', () => {
        expect(isMapMetricsGatewayUrl('https://attacker.example/?next=gateway.mapmetrics.org')).toBe(false);
        expect(isMapMetricsGatewayUrl('https://gateway.mapmetrics-atlas.net.attacker.example/1/2/3.mvt')).toBe(false);
        expect(isMapMetricsGatewayUrl('https://evil-gateway.mapmetrics.org.attacker.example/x')).toBe(false);
    });

    test('does NOT match sibling subdomains that are not gateways', () => {
        expect(isMapMetricsGatewayUrl('https://docs.mapmetrics.org/guide')).toBe(false);
        expect(isMapMetricsGatewayUrl('https://www.mapmetrics.org/')).toBe(false);
        expect(isMapMetricsGatewayUrl('https://mapmetrics.org/')).toBe(false);
    });

    test('does NOT match hosts dropped from the old lists', () => {
        // `gateway.mapmetrics1.org` never resolved and is intentionally not a gateway.
        expect(isMapMetricsGatewayUrl('https://gateway.mapmetrics1.org/1/2/3.mvt')).toBe(false);
        // The personal Cloudflare Worker the cookie prefetch used to call.
        expect(isMapMetricsGatewayUrl('https://twilight-bush-94ef.jim9710.workers.dev/20250110/1/1/0.mvt')).toBe(false);
    });

    test('fails closed on junk input', () => {
        expect(isMapMetricsGatewayUrl('')).toBe(false);
        expect(isMapMetricsGatewayUrl('not a url')).toBe(false);
        expect(isMapMetricsGatewayUrl(undefined as any)).toBe(false);
    });

    test('the exported host list is exactly the two intended gateways', () => {
        expect([...MAPMETRICS_GATEWAY_HOSTS].sort()).toEqual([
            'gateway.mapmetrics-atlas.net',
            'gateway.mapmetrics.org'
        ]);
    });
});

describe('isCredentialExemptUrl', () => {
    test('exempts fonts and sprites', () => {
        expect(isCredentialExemptUrl('https://gateway.mapmetrics-atlas.net/basemaps-assets/fonts/Noto/0-255.pbf')).toBe(true);
        expect(isCredentialExemptUrl('https://gateway.mapmetrics-atlas.net/fonts/Noto/0-255.pbf')).toBe(true);
        expect(isCredentialExemptUrl('https://gateway.mapmetrics-atlas.net/sprites/v4/light.png')).toBe(true);
    });

    test('does not exempt tiles', () => {
        expect(isCredentialExemptUrl('https://gateway.mapmetrics-atlas.net/planet/12/2094/1362.mvt')).toBe(false);
    });
});

describe('shouldForceGatewayCredentials', () => {
    test('forces credentials on gateway tiles', () => {
        expect(shouldForceGatewayCredentials('https://gateway.mapmetrics-atlas.net/planet/12/2094/1362.mvt?token=x')).toBe(true);
    });

    test('does not force credentials on gateway fonts or sprites', () => {
        expect(shouldForceGatewayCredentials('https://gateway.mapmetrics-atlas.net/basemaps-assets/fonts/Noto/0-255.pbf')).toBe(false);
        expect(shouldForceGatewayCredentials('https://gateway.mapmetrics-atlas.net/sprites/v4/light.json')).toBe(false);
    });

    test('does not force credentials on a non-gateway host, even for a tile path', () => {
        expect(shouldForceGatewayCredentials('https://tiles.example.com/planet/12/2094/1362.mvt')).toBe(false);
    });
});
