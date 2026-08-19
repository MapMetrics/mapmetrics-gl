/**
 * The single source of truth for "is this URL one of our gateways?".
 *
 * This predicate is BILLING-RELEVANT. Everything it returns `true` for gets cookies / the v2
 * map-session credential attached, so widening it leaks a user's session to a third-party host and
 * narrowing it silently un-authenticates tiles. Four separate copies of this rule used to live in
 * `util/ajax.ts`, `source/worker.ts`, `source/vector_tile_worker_source.ts` and
 * `util/image_request.ts`, each with a DIFFERENT host list, two of which named hosts that do not
 * resolve and therefore never fired. Change the list here and nowhere else.
 */

/**
 * Gateway hosts that are allowed to receive credentialed requests.
 *
 * Matched as whole hostnames, never as substrings. The previous `url.includes('mapmetrics.org')`
 * form also matched `docs.mapmetrics.org`, `www.mapmetrics.org` and — the reason this matters —
 * any attacker URL that merely CONTAINED the string, e.g.
 * `https://attacker.example/?next=gateway.mapmetrics.org`, which would have been handed the
 * session cookie.
 *
 * - `gateway.mapmetrics-atlas.net` is the live production gateway.
 * - `gateway.mapmetrics.org` does not currently resolve, but it is the host named throughout the
 *   README, the docs and the {@link configureMapSession} example, so it is retained as the
 *   documented/legacy production name. Listing a non-resolving host costs nothing: no request is
 *   ever made to it.
 *
 * Deliberately NOT listed: `gateway.mapmetrics1.org` (does not resolve, appears in no
 * documentation, and was only ever named by two of the four old copies — an artefact, not a host).
 */
export const MAPMETRICS_GATEWAY_HOSTS: ReadonlyArray<string> = [
    'gateway.mapmetrics-atlas.net',
    'gateway.mapmetrics.org'
];

/**
 * Path fragments served by the gateway that must NOT receive credentials.
 *
 * Fonts and sprites are public static assets. Requesting them with credentials forces a
 * non-wildcard CORS preflight for no benefit, and the callers that force credentials have always
 * carved them out.
 */
const CREDENTIAL_EXEMPT_PATH_FRAGMENTS: ReadonlyArray<string> = [
    '/fonts/',
    '/basemaps-assets/fonts/',
    '/sprites/'
];

/**
 * Parses `url` into a hostname.
 *
 * Absolute URLs are the only ones that can name a gateway, but a relative URL must not throw, so
 * it is resolved against the current document/worker location when there is one. If it cannot be
 * parsed at all the answer is "not a gateway" — failing closed, since the consequence of a wrong
 * `true` is disclosing a credential.
 *
 * @param url - the URL to inspect
 * @returns the lower-cased hostname, or null if `url` cannot be parsed
 */
function hostnameOf(url: string): string | null {
    if (!url) return null;
    try {
        return new URL(url).hostname.toLowerCase();
    } catch {
        // Not absolute. Try to resolve it against wherever we are running.
        try {
            const base = typeof self !== 'undefined' && self.location ? self.location.href : undefined;
            if (!base) return null;
            return new URL(url, base).hostname.toLowerCase();
        } catch {
            return null;
        }
    }
}

/**
 * Whether `url` points at a MapMetrics gateway and may therefore carry credentials.
 *
 * @param url - the request URL
 * @returns true if the URL's host is one of {@link MAPMETRICS_GATEWAY_HOSTS}
 */
export function isMapMetricsGatewayUrl(url: string): boolean {
    const host = hostnameOf(url);
    return host !== null && MAPMETRICS_GATEWAY_HOSTS.indexOf(host) !== -1;
}

/**
 * Whether `url` is a public gateway asset that should stay uncredentialed.
 *
 * @param url - the request URL
 * @returns true for font and sprite paths
 */
export function isCredentialExemptUrl(url: string): boolean {
    if (!url) return false;
    return CREDENTIAL_EXEMPT_PATH_FRAGMENTS.some(fragment => url.includes(fragment));
}

/**
 * Whether a request that did not ask for credentials should have them forced on.
 *
 * This is the form the tile-loading paths want: a gateway URL that is not a public asset.
 *
 * @param url - the request URL
 * @returns true if credentials should be forced onto this request
 */
export function shouldForceGatewayCredentials(url: string): boolean {
    return isMapMetricsGatewayUrl(url) && !isCredentialExemptUrl(url);
}
