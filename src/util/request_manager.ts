import {mapSession} from './map_session';

import type {RequestParameters} from './ajax';

/**
 * A type of Mapmetrics resource.
 */
export const enum ResourceType {
    Glyphs = 'Glyphs',
    Image = 'Image',
    Source = 'Source',
    SpriteImage = 'SpriteImage',
    SpriteJSON = 'SpriteJSON',
    Style = 'Style',
    Tile = 'Tile',
    Unknown = 'Unknown',
}

/**
 * This function is used to transform a request.
 * It is used just before executing the relevant request.
 */
export type RequestTransformFunction = (url: string, resourceType?: ResourceType) => RequestParameters | Promise<RequestParameters> | undefined;

export class RequestManager {
    _transformRequestFn: RequestTransformFunction | null;

    constructor(transformRequestFn?: RequestTransformFunction | null) {
        this._transformRequestFn = transformRequestFn ?? null;
    }

    /**
     * MUST STAY `async`, AND THE `await` BELOW MUST STAY.
     *
     * Upstream #7184 made `RequestTransformFunction` able to return
     * `RequestParameters | Promise<RequestParameters>`. If the `await` is dropped and an
     * integrator supplies an async
     * `transformRequest`, `params` is a Promise, `params.url` is `undefined`, `signUrl(undefined)`
     * returns undefined and the signed value is written to an expando on the Promise object. The
     * URL actually requested is whatever the promise resolves to — UNSIGNED. Nothing throws, the
     * map renders correctly, `tsc` stays clean, and every tile bills on the v1 path.
     *
     * Grep marker 15 (`mapSession.signUrl` present) passes on the broken version too, so it cannot
     * catch this. `request_manager.test.ts` is the regression net — see
     * 'awaits an async transformRequest before signing'.
     *
     * All 15 upstream call sites already `await` this, so returning a Promise is safe.
     */
    async transformRequest(url: string, type: ResourceType): Promise<RequestParameters> {
        // The application's own callback runs FIRST and owns the result: it may rewrite the URL to
        // a CDN, add headers or set credentials, and none of that may be lost. v2 map-session
        // signing is then layered on TOP of whatever it produced, so an app that sets
        // `transformRequest` keeps its behaviour instead of having it clobbered.
        const params = (this._transformRequestFn && await this._transformRequestFn(url, type)) || {url};
        if (type === ResourceType.Style) {
            // v2 map sessions are ON BY DEFAULT, and this is how: the style URL the SDK is about to
            // request already carries a `token=` JWT whose scope includes `maps`, which is all
            // `POST /v2/map-sessions` asks for. Learning it here means correct per-window billing
            // with no application change. Guarded hard by an exact gateway-hostname match — see
            // {@link MapSession.learnFromStyleUrl}. Reads only; params is untouched.
            //
            // Both URLs are offered, and both face the same guard. `params.url` is what will
            // ACTUALLY be requested, so an app whose transformRequest points a bare style path at
            // the gateway is covered; `url` is the original, so an app that rewrites a gateway style
            // to its own CDN still bills correctly. Whichever is a gateway URL wins, and if neither
            // is, nothing is learned.
            mapSession.learnFromStyleUrl(params.url);
            mapSession.learnFromStyleUrl(url);
        }
        // A no-op unless an API key has been configured, the URL is tile-shaped, and its origin is
        // the pinned gateway. See {@link MapSession.signUrl}.
        params.url = mapSession.signUrl(params.url);
        return params;
    }

    setTransformRequest(transformRequest: RequestTransformFunction | null) {
        this._transformRequestFn = transformRequest;
    }
}

