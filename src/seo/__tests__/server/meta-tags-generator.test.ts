import {describe, it, expect} from 'vitest';
import {generateMetaTags} from '../../server/meta-tags-generator';

describe('meta-tags-generator', () => {
    it('generates geo.position meta tag with correct lat;lng', () => {
        const html = generateMetaTags({center: [-73.9857, 40.7484]});
        expect(html).toContain('<meta name="geo.position" content="40.7484;-73.9857" />');
    });

    it('generates geo.placename when area provided', () => {
        const html = generateMetaTags({center: [-73.9857, 40.7484], area: 'Manhattan'});
        expect(html).toContain('<meta name="geo.placename" content="Manhattan" />');
    });

    it('omits placename when area not provided', () => {
        const html = generateMetaTags({center: [-73.9857, 40.7484]});
        expect(html).not.toContain('geo.placename');
    });
});
