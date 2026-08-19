import {describe, test, expect, beforeEach, afterEach, vi} from 'vitest';
import {
    mapSession,
    MAX_CONSECUTIVE_HARD_FAILURES,
    MIN_HARD_FAILURE_SPACING_SECONDS,
    GIVE_UP_COOLDOWN_SECONDS,
    REFRESH_STALE_SECONDS
} from './map_session';
import {RequestManager, ResourceType} from './request_manager';

const ORIGIN = 'https://gateway.example.com';
const TILE = `${ORIGIN}/planet20251013/12/2094/1362.mvt?token=JWT`;

function nowSeconds() {
    return Math.floor(Date.now() / 1000);
}

/** A create/renew body the gateway would actually return. */
function body(overrides: any = {}) {
    return {
        account: 'acct-1',
        session_id: 'sess-1',
        expires_at: nowSeconds() + 1200,
        session_ends_at: nowSeconds() + 1800,
        key_id: '1',
        sig: 'SIG1',
        ...overrides
    };
}

function rolloverHeaders(overrides: any = {}) {
    return {
        'x-map-session-id': 'sess-2',
        'x-map-session-sig': 'SIG2',
        'x-map-session-exp': String(nowSeconds() + 2400),
        'x-map-session-ends': String(nowSeconds() + 3000),
        'x-map-session-key-id': '2',
        ...overrides
    };
}

function setVisibility(state: 'visible' | 'hidden') {
    Object.defineProperty(document, 'visibilityState', {value: state, configurable: true});
    document.dispatchEvent(new Event('visibilitychange'));
}

/** Records every create/renew URL and resolves each one on demand. */
function stubTransport(response: {status: number; body: any} | null = {status: 200, body: body()}) {
    const calls: string[] = [];
    const pending: Array<(value: any) => void> = [];
    mapSession.transport = (url: string) => {
        calls.push(url);
        if (response) return Promise.resolve(response);
        return new Promise((resolve) => pending.push(resolve));
    };
    return {calls, pending};
}

beforeEach(() => {
    mapSession.reset();
    setVisibility('visible');
    vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
    mapSession.reset();
    vi.restoreAllMocks();
    vi.useRealTimers();
});

describe('additive by default', () => {
    test('signs nothing and issues no request until an API key is configured', () => {
        const {calls} = stubTransport();
        expect(mapSession.signUrl(TILE)).toBe(TILE);
        expect(calls).toHaveLength(0);
        expect(mapSession.isEnabled()).toBe(false);
        // Nothing is learned either: an unconfigured SDK observes no gateway origin at all.
        expect(mapSession._origin).toBeNull();
    });

    test('RequestManager passes URLs through unchanged when unconfigured', () => {
        const manager = new RequestManager();
        expect(manager.transformRequest(TILE, ResourceType.Tile)).toEqual({url: TILE});
    });
});

describe('invariant 7 — merge query params, never replace', () => {
    beforeEach(() => {
        mapSession.configure({apiKey: 'KEY', gatewayOrigin: ORIGIN});
        mapSession.seedCredential('acct-1', 'sess-1', 'SIG1', nowSeconds() + 1200, nowSeconds() + 1800, '9');
    });

    test('the pre-existing ?token= survives alongside the six credential params', () => {
        const signed = new URL(mapSession.signUrl(TILE));
        expect(signed.searchParams.get('token')).toBe('JWT');
        expect(signed.searchParams.get('u')).toBe('acct-1');
        expect(signed.searchParams.get('s')).toBe('sess-1');
        expect(signed.searchParams.get('e')).toBe(String(mapSession._exp));
        expect(signed.searchParams.get('a')).toBe(String(mapSession._sae));
        expect(signed.searchParams.get('k')).toBe('9');
        expect(signed.searchParams.get('sig')).toBe('SIG1');
    });

    test('re-signing an already signed URL does not duplicate the credential params', () => {
        const twice = new URL(mapSession.signUrl(mapSession.signUrl(TILE)));
        expect(twice.searchParams.getAll('sig')).toEqual(['SIG1']);
        expect(twice.searchParams.getAll('u')).toEqual(['acct-1']);
        expect(twice.searchParams.getAll('token')).toEqual(['JWT']);
    });

    test('non-tile URLs are never signed', () => {
        const style = `${ORIGIN}/styles/light.json?token=JWT`;
        expect(mapSession.signUrl(style)).toBe(style);
    });
});

describe('invariant 5 — never send the API key to an unvalidated origin', () => {
    test('a configured origin is never re-learned from tile traffic', () => {
        mapSession.configure({apiKey: 'KEY', gatewayOrigin: ORIGIN});
        mapSession.signUrl('https://evil.example.net/12/2094/1362.mvt');
        expect(mapSession._origin).toBe(ORIGIN);
    });

    test('an unconfigured origin is learned ONCE and never re-pointed', () => {
        mapSession.configure({apiKey: 'KEY'});
        mapSession.signUrl(TILE);
        expect(mapSession._origin).toBe(ORIGIN);
        mapSession.signUrl('https://evil.example.net/12/2094/1362.mvt');
        expect(mapSession._origin).toBe(ORIGIN);
    });

    test('an http tile URL never becomes the learned origin', () => {
        mapSession.configure({apiKey: 'KEY'});
        mapSession.signUrl('http://gateway.example.com/12/2094/1362.mvt');
        expect(mapSession._origin).toBeNull();
    });

    test('scheme and port count, not just the host', () => {
        mapSession.configure({apiKey: 'KEY', gatewayOrigin: ORIGIN});
        mapSession.seedCredential('acct-1', 'sess-1', 'SIG1', nowSeconds() + 1200, nowSeconds() + 1800);
        const httpTile = 'http://gateway.example.com/12/2094/1362.mvt';
        const portTile = 'https://gateway.example.com:8443/12/2094/1362.mvt';
        expect(mapSession.signUrl(httpTile)).toBe(httpTile);
        expect(mapSession.signUrl(portTile)).toBe(portTile);
    });

    test('the create request goes to the pinned origin only', async () => {
        mapSession.configure({apiKey: 'SECRET', gatewayOrigin: ORIGIN});
        const {calls} = stubTransport();
        mapSession.refreshNow();
        await vi.waitFor(() => expect(calls).toHaveLength(1));
        expect(calls[0].startsWith(`${ORIGIN}/v2/map-sessions?token=SECRET`)).toBe(true);
    });

    test('a rollover credential from a foreign origin is refused', () => {
        mapSession.configure({apiKey: 'KEY', gatewayOrigin: ORIGIN});
        mapSession.seedCredential('acct-1', 'sess-1', 'SIG1', nowSeconds() + 100, nowSeconds() + 200);
        expect(mapSession.applyCredentialFromHeaders(rolloverHeaders(), 'https://evil.example.net/12/1/1.mvt')).toBe(false);
        expect(mapSession._sig).toBe('SIG1');
    });
});

describe('invariant 8 — adopt only a complete, newer, account-bound, unexpired credential', () => {
    beforeEach(() => {
        mapSession.configure({apiKey: 'KEY', gatewayOrigin: ORIGIN});
    });

    test('a create body with no account is refused', () => {
        expect(mapSession.adoptRefreshResponse(body({account: ''}))).toBe(false);
        expect(mapSession._sig).toBeNull();
    });

    test('a create body whose expiry is in the past is refused', () => {
        expect(mapSession.adoptRefreshResponse(body({expires_at: nowSeconds() - 1}))).toBe(false);
    });

    test('a create body with no session_ends_at is refused', () => {
        expect(mapSession.adoptRefreshResponse(body({session_ends_at: 0}))).toBe(false);
    });

    test('a well-formed create body is adopted', () => {
        expect(mapSession.adoptRefreshResponse(body())).toBe(true);
        expect(mapSession._account).toBe('acct-1');
        expect(mapSession._sig).toBe('SIG1');
    });

    test('an incomplete rollover header set is refused', () => {
        mapSession.seedCredential('acct-1', 'sess-1', 'SIG1', nowSeconds() + 100, nowSeconds() + 200);
        const partial = rolloverHeaders();
        delete partial['x-map-session-key-id'];
        expect(mapSession.applyCredentialFromHeaders(partial, TILE)).toBe(false);
        expect(mapSession._sig).toBe('SIG1');
    });

    test('a rollover that is not newer is refused', () => {
        mapSession.seedCredential('acct-1', 'sess-1', 'SIG1', nowSeconds() + 5000, nowSeconds() + 6000);
        expect(mapSession.applyCredentialFromHeaders(rolloverHeaders(), TILE)).toBe(false);
        expect(mapSession._sig).toBe('SIG1');
    });

    test('a rollover with no known account is refused', () => {
        expect(mapSession.applyCredentialFromHeaders(rolloverHeaders(), TILE)).toBe(false);
    });

    test('a newer rollover for a known account is adopted', () => {
        mapSession.seedCredential('acct-1', 'sess-1', 'SIG1', nowSeconds() + 100, nowSeconds() + 200);
        expect(mapSession.applyCredentialFromHeaders(rolloverHeaders(), TILE)).toBe(true);
        expect(mapSession._sessionId).toBe('sess-2');
        expect(mapSession._keyId).toBe('2');
    });
});

describe('invariant 3 — a 401 only counts when it is about the credential we hold', () => {
    beforeEach(() => {
        mapSession.configure({apiKey: 'KEY', gatewayOrigin: ORIGIN});
    });

    test('a 401 on an unsigned tile bootstraps when no credential is held', () => {
        expect(mapSession.shouldRefreshForResponseUrl(TILE)).toBe(true);
    });

    test('a 401 on an unsigned tile is ignored once a credential IS held', () => {
        mapSession.seedCredential('acct-1', 'sess-1', 'SIG1', nowSeconds() + 100, nowSeconds() + 200);
        expect(mapSession.shouldRefreshForResponseUrl(TILE)).toBe(false);
    });

    test('a 401 naming a session we have already replaced is ignored', () => {
        mapSession.seedCredential('acct-1', 'sess-2', 'SIG2', nowSeconds() + 100, nowSeconds() + 200);
        expect(mapSession.shouldRefreshForResponseUrl(`${TILE}&s=sess-1&sig=SIG1`)).toBe(false);
    });

    test('a 401 naming the session we hold is acted on', () => {
        mapSession.seedCredential('acct-1', 'sess-1', 'SIG1', nowSeconds() + 100, nowSeconds() + 200);
        expect(mapSession.shouldRefreshForResponseUrl(`${TILE}&s=sess-1&sig=SIG1`)).toBe(true);
    });
});

describe('invariant 4 — spacing and budget on tile-401-driven refreshes', () => {
    beforeEach(() => {
        mapSession.configure({apiKey: 'KEY', gatewayOrigin: ORIGIN});
        mapSession.seedCredential('acct-1', 'sess-1', 'SIG1', nowSeconds() + 100, nowSeconds() + 200);
    });

    const signed401 = () => mapSession.shouldRefreshForResponseUrl(`${TILE}&s=sess-1&sig=SIG1`);

    test('a burst of 401s from tiles in flight together authorises exactly one refresh', () => {
        const allowed = [signed401(), signed401(), signed401(), signed401()].filter(Boolean);
        expect(allowed).toHaveLength(1);
    });

    test('a persistently rejected credential gives up rather than looping on billed creates', () => {
        expect(signed401()).toBe(true);
        for (let i = 0; i < MAX_CONSECUTIVE_HARD_FAILURES; i++) {
            mapSession.rewindClocks(MIN_HARD_FAILURE_SPACING_SECONDS);
            signed401();
        }
        expect(mapSession._gaveUp).toBe(true);
        mapSession.rewindClocks(MIN_HARD_FAILURE_SPACING_SECONDS);
        expect(signed401()).toBe(false);
    });

    test('a signed tile the gateway honours clears the count, so it is consecutive not cumulative', () => {
        expect(signed401()).toBe(true);
        mapSession.rewindClocks(MIN_HARD_FAILURE_SPACING_SECONDS);
        signed401();
        expect(mapSession._tile401Refreshes).toBeGreaterThan(0);
        mapSession.noteSignedTileAccepted();
        expect(mapSession._tile401Refreshes).toBe(0);
        expect(signed401()).toBe(true);
    });
});

describe('invariant 6 — bounded consecutive hard failures, with a way back', () => {
    beforeEach(() => {
        mapSession.configure({apiKey: 'KEY', gatewayOrigin: ORIGIN});
    });

    const hardFail = () => {
        mapSession.rewindClocks(MIN_HARD_FAILURE_SPACING_SECONDS);
        mapSession.handleRefreshFailure(401);
    };

    test('gives up after the budget and stops issuing billed creates', async () => {
        const {calls} = stubTransport();
        for (let i = 0; i < MAX_CONSECUTIVE_HARD_FAILURES; i++) hardFail();
        expect(mapSession._gaveUp).toBe(true);
        mapSession.refreshNow();
        await Promise.resolve();
        expect(calls).toHaveLength(0);
    });

    test('a transport failure does not spend the budget but does clear the in-flight flag', () => {
        mapSession._refreshInFlight = true;
        mapSession.handleRefreshFailure(0);
        expect(mapSession._hardFailures).toBe(0);
        expect(mapSession._refreshInFlight).toBe(false);
    });

    test('the tab becoming visible is the fast way back', async () => {
        const {calls} = stubTransport();
        for (let i = 0; i < MAX_CONSECUTIVE_HARD_FAILURES; i++) hardFail();
        setVisibility('hidden');
        setVisibility('visible');
        expect(mapSession._gaveUp).toBe(false);
        mapSession.refreshNow();
        await vi.waitFor(() => expect(calls).toHaveLength(1));
    });

    test('the cool-down is the slow way back for a map left open', async () => {
        const {calls} = stubTransport();
        for (let i = 0; i < MAX_CONSECUTIVE_HARD_FAILURES; i++) hardFail();
        mapSession.refreshNow();
        expect(calls).toHaveLength(0);
        mapSession.rewindClocks(GIVE_UP_COOLDOWN_SECONDS);
        mapSession.refreshNow();
        await vi.waitFor(() => expect(calls).toHaveLength(1));
    });

    test('a hard failure drops the credential so the renew branch cannot fail forever', () => {
        mapSession.seedCredential('acct-1', 'sess-1', 'SIG1', nowSeconds() + 100, nowSeconds() + 200);
        mapSession.handleRefreshFailure(403);
        expect(mapSession._sig).toBeNull();
        expect(mapSession._sessionId).toBeNull();
    });
});

describe('invariant 9 — concurrent creates coalesce onto one request', () => {
    test('many simultaneous cold-start tiles buy exactly one session', async () => {
        mapSession.configure({apiKey: 'KEY', gatewayOrigin: ORIGIN});
        const {calls, pending} = stubTransport(null);
        for (let i = 0; i < 20; i++) mapSession.signUrl(`${ORIGIN}/planet/12/2094/${1362 + i}.mvt?token=JWT`);
        expect(calls).toHaveLength(1);
        pending[0]({status: 200, body: body()});
        await vi.waitFor(() => expect(mapSession._sig).toBe('SIG1'));
        expect(calls).toHaveLength(1);
    });

    test('a wedged in-flight request is released once it is stale, so refreshing resumes', async () => {
        mapSession.configure({apiKey: 'KEY', gatewayOrigin: ORIGIN});
        const {calls} = stubTransport(null);
        mapSession.refreshNow();
        expect(calls).toHaveLength(1);
        mapSession.refreshNow();
        expect(calls).toHaveLength(1);
        mapSession.rewindClocks(REFRESH_STALE_SECONDS);
        mapSession.refreshNow();
        expect(calls).toHaveLength(2);
    });
});

describe('invariant 1 — never renew an idle map', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        mapSession.configure({apiKey: 'KEY', gatewayOrigin: ORIGIN, renewLeadTimeSeconds: 60});
    });

    test('an idle credential is not renewed when the timer fires', () => {
        const {calls} = stubTransport();
        mapSession.adoptRefreshResponse(body({expires_at: nowSeconds() + 61}));
        calls.length = 0;
        vi.advanceTimersByTime(2000);
        expect(calls).toHaveLength(0);
    });

    test('a credential that actually signed a tile IS renewed when the timer fires', () => {
        const {calls} = stubTransport();
        mapSession.adoptRefreshResponse(body({expires_at: nowSeconds() + 61}));
        mapSession.signUrl(TILE);
        expect(mapSession._activity).toBe(true);
        calls.length = 0;
        vi.advanceTimersByTime(2000);
        expect(calls).toHaveLength(1);
        expect(calls[0]).toContain('/v2/map-sessions/renew');
    });

    test('adopting a new credential resets the activity flag', () => {
        mapSession.adoptRefreshResponse(body());
        mapSession.signUrl(TILE);
        expect(mapSession._activity).toBe(true);
        mapSession.adoptRefreshResponse(body({session_id: 'sess-9', expires_at: nowSeconds() + 3000}));
        expect(mapSession._activity).toBe(false);
    });

    test('a tile that could NOT be signed is not billable use', () => {
        mapSession.adoptRefreshResponse(body());
        mapSession.signUrl('https://evil.example.net/12/2094/1362.mvt');
        expect(mapSession._activity).toBe(false);
    });

    test('a timer-driven refresh re-checks under the same gates it was scheduled under', () => {
        const {calls} = stubTransport();
        // A rollover credential — already charged for by the gateway — was adopted between the
        // timer body's check and the refresh. There is time on the clock, so nothing is owed.
        mapSession.adoptRefreshResponse(body({expires_at: nowSeconds() + 1200}));
        mapSession._activity = true;
        calls.length = 0;
        mapSession.refreshNow(true);
        expect(calls).toHaveLength(0);
        // The same call with no time left DOES buy the next window.
        mapSession._exp = nowSeconds() + 10;
        mapSession.refreshNow(true);
        expect(calls).toHaveLength(1);
    });

    test('the idle gate is re-checked at FIRE time, not at schedule time', () => {
        const {calls} = stubTransport();
        mapSession.adoptRefreshResponse(body({expires_at: nowSeconds() + 61}));
        mapSession.signUrl(TILE);
        calls.length = 0;
        // The map went idle after the timer was armed.
        mapSession._activity = false;
        vi.advanceTimersByTime(2000);
        expect(calls).toHaveLength(0);
    });
});

describe('invariant 2 — a hidden tab must not renew', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        mapSession.configure({apiKey: 'KEY', gatewayOrigin: ORIGIN, renewLeadTimeSeconds: 60});
    });

    test('hiding the tab clears the activity flag', () => {
        mapSession.adoptRefreshResponse(body());
        mapSession.signUrl(TILE);
        expect(mapSession._activity).toBe(true);
        setVisibility('hidden');
        expect(mapSession._activity).toBe(false);
    });

    test('a hidden tab does not renew when the timer fires', () => {
        const {calls} = stubTransport();
        mapSession.adoptRefreshResponse(body({expires_at: nowSeconds() + 61}));
        mapSession.signUrl(TILE);
        calls.length = 0;
        Object.defineProperty(document, 'visibilityState', {value: 'hidden', configurable: true});
        vi.advanceTimersByTime(2000);
        expect(calls).toHaveLength(0);
    });

    test('a visible tab with a lapsed credential and real use renews on restore', () => {
        const {calls} = stubTransport();
        mapSession.adoptRefreshResponse(body({expires_at: nowSeconds() + 30}));
        mapSession.signUrl(TILE);
        calls.length = 0;
        setVisibility('visible');
        expect(calls).toHaveLength(1);
    });

    test('restoring a tab that was never used does NOT renew', () => {
        const {calls} = stubTransport();
        mapSession.adoptRefreshResponse(body({expires_at: nowSeconds() + 30}));
        calls.length = 0;
        setVisibility('hidden');
        setVisibility('visible');
        expect(calls).toHaveLength(0);
    });
});

describe('composition with a user-supplied transformRequest', () => {
    beforeEach(() => {
        mapSession.configure({apiKey: 'KEY', gatewayOrigin: ORIGIN});
        mapSession.seedCredential('acct-1', 'sess-1', 'SIG1', nowSeconds() + 1200, nowSeconds() + 1800);
    });

    test('the application callback runs and its headers, credentials and URL rewrite survive', () => {
        const manager = new RequestManager((url) => ({
            url: url.replace('planet20251013', 'planet-rewritten'),
            headers: {'x-app': '1'},
            credentials: 'include'
        }));
        const result = manager.transformRequest(TILE, ResourceType.Tile);
        expect(result.headers).toEqual({'x-app': '1'});
        expect(result.credentials).toBe('include');
        expect(result.url).toContain('planet-rewritten');
        expect(new URL(result.url).searchParams.get('sig')).toBe('SIG1');
    });

    test('a callback that rewrites to a foreign origin is respected and NOT signed', () => {
        const manager = new RequestManager(() => ({url: 'https://cdn.example.net/12/2094/1362.mvt'}));
        const result = manager.transformRequest(TILE, ResourceType.Tile);
        expect(result.url).toBe('https://cdn.example.net/12/2094/1362.mvt');
    });

    test('setTransformRequest cannot clobber signing', () => {
        const manager = new RequestManager();
        manager.setTransformRequest((url) => ({url}));
        expect(new URL(manager.transformRequest(TILE, ResourceType.Tile).url).searchParams.get('sig')).toBe('SIG1');
    });
});

describe('one session per page', () => {
    test('two RequestManagers, standing in for two Maps, share one credential and one create', async () => {
        mapSession.configure({apiKey: 'KEY', gatewayOrigin: ORIGIN});
        const {calls, pending} = stubTransport(null);
        const a = new RequestManager();
        const b = new RequestManager();
        a.transformRequest(TILE, ResourceType.Tile);
        b.transformRequest(TILE, ResourceType.Tile);
        expect(calls).toHaveLength(1);
        pending[0]({status: 200, body: body()});
        await vi.waitFor(() => expect(mapSession._sig).toBe('SIG1'));
        const signedA = new URL(a.transformRequest(TILE, ResourceType.Tile).url);
        const signedB = new URL(b.transformRequest(TILE, ResourceType.Tile).url);
        expect(signedA.searchParams.get('s')).toBe(signedB.searchParams.get('s'));
    });
});

describe('errored tiles are retried once a credential exists', () => {
    test('adopting a credential notifies every registered map', () => {
        mapSession.configure({apiKey: 'KEY', gatewayOrigin: ORIGIN});
        const first = vi.fn();
        const second = vi.fn();
        mapSession.addCredentialListener(first);
        const unsubscribe = mapSession.addCredentialListener(second);
        mapSession.adoptRefreshResponse(body());
        expect(first).toHaveBeenCalledTimes(1);
        expect(second).toHaveBeenCalledTimes(1);
        unsubscribe();
        mapSession.adoptRefreshResponse(body({session_id: 'sess-9', expires_at: nowSeconds() + 3000}));
        expect(first).toHaveBeenCalledTimes(2);
        expect(second).toHaveBeenCalledTimes(1);
    });
});

describe('onTileResponse — the inbound hook', () => {
    beforeEach(() => {
        mapSession.configure({apiKey: 'KEY', gatewayOrigin: ORIGIN});
    });

    test('a 200 carrying rollover headers adopts them', () => {
        mapSession.seedCredential('acct-1', 'sess-1', 'SIG1', nowSeconds() + 100, nowSeconds() + 200);
        mapSession.onTileResponse(`${TILE}&s=sess-1&sig=SIG1`, 200, rolloverHeaders());
        expect(mapSession._sessionId).toBe('sess-2');
    });

    test('a 401 carrying rollover headers we refuse still falls through to recovery', () => {
        const {calls} = stubTransport();
        // No account is known, so the rollover is refused; the 401 must still bootstrap.
        mapSession.onTileResponse(TILE, 401, rolloverHeaders());
        expect(calls).toHaveLength(1);
    });

    test('a 200 on a signed tile clears the tile-401 budget', () => {
        mapSession.seedCredential('acct-1', 'sess-1', 'SIG1', nowSeconds() + 100, nowSeconds() + 200);
        mapSession._tile401Refreshes = 2;
        mapSession.onTileResponse(`${TILE}&s=sess-1&sig=SIG1`, 200);
        expect(mapSession._tile401Refreshes).toBe(0);
    });

    test('a 200 on an UNSIGNED tile does not clear the budget', () => {
        mapSession.seedCredential('acct-1', 'sess-1', 'SIG1', nowSeconds() + 100, nowSeconds() + 200);
        mapSession._tile401Refreshes = 2;
        mapSession.onTileResponse(TILE, 200);
        expect(mapSession._tile401Refreshes).toBe(2);
    });
});
