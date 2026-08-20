import {makeRequest} from './ajax';
import {isMapMetricsGatewayUrl} from './mapmetrics_hosts';

/**
 * The six short-form credential parameters carried on a signed tile URL.
 *
 * `u` account, `s` session id, `e` expiry, `a` session-ends-at, `k` signing key id, `sig` HMAC.
 */
export const CREDENTIAL_PARAMS = ['u', 's', 'e', 'a', 'k', 'sig'] as const;

/**
 * The SHAPE of a tile path: its last three segments are `{z}/{x}/{y}.mvt`.
 *
 * A shape and not a prefix, because the gateway accepts a v2 session signature on the EXISTING
 * v1 tile path as well as on `/v2/tiles/...`. Both real forms
 *
 * ```
 * https://gateway.mapmetrics-atlas.net/planet20251013/12/2094/1362.mvt?token=<JWT>
 * https://gateway-staging.example.com/v2/tiles/12/2094/1362.mvt
 * ```
 *
 * satisfy this one predicate, so no style has to change and no list of known prefixes has to be
 * maintained. What contains the widened match is the ORIGIN pin below: this decides only what
 * might be LOOKED at, the origin rules decide what is trusted.
 */
export const TILE_PATH_REGEX = /\/\d+\/\d+\/\d+\.mvt$/;

/**
 * Three, not one and not ten. A single hard failure is legitimately reachable during a signing-key
 * rotation and giving up on it would blank a map that would have recovered. Three consecutive
 * failures spaced by {@link MIN_HARD_FAILURE_SPACING_SECONDS} are not a wobble.
 */
export const MAX_CONSECUTIVE_HARD_FAILURES = 3;

/**
 * The budget above counts ATTEMPTS, not round trips. Every unsigned tile that 401s drives another
 * refresh immediately, so a hundred in-flight tiles could burn three failures in under a second.
 * Failures closer together than this are the same incident.
 */
export const MIN_HARD_FAILURE_SPACING_SECONDS = 30;

/**
 * Even a "permanent" failure may not be: a key can be re-provisioned, or a bad gateway deployment
 * rolled back. After this long we try once more. Tab-visible is the fast path; this is for a map
 * left open in the foreground.
 */
export const GIVE_UP_COOLDOWN_SECONDS = 600;

/**
 * A create/renew in flight longer than this is treated as dead and the coalescing flag released.
 * If it were never released NOTHING would refresh again for the life of the page.
 */
export const REFRESH_STALE_SECONDS = 120;

/**
 * The `X-Map-Session-*` response headers a gateway ROLLOVER carries. The gateway lists all of them
 * in `Access-Control-Expose-Headers`, so a browser can read them cross-origin.
 */
export const SESSION_HEADER_PREFIX = 'x-map-session-';

/**
 * Options for {@link mapSession.configure}.
 */
export type MapSessionOptions = {
    /**
     * The MapMetrics API key. v2 map sessions are entirely inert until this is set.
     */
    apiKey?: string;
    /**
     * The gateway origin the API key may be POSTed to, for example `https://gateway.example.com`.
     * When omitted the origin is learned ONCE from the first https tile URL seen; see
     * {@link MapSession.signUrl}.
     */
    gatewayOrigin?: string;
    /**
     * The opt-OUT. Pass `false` to keep this page on v1 cookie billing.
     *
     * v2 map sessions are now on by DEFAULT: the SDK learns its own key from the gateway style URL
     * it already requests (see {@link MapSession.learnFromStyleUrl}), so a customer gets correct
     * per-window billing with no code change. That is the right default, but it must not be the only
     * option: an application diagnosing a tile-auth problem needs to be able to take the SDK's
     * signing out of the picture in one line and see the un-signed behaviour, and an account whose
     * key is genuinely not permitted to create sessions should be able to say so instead of
     * absorbing three failed creates on every load. Both are cheap now and expensive to retrofit
     * once apps depend on the default.
     *
     * `false` is a master switch, not merely a "do not learn": it makes {@link MapSession.isEnabled}
     * false, so nothing is signed even if an `apiKey` is passed in the same call. That is what makes
     * it usable as a debugging toggle.
     */
    enabled?: boolean;
};

/**
 * The transport seam used for create/renew. Replaced in tests so no traffic leaves the process.
 */
export type MapSessionTransport = (url: string) => Promise<{status: number; body: any}>;

const defaultTransport: MapSessionTransport = async (url: string) => {
    try {
        const response = await makeRequest({url, method: 'POST', type: 'json'}, new AbortController());
        return {status: 200, body: response.data};
    } catch (err) {
        return {status: (err?.status) || 0, body: null};
    }
};

/**
 * Owns the signed v2 map-session credential: it decides what to sign, when to buy the FIRST window,
 * and when a 401 is actually about the credential we hold.
 *
 * The whole point of the feature is ONE billed map load per window of use, so nearly every gate in
 * here is a billing gate rather than a correctness gate.
 *
 * THERE IS NO CLIENT-SIDE RENEWAL TIMER, and there must not be one again. Once the first credential
 * exists, every later window is bought by GATEWAY ROLLOVER: a tile presented with an `expired` or
 * `session_ended` credential is served INLINE, billed exactly once for the window, and the
 * replacement credential comes back on this response's `X-Map-Session-*` headers, which
 * {@link applyCredentialFromHeaders} adopts. That path is the only refresh path in normal operation.
 *
 * Rollover is not merely equivalent to a timer, it is STRUCTURALLY safer. A timer had to be gated —
 * on recorded activity, on tab visibility — to stop it billing a map nobody was looking at; a phone
 * left on a map overnight was measured billing ~16 windows for zero tile requests. Rollover cannot
 * do that, because it is demand-driven BY CONSTRUCTION: it can only fire when a tile is actually
 * requested. An idle map and a hidden tab request no tiles, so they cannot bill. Those two
 * properties stopped being guards that can be got wrong and became facts about the shape of the
 * system.
 *
 * There is exactly ONE instance per page ({@link mapSession}). Several `Map`s on one page share it,
 * otherwise each map would buy its own window.
 */
export class MapSession {
    // --- configuration ---------------------------------------------------------------
    _apiKey: string | null = null;
    /**
     * True once `configure()` supplied an apiKey. A key LEARNED from a style URL does not set this,
     * which is what lets {@link learnFromStyleUrl} tell "explicitly configured, hands off" from
     * "learned, and therefore already learned once".
     */
    _apiKeyIsConfigured: boolean = false;
    /** False only after an explicit `configure({enabled: false})`. See {@link MapSessionOptions.enabled}. */
    _enabled: boolean = true;

    // --- credential ------------------------------------------------------------------
    _account: string | null = null;
    _sessionId: string | null = null;
    _sig: string | null = null;
    _keyId: string | null = null;
    _exp: number = 0;
    _sae: number = 0;

    // --- gateway origin --------------------------------------------------------------
    _origin: string | null = null;
    _originIsConfigured: boolean = false;
    _loggedOriginMismatch: boolean = false;

    // --- refresh state ---------------------------------------------------------------
    _refreshInFlight: boolean = false;
    _refreshInFlightSince: number = 0;
    _hardFailures: number = 0;
    _lastCountedFailureAt: number = 0;
    _gaveUp: boolean = false;
    _gaveUpAt: number = 0;
    _lastTile401RefreshAt: number = 0;
    _tile401Refreshes: number = 0;
    _refreshDecisionCount: number = 0;

    _reloadListeners: Set<() => void> = new Set();
    _visibilityHandler: (() => void) | null = null;

    /** Replaced in tests. */
    transport: MapSessionTransport = defaultTransport;

    // ---------------------------------------------------------------------------------
    // Configuration
    // ---------------------------------------------------------------------------------

    /**
     * Enables v2 map sessions. Without an API key every hook in this class is a no-op, which is
     * what keeps an application that does nothing behaving exactly as it did before.
     * @param options - see {@link MapSessionOptions}
     */
    configure(options: MapSessionOptions) {
        if (options.enabled !== undefined) this._enabled = options.enabled !== false;
        if (options.apiKey !== undefined) {
            this._apiKey = options.apiKey || null;
            // Records the INTENT, not the value: `configure({apiKey: ''})` is still an explicit
            // statement that this application supplies its own key, and a style URL must not then
            // quietly substitute a different one.
            this._apiKeyIsConfigured = true;
        }
        if (options.gatewayOrigin) {
            // Configuration pins the origin the permanent, full-scope API key is POSTed to. Letting
            // a URL from a style document decide that would hand the customer's key to whoever
            // wrote the style. Once configured the origin is never learned from traffic.
            const pinned = originOf(options.gatewayOrigin);
            if (pinned) {
                this._origin = pinned;
                this._originIsConfigured = true;
            }
        }
        if (this._apiKey) this._installVisibilityHandler();

        // BUY THE CREDENTIAL NOW, not when the first tile needs signing.
        //
        // `transformRequest` is synchronous, so a tile that arrives before a credential exists goes
        // out UNSIGNED — and an unsigned tile still carries the style's `?token=`, which the gateway
        // bills through the v1 cookie path. Every tile in that window is therefore a separate map
        // load. Measured against staging from an empty meter: one page load cost 4-11 billed units,
        // all of them v1-path rows, because the lazy create in `signUrl` did not land until ten to
        // twelve seconds after the map started requesting tiles.
        //
        // Nothing makes this self-correcting, either: those unsigned tiles return 200, not 401, so
        // the 401-driven refresh never fires. The map looks perfect while it overbills.
        //
        // Only possible when the origin was PINNED by configuration. Without it the origin is
        // learned from the first https tile URL, and there is nowhere safe to POST the key yet.
        //
        // `!this._sig` keeps a repeat `configure()` from buying a second window: with a credential
        // already held there is nothing to buy, and `refreshNow()` is now always a CREATE.
        if (this._apiKey && this._origin && !this._sig) this.refreshNow();
    }

    /**
     * True once an API key is held — configured, or learned from a gateway style URL. Everything
     * else is inert until then, and stays inert after `configure({enabled: false})`.
     * @returns true if tiles may be signed
     */
    isEnabled(): boolean {
        return this._enabled && !!this._apiKey;
    }

    // ---------------------------------------------------------------------------------
    // Learning the key from the style request
    // ---------------------------------------------------------------------------------

    /**
     * THE DEFAULT-ON PATH. Learns the API key and gateway origin from a style URL the SDK was going
     * to request anyway, so an application gets correct per-window billing without calling
     * {@link configure} at all.
     *
     * It works because the credential is already on the wire. A production style URL is
     *
     * ```
     * https://gateway.mapmetrics-atlas.net/styles/?fileName=<uuid>/NightGrid.json&token=<JWT>
     * ```
     *
     * and `POST /v2/map-sessions?token=<T>` asks only that T's scope include `maps` — which that JWT
     * has. So the SDK can buy its own window with the credential it is already showing, and no style
     * has to change.
     *
     * THE HOST GUARD IS THE WHOLE SAFETY ARGUMENT. A style is a document a third party may control.
     * Without {@link isMapMetricsGatewayUrl} — an exact hostname match, never a substring — any
     * style could name an origin of its choosing and be handed the customer's key to POST there.
     * Learning ONLY from a known-gateway host is strictly SAFER than the pre-existing
     * trust-on-first-use origin learning in {@link signUrl}, which accepts any https tile host.
     *
     * Everything here degrades silently. A style with no `token=`, a customer-hosted or CDN-served
     * style, a style handed to the `Map` as an object rather than a URL: none of them learn, none of
     * them throw, and the map behaves exactly as it does today.
     * @param url - a URL about to be requested as {@link ResourceType.Style}
     */
    learnFromStyleUrl(url: string) {
        if (!this._enabled || !url) return;

        // LEARN ONCE. Style switching is a supported feature, so a second style load must not
        // re-point the key mid-session — the window already bought would be stranded and the next
        // create billed again. Re-learning is only permissible while nothing at all is held, which
        // is also what lets a first, token-less style leave the door open for a later one.
        if (this._apiKey || this._apiKeyIsConfigured) return;
        // Explicit configuration wins on the origin half too: an application that pinned
        // `gatewayOrigin` chose where its key may be POSTed, and a style document does not get to
        // revisit that decision by supplying a key for somewhere else.
        if (this._origin || this._originIsConfigured) return;

        // THE SECURITY GUARD. Do not weaken this to a substring or a suffix test.
        if (!isMapMetricsGatewayUrl(url)) return;

        let parsed: URL;
        try {
            parsed = new URL(url, typeof location !== 'undefined' ? location.href : undefined);
        } catch {
            return;
        }
        // Belt and braces with the host guard: the key is POSTed to this origin, so it may not
        // travel over cleartext even to a host on the allow-list.
        if (parsed.protocol !== 'https:') return;
        const token = parsed.searchParams.get('token');
        if (!token) return;

        this._apiKey = token;
        this._origin = originOf(parsed.href);
        if (!this._origin) {
            this._apiKey = null;
            return;
        }
        this._installVisibilityHandler();

        // MINT EAGERLY, exactly as the configured path does — see the long comment in
        // {@link configure}. `transformRequest` is synchronous, so any tile that arrives before a
        // credential exists goes out unsigned, still carrying the style's `?token=`, and is billed
        // through the v1 cookie path. Those tiles return 200, not 401, so nothing self-corrects. A
        // lazy create here measured 4-11 billed units for ONE page load; the style request is issued
        // before any tile request, so minting here lands the credential first.
        if (!this._sig) this.refreshNow();
    }

    // ---------------------------------------------------------------------------------
    // Signing
    // ---------------------------------------------------------------------------------

    /**
     * Appends `u/s/e/a/k/sig` if `url` is tile-shaped AND a credential with a known account is held
     * AND the URL's origin matches the pinned one. Returns the input unchanged otherwise and never
     * throws — an unsigned tile 401s and recovers, a thrown exception kills the request.
     * @param url - the URL about to be requested
     * @returns the signed URL, or `url` unchanged
     */
    signUrl(url: string): string {
        if (!this.isEnabled() || !url) return url;
        let parsed: URL;
        try {
            parsed = new URL(url, typeof location !== 'undefined' ? location.href : undefined);
        } catch {
            return url;
        }
        if (!TILE_PATH_REGEX.test(parsed.pathname)) return url;

        // Learn the gateway origin from the tile URL itself when nothing is configured, so the SDK
        // works against staging and production with no setup. Two constraints keep that safe
        // enough: https only (the API key is POSTed here later), and learned exactly ONCE, so a
        // later style can never re-point it.
        // THE SAME HOST GUARD AS learnFromStyleUrl. The learned origin decides two things, and
        // both are dangerous to get wrong: it is where the API key is later POSTed, and it is the
        // set of hosts whose tiles get SIGNED. A signed tile handed to a third party is a
        // replayable credential billed to this customer.
        //
        // Trust-on-first-use over plain https was the old behaviour and it is not a control: a
        // style document chooses its own tile URLs, so any host named there could become the
        // destination for `configureMapSession({apiKey})` when no `gatewayOrigin` was pinned. The
        // warning below was the only thing standing in the way.
        //
        // Cost of the guard: a gateway that is not on the allow-list — a staging deployment, a
        // self-hosted instance — must pass `gatewayOrigin` explicitly. That is the correct trade.
        if (!this._origin && !this._originIsConfigured && parsed.protocol === 'https:' && parsed.host
            && isMapMetricsGatewayUrl(parsed.href)) {
            this._origin = originOf(parsed.href);
            warnOnce(`map-session gateway origin LEARNED from tile traffic as "${this._origin}"; the API key will be POSTed there. Pass gatewayOrigin to configure it instead.`);
        }

        const isSameOrigin = !!this._origin && originOf(parsed.href) === this._origin;
        if (!isSameOrigin) {
            // Refusing to sign because of a host mismatch is a CONFIGURATION fault and is otherwise
            // entirely silent: every tile goes out unsigned, the gateway 401s, and the
            // session-identity gate correctly declines to buy a window for a 401 that is not about
            // our credential — so the map stays blank with nothing logged. Say so, ONCE.
            if (this._origin && !this._loggedOriginMismatch) {
                this._loggedOriginMismatch = true;
                warnOnce(`tile host "${parsed.host}" does not match the map-session origin "${this._origin}", so tiles will NOT be signed.`);
            }
            return url;
        }

        // A credential is only usable once we know which account it belongs to: the account is
        // inside the HMAC payload the gateway signs, so an empty `u` can never verify and the
        // gateway rejects it as malformed.
        if (!this._sig || !this._sessionId || !this._account) {
            // Cold start. `transformRequest` is synchronous and cannot await a create, so this tile
            // goes out unsigned and 401s. Kicking the create off here shortens the blank window;
            // concurrent callers coalesce onto one request, so many tiles still buy one session.
            this.refreshNow();
            return url;
        }

        // NOTE the absence of an expiry check. An EXPIRED credential is still signed onto the tile
        // deliberately: that is what triggers the gateway rollover, which serves this tile inline,
        // bills the window exactly once and returns the replacement on the response headers. Adding
        // a "don't sign if expired" gate here would send the tile unsigned instead, which the
        // gateway bills through the v1 cookie path — the expensive behaviour, not the safe one.
        //
        // MERGE, never replace. The v1 URL already carries `?token=` and the style may depend on
        // other items; only stale copies of our OWN params are dropped, so re-signing the same URL
        // cannot duplicate them.
        for (const name of CREDENTIAL_PARAMS) parsed.searchParams.delete(name);
        parsed.searchParams.append('u', this._account);
        parsed.searchParams.append('s', this._sessionId);
        parsed.searchParams.append('e', String(this._exp));
        parsed.searchParams.append('a', String(this._sae));
        parsed.searchParams.append('k', this._keyId || '1');
        parsed.searchParams.append('sig', this._sig);
        return parsed.href;
    }

    // ---------------------------------------------------------------------------------
    // Response handling
    // ---------------------------------------------------------------------------------

    /**
     * The single inbound hook, the counterpart of the Android interceptor's response half.
     * @param requestUrl - the URL WE SENT, signed or not. Not the post-redirect URL: this asks
     * "is this response about the credential we sent".
     * @param status - the HTTP status, or 0 for a transport failure
     * @param headers - lower-cased `x-map-session-*` response headers, when the transport surfaced
     * them
     */
    onTileResponse(requestUrl: string, status: number, headers?: {[_: string]: string} | null) {
        if (!this.isEnabled() || !requestUrl) return;

        const adopted = headers?.[`${SESSION_HEADER_PREFIX}sig`] ?
            this.applyCredentialFromHeaders(headers, requestUrl) :
            false;

        // Deliberately not `else if`: a 401 that also carries rollover headers we then REFUSE
        // (unknown account, not newer, wrong host) would otherwise consume the header branch and
        // never trigger recovery, leaving no usable credential and nothing scheduled.
        if (!adopted && status === 401 && this.shouldRefreshForResponseUrl(requestUrl)) {
            this.refreshNow();
        }

        if (status !== 401 && status !== 0 && this._wasSigned(requestUrl)) {
            this.noteSignedTileAccepted();
        }
    }

    _wasSigned(url: string): boolean {
        try {
            return !!new URL(url, typeof location !== 'undefined' ? location.href : undefined).searchParams.get('sig');
        } catch {
            return false;
        }
    }

    /**
     * Adopts a credential from `X-Map-Session-*` response headers (rollover only). Returns true only
     * if the header set is complete, the credential is newer, the responding host is the pinned
     * origin and the account is already known.
     *
     * A rollover only ever replaces sessionId/sig/exp/sae for the account that created the session
     * — that is why these headers carry no account of their own.
     * @param headers - lower-cased response headers
     * @param responseUrl - the URL that produced these headers. Required: a host named in a style
     * document could otherwise return these headers and own the SDK's credential.
     * @returns true if the credential was adopted
     */
    applyCredentialFromHeaders(headers: {[_: string]: string}, responseUrl: string): boolean {
        const sid = headers[`${SESSION_HEADER_PREFIX}id`];
        const sig = headers[`${SESSION_HEADER_PREFIX}sig`];
        const exp = headers[`${SESSION_HEADER_PREFIX}exp`];
        const ends = headers[`${SESSION_HEADER_PREFIX}ends`];
        const keyId = headers[`${SESSION_HEADER_PREFIX}key-id`];
        // All five or nothing. Storing half a credential would sign every later tile invalidly.
        if (!sid || !sig || !exp || !ends || !keyId) return false;
        const expValue = Math.trunc(Number(exp));
        const saeValue = Math.trunc(Number(ends));
        if (!isFinite(expValue) || !isFinite(saeValue)) return false;

        // Only the pinned gateway may mint credentials.
        if (this._origin && originOf(responseUrl) !== this._origin) return false;
        if (!this._account) return false;
        if (expValue <= this._exp) return false;

        this._sessionId = sid;
        this._sig = sig;
        this._keyId = keyId;
        this._exp = expValue;
        this._sae = saeValue;
        this._onCredentialAdopted();
        return true;
    }

    /**
     * Whether a 401 for this response URL should trigger a refresh.
     *
     * Many tiles are in flight at once, so a signing-key rotation 401s all of them. Without the
     * session-identity gate the first 401 buys a new credential and every straggler — still
     * carrying the now-dead session id — buys ANOTHER billed one.
     *
     * The second gate is the loop brake. On the gateway a SIGNED tile only 401s for `malformed` or
     * `bad_signature`; `expired` and `session_ended` take the rollover path, which serves the tile.
     * So a signed 401 means the replacement credential we buy will be rejected in exactly the same
     * way, and every turn of that loop is billed. Hence spacing plus a budget.
     * @param url - the URL we sent
     * @returns true if a refresh is authorised
     */
    shouldRefreshForResponseUrl(url: string): boolean {
        let responseSessionId: string | null = null;
        try {
            responseSessionId = new URL(url, typeof location !== 'undefined' ? location.href : undefined).searchParams.get('s');
        } catch {
            responseSessionId = null;
        }
        const now = nowSeconds();
        // Give-up is a pause, not a verdict, so the cool-down is checked here as well as in
        // {@link refreshNow} — otherwise a map left open would keep answering "yes, refresh" to
        // every 401 and only the refresh gate would stop it.
        if (this._gaveUp && now - this._gaveUpAt >= GIVE_UP_COOLDOWN_SECONDS) this._clearGiveUp();
        if (this._gaveUp) return false;

        if (!responseSessionId) {
            // An unsigned tile 401ing is the cold-start bootstrap. If we DO hold a credential an
            // unsigned request is none of our business and must not buy a window. Not a credential
            // rejection, so it spends no budget.
            return !this._sig;
        }
        // Stale news about a credential we have already replaced.
        if (responseSessionId !== this._sessionId) return false;

        if (this._lastTile401RefreshAt > 0) {
            // Too soon after the last one is the same incident.
            if (now - this._lastTile401RefreshAt < MIN_HARD_FAILURE_SPACING_SECONDS) return false;
            // Far enough apart to be a separate attempt: the credential the PREVIOUS tile-401
            // refresh bought has now been rejected too.
            this._tile401Refreshes++;
            if (!this._gaveUp && this._tile401Refreshes >= MAX_CONSECUTIVE_HARD_FAILURES) {
                this._gaveUp = true;
                this._gaveUpAt = now;
                warnOnce(`giving up after ${MAX_CONSECUTIVE_HARD_FAILURES} map-session credentials were each rejected by a signed tile with 401. Check the gateway signing key / key id. Refreshing resumes when the tab is next made visible, or after ${GIVE_UP_COOLDOWN_SECONDS} seconds.`);
                return false;
            }
        }
        this._lastTile401RefreshAt = now;
        return true;
    }

    /**
     * A signed tile came back with something other than 401 — the credential we hold works. This is
     * what makes the tile-401 count CONSECUTIVE rather than cumulative.
     */
    noteSignedTileAccepted() {
        this._tile401Refreshes = 0;
        this._lastTile401RefreshAt = 0;
    }

    // ---------------------------------------------------------------------------------
    // Create / renew
    // ---------------------------------------------------------------------------------

    /**
     * Buys a NEW session. Concurrent callers coalesce onto ONE request — a cold start fires many
     * tiles at once and without this that would be many billed sessions.
     *
     * There is deliberately no renew branch here any more, and `/v2/map-sessions/renew` is never
     * called. Two reasons, and the second is the important one:
     *
     * - Nothing needs it. The gateway rolls a credential over on BOTH `expired` and `session_ended`,
     *   so the ttl boundary and the `sae` hard stop are both covered without the client asking.
     * - On the one path that could still reach it, renewing is actively WRONG. Every remaining
     *   caller is either a cold start (no credential to renew) or the tile-401 recovery path — and a
     *   SIGNED tile only 401s for `malformed` or `bad_signature`, never for expiry. So at that point
     *   the gateway has just told us the signature we hold is bad; presenting that same signature to
     *   `/renew` asks it the identical question and gets the identical answer, burning one of the
     *   three hard-failure budget slots and delaying the create that was going to be needed anyway.
     */
    refreshNow() {
        if (!this.isEnabled()) return;
        const now = nowSeconds();

        // Give-up is a pause, not a verdict.
        if (this._gaveUp && now - this._gaveUpAt >= GIVE_UP_COOLDOWN_SECONDS) this._clearGiveUp();
        // A refresh whose completion never arrived leaves the coalescing flag raised forever and
        // wedges every future refresh — a permanently blank map.
        if (this._refreshInFlight && now - this._refreshInFlightSince >= REFRESH_STALE_SECONDS) {
            this._refreshInFlight = false;
            this._refreshInFlightSince = 0;
        }
        if (this._refreshInFlight || this._gaveUp) return;

        // Counted after the suppression gates and before the origin check, so a test can observe
        // "a refresh was warranted and not suppressed" without any traffic. Every increment here is
        // a BILLED map load in production.
        this._refreshDecisionCount++;
        const origin = this._origin;
        if (!origin) return;

        this._refreshInFlight = true;
        this._refreshInFlightSince = now;

        const url = `${origin}/v2/map-sessions?token=${encodeURIComponent(this._apiKey || '')}`;

        this.transport(url).then(
            (result) => {
                if (result?.status === 200 && this.adoptRefreshResponse(result.body)) return;
                this.handleRefreshFailure(result ? result.status : 0);
            },
            // A transport failure is not an auth failure: it must not spend the hard-failure
            // budget, but it MUST clear the in-flight flag.
            () => this.handleRefreshFailure(0)
        );
    }

    /**
     * Adopts a `/v2/map-sessions[/renew]` response body.
     *
     * A 200 whose body does not carry a FUTURE expiry is not a credential: adopting it would sign
     * `e=0` on every tile and 401 on every one of them, feeding exactly the repeat-refresh loop
     * {@link shouldRefreshForResponseUrl} exists to stop. `session_ends_at` is validated to the same
     * standard because it is SIGNED INTO the credential — it goes out as the `a` parameter and is
     * inside the HMAC payload — so a zero or absent `sae` produces a signature the gateway cannot
     * verify on any tile, and the map 401s its way through the whole recovery budget.
     * @param body - the parsed JSON response
     * @returns true if the credential was adopted
     */
    adoptRefreshResponse(body: any): boolean {
        if (!body || typeof body !== 'object') return false;
        const expValue = Math.trunc(Number(body.expires_at));
        const saeValue = Math.trunc(Number(body.session_ends_at));
        const sid = body.session_id;
        const sig = body.sig;
        const account = body.account || null;
        const now = nowSeconds();
        if (!isFinite(expValue) || !isFinite(saeValue) || expValue <= now || saeValue <= now || !sid || !sig) {
            return false;
        }
        if (!account && !this._account) return false;

        this._account = account || this._account;
        this._sessionId = sid;
        this._sig = sig;
        this._keyId = body.key_id || '1';
        this._exp = expValue;
        this._sae = saeValue;
        this._refreshInFlight = false;
        this._refreshInFlightSince = 0;
        this._onCredentialAdopted();
        return true;
    }

    /**
     * Handles a non-adoptable refresh response. 401 past grace means "create a new one"; 403 means
     * the key is not permitted to do this at all. Both must DROP the credential: the gateway has
     * just rejected it, so leaving it in place would keep {@link signUrl} stamping a known-bad
     * signature onto every tile — and, worse, would make {@link shouldRefreshForResponseUrl} treat
     * the resulting 401s as being about a live session and spend the recovery budget on them.
     * @param status - the HTTP status, or 0 for a transport failure
     */
    handleRefreshFailure(status: number) {
        const hard = status === 401 || status === 403;
        const now = nowSeconds();
        if (hard) {
            this._sig = null;
            this._sessionId = null;
            this._exp = 0;
            // The COUNT only advances for failures far enough apart to be separate attempts. A
            // burst of 401s from tiles that were all in flight together is one incident, not three.
            if (now - this._lastCountedFailureAt >= MIN_HARD_FAILURE_SPACING_SECONDS) {
                this._hardFailures++;
                this._lastCountedFailureAt = now;
            }
            if (!this._gaveUp && this._hardFailures >= MAX_CONSECUTIVE_HARD_FAILURES) {
                this._gaveUp = true;
                this._gaveUpAt = now;
                warnOnce(`giving up after ${this._hardFailures} consecutive map-session auth failures (last status ${status}). Check that the API key is set and permitted to create v2 map sessions. Refreshing resumes when the tab is next made visible, or after ${GIVE_UP_COOLDOWN_SECONDS} seconds.`);
            }
        }
        this._refreshInFlight = false;
        this._refreshInFlightSince = 0;
    }

    _onCredentialAdopted() {
        // A working credential clears the give-up state.
        this._clearGiveUp();
        // Tiles that 401'd before this credential existed are `errored` and this SDK does not retry
        // them on its own, so nothing would ever be signed without an explicit nudge.
        for (const listener of this._reloadListeners) {
            try {
                listener();
            } catch {
                // A listener belonging to a torn-down map must not stop the others.
            }
        }
    }

    _clearGiveUp() {
        this._gaveUp = false;
        this._gaveUpAt = 0;
        this._hardFailures = 0;
        this._lastCountedFailureAt = 0;
        this._tile401Refreshes = 0;
        this._lastTile401RefreshAt = 0;
    }

    // ---------------------------------------------------------------------------------
    // Page visibility — purely an ESCAPE HATCH, never a trigger
    // ---------------------------------------------------------------------------------

    /**
     * Note what this does NOT do: it never initiates a request. There is no hidden-tab branch left,
     * because a hidden tab cannot bill anyway — it asks for no tiles, so nothing rolls over. The
     * handler survives the removal of the renewal timer for one reason only, the one in
     * {@link onVisible}: unwedging a session that has given up or wedged its coalescing flag.
     */
    _installVisibilityHandler() {
        if (this._visibilityHandler || typeof document === 'undefined' || !document.addEventListener) return;
        this._visibilityHandler = () => {
            if (!isHidden()) this.onVisible();
        };
        document.addEventListener('visibilitychange', this._visibilityHandler);
    }

    /**
     * The tab became visible. This is the fast way out of the give-up state: once given up nothing
     * else can clear it in practice, because the resets need traffic that can no longer happen.
     *
     * It ARMS recovery, it does not perform it. Nothing is requested here; the next tile the map
     * asks for is what actually drives a refresh, which is why restoring a tab cannot bill on its
     * own.
     */
    onVisible() {
        this._clearGiveUp();
        // Clearing the give-up without clearing this leaves the wedge in place: the coalescing flag
        // blocks every future refresh, so the fast escape from a blank map would do nothing at all.
        if (this._refreshInFlight && nowSeconds() - this._refreshInFlightSince >= REFRESH_STALE_SECONDS) {
            this._refreshInFlight = false;
            this._refreshInFlightSince = 0;
        }
    }

    // ---------------------------------------------------------------------------------
    // Map registration
    // ---------------------------------------------------------------------------------

    /**
     * Registers a callback invoked whenever a credential is adopted, so a map can reload the tiles
     * that errored while there was nothing to sign with.
     * @param listener - the callback
     * @returns a function that removes it
     */
    addCredentialListener(listener: () => void): () => void {
        this._reloadListeners.add(listener);
        return () => {
            this._reloadListeners.delete(listener);
        };
    }

    /** Drops all state. Test seam. */
    reset() {
        if (this._visibilityHandler && typeof document !== 'undefined' && document.removeEventListener) {
            document.removeEventListener('visibilitychange', this._visibilityHandler);
        }
        this._visibilityHandler = null;
        this._apiKey = null;
        this._apiKeyIsConfigured = false;
        this._enabled = true;
        this._account = null;
        this._sessionId = null;
        this._sig = null;
        this._keyId = null;
        this._exp = 0;
        this._sae = 0;
        this._origin = null;
        this._originIsConfigured = false;
        this._loggedOriginMismatch = false;
        this._refreshInFlight = false;
        this._refreshInFlightSince = 0;
        this._hardFailures = 0;
        this._lastCountedFailureAt = 0;
        this._gaveUp = false;
        this._gaveUpAt = 0;
        this._lastTile401RefreshAt = 0;
        this._tile401Refreshes = 0;
        this._refreshDecisionCount = 0;
        this._reloadListeners.clear();
        this.transport = defaultTransport;
    }

    /** Seeds a full credential without a round trip. Test seam. */
    seedCredential(account: string, sessionId: string, sig: string, exp: number, sae: number, keyId: string = '1') {
        this._account = account;
        this._sessionId = sessionId;
        this._sig = sig;
        this._exp = exp;
        this._sae = sae;
        this._keyId = keyId;
    }

    /** Back-dates the failure clocks so spacing and cool-down can be exercised without sleeping. */
    rewindClocks(seconds: number) {
        if (this._lastCountedFailureAt > 0) this._lastCountedFailureAt -= seconds;
        if (this._gaveUpAt > 0) this._gaveUpAt -= seconds;
        if (this._lastTile401RefreshAt > 0) this._lastTile401RefreshAt -= seconds;
        if (this._refreshInFlightSince > 0) this._refreshInFlightSince -= seconds;
    }
}

function nowSeconds(): number {
    return Math.floor(Date.now() / 1000);
}

function isHidden(): boolean {
    return typeof document !== 'undefined' && document.visibilityState === 'hidden';
}

/**
 * Scheme + host + port, never the host alone. Host-only matching would sign tiles for `http://gw`
 * against an `https://gw` pin — putting `sig` on the wire in cleartext — and would accept
 * `X-Map-Session-*` from a plaintext response, which anyone on the path can forge.
 * @param url - an absolute URL
 * @returns the normalised origin, or null if `url` cannot be parsed
 */
function originOf(url: string): string | null {
    try {
        const parsed = new URL(url);
        return `${parsed.protocol}//${parsed.host}`;
    } catch {
        return null;
    }
}

const warnedMessages = new Set<string>();
function warnOnce(message: string) {
    if (warnedMessages.has(message)) return;
    warnedMessages.add(message);
    console.warn(`[map-session] ${message}`);
}

/**
 * The one v2 map-session instance for the page. Several `Map`s share it, otherwise each map would
 * buy its own billed window.
 */
export const mapSession = new MapSession();
