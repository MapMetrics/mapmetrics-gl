const DEFAULT_BASE_URL = 'https://static.mapatlas.com/v1/static';

export type StaticImageInput = {
    center: [number, number];
    zoom: number;
    width: number;
    height: number;
    baseUrl?: string;
    style?: string;
    apiKey?: string;
    markers?: Array<[number, number]>;
};

/**
 * Builds a deterministic static map image URL.
 *
 * @param input - Static image parameters (center is [lng, lat])
 * @returns URL string, or null if input is nullish
 */
export function buildStaticImageUrl(input: StaticImageInput | null | undefined): string | null {
    if (input == null) return null;

    const {center, zoom, width, height, baseUrl, style, apiKey, markers} = input;
    const [lng, lat] = center;

    const parts: string[] = [
        `center=${lat},${lng}`,
        `zoom=${zoom}`,
        `size=${width}x${height}`,
    ];

    if (style) {
        parts.push(`style=${encodeURIComponent(style)}`);
    }
    if (apiKey) {
        parts.push(`key=${encodeURIComponent(apiKey)}`);
    }
    if (markers && markers.length > 0) {
        parts.push(`markers=${markers.map(([mLng, mLat]) => `${mLat},${mLng}`).join('|')}`);
    }

    return `${baseUrl ?? DEFAULT_BASE_URL}?${parts.join('&')}`;
}
