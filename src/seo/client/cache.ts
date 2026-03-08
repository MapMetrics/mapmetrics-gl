/**
 * Simple djb2 string hash function.
 * Returns a hex string representation of the hash.
 */
function djb2Hash(str: string): string {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash) + str.charCodeAt(i); // hash * 33 + c
        hash = hash & hash; // Convert to 32-bit integer
    }
    return (hash >>> 0).toString(16);
}

/**
 * A simple data hash cache used by SeoManager to detect
 * when map source data has changed and SEO markup needs regeneration.
 */
export class SeoCache {
    private _hash: string | null = null;
    private _markup: {jsonLd: string; noscript: string} | null = null;

    /**
     * Compares a djb2 hash of the given data string against the stored hash.
     * Returns true if the data has changed (or is the first check).
     * Updates the stored hash to match the new data.
     */
    hasChanged(data: string): boolean {
        const newHash = djb2Hash(data);
        if (newHash === this._hash) {
            return false;
        }
        this._hash = newHash;
        return true;
    }

    /**
     * Returns the cached markup, or null if nothing has been cached.
     */
    get(): {jsonLd: string; noscript: string} | null {
        return this._markup;
    }

    /**
     * Stores the generated markup in the cache.
     */
    set(markup: {jsonLd: string; noscript: string}): void {
        this._markup = markup;
    }

    /**
     * Clears both the hash and cached markup.
     */
    clear(): void {
        this._hash = null;
        this._markup = null;
    }
}
