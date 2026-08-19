import {mapSession} from './map_session';

import type {RequestParameters} from './ajax';

/**
 * A type of MapLibre resource.
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
 * This function is used to tranform a request.
 * It is used just before executing the relevant request.
 */
export type RequestTransformFunction = (url: string, resourceType?: ResourceType) => RequestParameters | undefined;

export class RequestManager {
    _transformRequestFn: RequestTransformFunction;

    constructor(transformRequestFn?: RequestTransformFunction) {
        this._transformRequestFn = transformRequestFn;
    }

    transformRequest(url: string, type: ResourceType): RequestParameters {
        // The application's own callback runs FIRST and owns the result: it may rewrite the URL to
        // a CDN, add headers or set credentials, and none of that may be lost. v2 map-session
        // signing is then layered on TOP of whatever it produced, so an app that sets
        // `transformRequest` keeps its behaviour instead of having it clobbered.
        const params = (this._transformRequestFn && this._transformRequestFn(url, type)) || {url};
        // A no-op unless an API key has been configured, the URL is tile-shaped, and its origin is
        // the pinned gateway. See {@link MapSession.signUrl}.
        params.url = mapSession.signUrl(params.url);
        return params;
    }

    setTransformRequest(transformRequest: RequestTransformFunction) {
        this._transformRequestFn = transformRequest;
    }
}

