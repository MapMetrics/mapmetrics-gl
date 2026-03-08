/**
 * Generates HTML meta tags for geo-position metadata.
 *
 * @param input.center - Map center as [lng, lat]
 * @param input.area   - Optional place name
 * @returns HTML string with geo.position (and optionally geo.placename) meta tags
 */
export function generateMetaTags(input: {center: [number, number]; area?: string}): string {
    const [lng, lat] = input.center;
    const tags: string[] = [
        `<meta name="geo.position" content="${lat};${lng}" />`,
    ];

    if (input.area) {
        tags.push(`<meta name="geo.placename" content="${input.area}" />`);
    }

    return tags.join('\n');
}
