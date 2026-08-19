import {describe, expect, test} from 'vitest';
import {DOM} from './dom';

describe('DOM', () => {

    describe('sanitize', () => {
        test('should not fail on empty string', () => {
            const input = '';
            const output = DOM.sanitize(input);
            expect(output).toBe('');
        });

        test('should remove script tags', () => {
            const input = '<script>alert(\'hi\')</script>';
            const output = DOM.sanitize(input);
            expect(output).toBe('');
        });

        test('should remove script tags from nested elements', () => {
            const input = '<div><script>alert(\'hi\')</script></div>';
            const output = DOM.sanitize(input);
            expect(output).toBe('<div></div>');
        });

        test('should remove potentially dangerous attributes', () => {
            const input = '<a href=\'javascript:alert(1)\'>click me</a>';
            const output = DOM.sanitize(input);
            expect(output).toBe('<a>click me</a>');
        });

        test('should remove potentially dangerous attributes from img', () => {
            const input = '<img onerror=\'javascript:alert(1)\'>';
            const output = DOM.sanitize(input);
            expect(output).toBe('<img>');
        });

        test('should remove potentially dangerous attributes from nested elements', () => {
            const input = '<div><a href=\'javascript:alert(1)\'>click me</a></div>';
            const output = DOM.sanitize(input);
            expect(output).toBe('<div><a>click me</a></div>');
        });

        // The following two cover maplibre-gl-js PR #8189 (fixed upstream in v6.4.1). The bug is
        // specifically about ADJACENCY: `elem.attributes` is a live NamedNodeMap, so removing one
        // attribute shifted the next one into the index the iterator had already passed, and it
        // was never examined. A single dangerous attribute was always removed correctly, which is
        // why every pre-existing test above still passed with the bug present.
        test('should remove multiple consecutive dangerous attributes', () => {
            const input = '<details open onload="1" ontoggle="alert(1)">x</details>';
            const output = DOM.sanitize(input);
            expect(output).not.toContain('onload');
            expect(output).not.toContain('ontoggle');
        });

        test('should remove dangerous attributes that follow a removed attribute', () => {
            const input = '<a href=\'javascript:alert(1)\' onclick=\'alert(1)\'>click me</a>';
            const output = DOM.sanitize(input);
            expect(output).toBe('<a>click me</a>');
        });
    });
});
