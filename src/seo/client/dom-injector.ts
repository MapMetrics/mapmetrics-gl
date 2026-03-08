/**
 * Handles DOM insertion and cleanup of SEO elements (JSON-LD script tags
 * and noscript fallback content).
 */
export class DomInjector {
    private _elements: HTMLElement[] = [];

    /**
     * Parses the JSON-LD string (which may contain multiple `<script>` tags),
     * extracts the JSON content from each, and creates new
     * `<script type="application/ld+json">` elements in `document.head`.
     *
     * Existing mapmetrics JSON-LD elements are removed first (idempotent).
     */
    injectJsonLd(jsonLdString: string): void {
        // Remove any previously injected JSON-LD elements
        this._removeByClass('mapmetrics-seo-jsonld');

        // Extract JSON content from each <script> tag in the string
        const scriptRegex = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
        let match = scriptRegex.exec(jsonLdString);

        while (match !== null) {
            const jsonContent = match[1];
            const script = document.createElement('script');
            script.type = 'application/ld+json';
            script.className = 'mapmetrics-seo-jsonld';
            script.textContent = jsonContent;
            document.head.appendChild(script);
            this._elements.push(script as unknown as HTMLElement);
            match = scriptRegex.exec(jsonLdString);
        }
    }

    /**
     * Creates a hidden div next to the given container with the noscript HTML content.
     * The content is placed in a visually hidden but crawlable element.
     *
     * Existing mapmetrics noscript elements are removed first (idempotent).
     */
    injectNoscript(html: string, container: HTMLElement): void {
        // Remove any previously injected noscript elements
        this._removeByClass('mapmetrics-seo-noscript');

        const div = document.createElement('div');
        div.className = 'mapmetrics-seo-noscript';
        div.style.position = 'absolute';
        div.style.width = '1px';
        div.style.height = '1px';
        div.style.overflow = 'hidden';
        div.style.clip = 'rect(0, 0, 0, 0)';
        div.innerHTML = html;

        // Insert next to the map container
        if (container.parentNode) {
            container.parentNode.insertBefore(div, container.nextSibling);
        } else {
            document.body.appendChild(div);
        }

        this._elements.push(div);
    }

    /**
     * Removes all elements that were injected by this instance.
     */
    removeAll(): void {
        for (const el of this._elements) {
            if (el.parentNode) {
                el.parentNode.removeChild(el);
            }
        }
        this._elements = [];

        // Also clean up any stray elements by class name (defensive)
        this._removeByClass('mapmetrics-seo-jsonld');
        this._removeByClass('mapmetrics-seo-noscript');
    }

    /**
     * Removes all DOM elements with the given class name.
     */
    private _removeByClass(className: string): void {
        const existing = document.querySelectorAll(`.${className}`);
        for (const el of existing) {
            if (el.parentNode) {
                el.parentNode.removeChild(el);
            }
        }
        // Also remove from our tracked elements list
        this._elements = this._elements.filter(
            (el) => !el.classList.contains(className)
        );
    }
}
