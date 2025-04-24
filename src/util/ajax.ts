import { extend, isWorker } from "./util";
import { createAbortError } from "./abort_error";
import { getProtocol } from "../source/protocol_crud";
import { MessageType } from "./actor_messages";

export const GLOBAL_DISPATCHER_ID = "global-dispatcher";

// Cookie Manager to handle session cookies
class CookieManager {
    private static usageSession: string | null = null;
    private static cookieAttributes = "SameSite=Lax; Secure; path=/";

    static setCookieFromResponse(response: Response): void {
        const setCookieHeader = response.headers.get("Set-Cookie");
        if (setCookieHeader) {
            // Handle multiple Set-Cookie headers
            const cookies = Array.isArray(setCookieHeader)
                ? setCookieHeader
                : [setCookieHeader];

            cookies.forEach((cookie) => {
                if (cookie.includes("usageSession")) {
                    this.usageSession = cookie.split(";")[0].split("=")[1];
                    // Update browser cookie with proper attributes
                    document.cookie = `usageSession=${this.usageSession}; ${this.cookieAttributes}`;
                }
            });
        }
    }

    static getCookie(): string {
        // First check if we have a managed session
        if (this.usageSession) {
            return `usageSession=${this.usageSession}`;
        }

        // Fallback to document cookies
        const cookie = document.cookie
            .split("; ")
            .find((row) => row.startsWith("usageSession="));

        if (cookie) {
            this.usageSession = cookie.split("=")[1];
        }

        return cookie || "";
    }

    static clearCookie(): void {
        this.usageSession = null;
        document.cookie = `usageSession=; expires=Thu, 01 Jan 1970 00:00:00 GMT; ${this.cookieAttributes}`;
    }
}

export type ExpiryData = {
    cacheControl?: string | null;
    expires?: Date | string | null;
};

export type RequestParameters = {
    url: string;
    headers?: any;
    method?: "GET" | "POST" | "PUT";
    body?: string;
    type?: "string" | "json" | "arrayBuffer" | "image";
    credentials?: "same-origin" | "include";
    collectResourceTiming?: boolean;
    cache?: RequestCache;
};

export type GetResourceResponse<T> = ExpiryData & {
    data: T;
    cookies?: string | null;
};

export type ResponseCallback<T> = (
    error?: Error | null,
    data?: T | null,
    cacheControl?: string | null,
    expires?: string | Date | null
) => void;

export class AJAXError extends Error {
    status: number;
    statusText: string;
    url: string;
    body: Blob;

    constructor(status: number, statusText: string, url: string, body: Blob) {
        super(`AJAXError: ${statusText} (${status}): ${url}`);
        this.status = status;
        this.statusText = statusText;
        this.url = url;
        this.body = body;
    }
}

export const getReferrer = () => {
    if (typeof window === "undefined") return ""; // SSR safety
    return isWorker(self)
        ? self.worker && self.worker.referrer
        : (window.location.protocol === "blob:" ? window.parent : window)
              .location.href;
};

const isFileURL = (url) => {
    if (typeof window === "undefined") return false;
    return (
        /^file:/.test(url) ||
        (/^file:/.test(getReferrer()) && !/^\w+:/.test(url))
    );
};

async function makeFetchRequest(
    requestParameters: RequestParameters,
    abortController: AbortController
): Promise<GetResourceResponse<any>> {
    const headers = new Headers(requestParameters.headers);
    const isCrossOrigin = !sameOrigin(requestParameters.url);

    // Add session cookie if available
    const sessionCookie = CookieManager.getCookie();
    if (sessionCookie) {
        headers.set("Cookie", sessionCookie);
        requestParameters.credentials = "include";
    }

    // Add Origin header for CORS requests
    if (isCrossOrigin && !headers.has("Origin")) {
        headers.set("Origin", window.location.origin);
    }

    const requestInit: RequestInit = {
        method: requestParameters.method || "GET",
        body: requestParameters.body,
        credentials: isCrossOrigin
            ? "include"
            : requestParameters.credentials || "same-origin",
        headers: headers,
        cache: requestParameters.cache,
        signal: abortController.signal,
    };

    if (requestParameters.type === "json" && !headers.has("Accept")) {
        headers.set("Accept", "application/json");
    }

    let response: Response;
    try {
        response = await fetch(requestParameters.url, requestInit);

        // Handle CORS error specifically
        if (response.type === "opaque" && isCrossOrigin) {
            throw new AJAXError(
                0,
                "CORS policy blocked the request",
                requestParameters.url,
                new Blob()
            );
        }

        // Store any new cookies from the response
        CookieManager.setCookieFromResponse(response);

        if (!response.ok) {
            const errorBody = await response
                .blob()
                .catch(() => new Blob([response.statusText]));
            throw new AJAXError(
                response.status,
                response.statusText,
                requestParameters.url,
                errorBody
            );
        }

        let data: any;
        switch (requestParameters.type) {
            case "arrayBuffer":
            case "image":
                data = await response.arrayBuffer();
                break;
            case "json":
                data = await response.json();
                break;
            default:
                data = await response.text();
        }

        if (abortController.signal.aborted) {
            throw createAbortError();
        }

        return {
            data,
            cacheControl: response.headers.get("Cache-Control"),
            expires: response.headers.get("Expires"),
            cookies: response.headers.get("Set-Cookie"),
        };
    } catch (e) {
        if (e instanceof AJAXError) throw e;

        const errorMessage =
            e instanceof TypeError && isCrossOrigin
                ? "Cross-origin request blocked"
                : e.message;

        throw new AJAXError(
            e instanceof DOMException && e.name === "AbortError" ? -1 : 0,
            errorMessage,
            requestParameters.url,
            new Blob()
        );
    }
}

function makeXMLHttpRequest(
    requestParameters: RequestParameters,
    abortController: AbortController
): Promise<GetResourceResponse<any>> {
    return new Promise((resolve, reject) => {
        const xhr: XMLHttpRequest = new XMLHttpRequest();
        xhr.open(
            requestParameters.method || "GET",
            requestParameters.url,
            true
        );

        // Add session cookie if available
        const sessionCookie = CookieManager.getCookie();
        if (sessionCookie) {
            xhr.setRequestHeader("Cookie", sessionCookie);
            xhr.withCredentials = true;
        }

        if (
            requestParameters.type === "arrayBuffer" ||
            requestParameters.type === "image"
        ) {
            xhr.responseType = "arraybuffer";
        }

        for (const k in requestParameters.headers) {
            xhr.setRequestHeader(k, requestParameters.headers[k]);
        }

        if (requestParameters.type === "json") {
            xhr.responseType = "text";
            if (!requestParameters.headers?.Accept) {
                xhr.setRequestHeader("Accept", "application/json");
            }
        }

        xhr.onerror = () => {
            reject(new Error(xhr.statusText));
        };

        xhr.onload = () => {
            if (abortController.signal.aborted) return;

            if (
                ((xhr.status >= 200 && xhr.status < 300) || xhr.status === 0) &&
                xhr.response !== null
            ) {
                let data: unknown = xhr.response;
                if (requestParameters.type === "json") {
                    try {
                        data = JSON.parse(xhr.response);
                    } catch (err) {
                        reject(err);
                        return;
                    }
                }

                // Store any new cookies from the response
                const setCookieHeader = xhr.getResponseHeader("Set-Cookie");
                if (
                    setCookieHeader &&
                    setCookieHeader.includes("usageSession")
                ) {
                    CookieManager.setCookieFromResponse(
                        new Response(null, {
                            headers: new Headers({
                                "Set-Cookie": setCookieHeader,
                            }),
                        })
                    );
                }

                resolve({
                    data,
                    cacheControl: xhr.getResponseHeader("Cache-Control"),
                    expires: xhr.getResponseHeader("Expires"),
                    cookies: setCookieHeader,
                });
            } else {
                const body = new Blob([xhr.response], {
                    type: xhr.getResponseHeader("Content-Type"),
                });
                reject(
                    new AJAXError(
                        xhr.status,
                        xhr.statusText,
                        requestParameters.url,
                        body
                    )
                );
            }
        };

        abortController.signal.addEventListener("abort", () => {
            xhr.abort();
            reject(createAbortError());
        });

        xhr.send(requestParameters.body);
    });
}

export const makeRequest = function (
    requestParameters: RequestParameters,
    abortController: AbortController
): Promise<GetResourceResponse<any>> {
    if (
        /:\/\//.test(requestParameters.url) &&
        !/^https?:|^file:/.test(requestParameters.url)
    ) {
        const protocolLoadFn = getProtocol(requestParameters.url);
        if (protocolLoadFn) {
            return protocolLoadFn(requestParameters, abortController);
        }
        if (isWorker(self) && self.worker && self.worker.actor) {
            return self.worker.actor.sendAsync(
                {
                    type: MessageType.getResource,
                    data: requestParameters,
                    targetMapId: GLOBAL_DISPATCHER_ID,
                },
                abortController
            );
        }
    }
    if (!isFileURL(requestParameters.url)) {
        if (
            fetch &&
            Request &&
            AbortController &&
            Object.prototype.hasOwnProperty.call(Request.prototype, "signal")
        ) {
            return makeFetchRequest(requestParameters, abortController);
        }
        if (isWorker(self) && self.worker && self.worker.actor) {
            return self.worker.actor.sendAsync(
                {
                    type: MessageType.getResource,
                    data: requestParameters,
                    mustQueue: true,
                    targetMapId: GLOBAL_DISPATCHER_ID,
                },
                abortController
            );
        }
    }
    return makeXMLHttpRequest(requestParameters, abortController);
};

export const getJSON = <T>(
    requestParameters: RequestParameters,
    abortController: AbortController
): Promise<{ data: T } & ExpiryData> => {
    return makeRequest(
        extend(requestParameters, { type: "json" }),
        abortController
    );
};

export const getArrayBuffer = (
    requestParameters: RequestParameters,
    abortController: AbortController
): Promise<{ data: ArrayBuffer } & ExpiryData> => {
    return makeRequest(
        extend(requestParameters, { type: "arrayBuffer" }),
        abortController
    );
};

export function sameOrigin(inComingUrl: string) {
    if (typeof window === "undefined") return true;

    try {
        if (
            !inComingUrl ||
            inComingUrl.startsWith("data:") ||
            inComingUrl.startsWith("blob:")
        ) {
            return true;
        }

        const urlObj = new URL(inComingUrl);
        const locationObj = new URL(window.location.href);

        // Consider same origin if protocol, host and port match
        return urlObj.origin === locationObj.origin;
    } catch (e) {
        // Invalid URL is treated as same origin
        return true;
    }
}

export const getVideo = (urls: Array<string>): Promise<HTMLVideoElement> => {
    if (typeof window === "undefined") {
        return Promise.reject(new Error("Document not available in SSR"));
    }

    const video: HTMLVideoElement = window.document.createElement("video");
    video.muted = true;
    return new Promise((resolve) => {
        video.onloadstart = () => {
            resolve(video);
        };
        for (const url of urls) {
            const s: HTMLSourceElement =
                window.document.createElement("source");
            if (!sameOrigin(url)) {
                video.crossOrigin = "Anonymous";
            }
            s.src = url;
            video.appendChild(s);
        }
    });
};
