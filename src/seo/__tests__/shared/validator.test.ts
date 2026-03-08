import {describe, it, expect, vi} from 'vitest';
import {validateRating, validateSchema, detectSpamPatterns} from '../../shared/validator';

describe('validateRating', () => {
    it('returns valid rating object for valid inputs', () => {
        const result = validateRating(4.5, 100);
        expect(result).toEqual({ratingValue: 4.5, ratingCount: 100});
    });

    it('returns null when ratingValue is undefined', () => {
        expect(validateRating(undefined, 100)).toBeNull();
    });

    it('returns null when ratingValue is below 0', () => {
        expect(validateRating(-1, 100)).toBeNull();
    });

    it('returns null when ratingValue is above 5', () => {
        expect(validateRating(6, 100)).toBeNull();
    });

    it('returns null when ratingCount is 0', () => {
        expect(validateRating(4.0, 0)).toBeNull();
    });

    it('returns null when ratingCount is negative', () => {
        expect(validateRating(4.0, -5)).toBeNull();
    });

    it('accepts boundary value 0 for ratingValue', () => {
        const result = validateRating(0, 1);
        expect(result).toEqual({ratingValue: 0, ratingCount: 1});
    });

    it('accepts boundary value 5 for ratingValue', () => {
        const result = validateRating(5, 1);
        expect(result).toEqual({ratingValue: 5, ratingCount: 1});
    });
});

describe('validateSchema', () => {
    it('keeps valid schema.org properties', () => {
        const schema = {
            '@type': 'Restaurant',
            '@context': 'https://schema.org',
            name: 'Test',
            address: '123 Main St',
            description: 'A test place'
        };
        const result = validateSchema(schema);
        expect(result).toEqual(schema);
    });

    it('strips unknown properties', () => {
        const schema = {
            '@type': 'Restaurant',
            name: 'Test',
            fooBar: 'invalid',
            randomProp: 42
        };
        const result = validateSchema(schema);
        expect(result).toEqual({
            '@type': 'Restaurant',
            name: 'Test'
        });
        expect(result).not.toHaveProperty('fooBar');
        expect(result).not.toHaveProperty('randomProp');
    });

    it('keeps geo, aggregateRating, and other valid properties', () => {
        const schema = {
            '@type': 'Restaurant',
            geo: {latitude: 52.37, longitude: 4.88},
            aggregateRating: {ratingValue: 4.5},
            servesCuisine: 'Italian',
            priceRange: '$$',
            openingHours: 'Mo-Fr 09:00-17:00',
            telephone: '+31201234567',
            url: 'https://example.com'
        };
        const result = validateSchema(schema);
        expect(result).toEqual(schema);
    });

    it('returns empty object when all properties are unknown', () => {
        const schema = {
            invalid1: 'foo',
            invalid2: 'bar'
        };
        const result = validateSchema(schema);
        expect(result).toEqual({});
    });
});

describe('detectSpamPatterns', () => {
    it('warns when all ratings are identical', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const features = [
            {rating: 5.0, name: 'A'},
            {rating: 5.0, name: 'B'},
            {rating: 5.0, name: 'C'}
        ];
        detectSpamPatterns(features);
        expect(warnSpy).toHaveBeenCalledWith(
            expect.stringContaining('identical')
        );
        warnSpy.mockRestore();
    });

    it('does not warn when ratings are varied', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const features = [
            {rating: 4.5, name: 'A'},
            {rating: 3.2, name: 'B'},
            {rating: 4.8, name: 'C'}
        ];
        detectSpamPatterns(features);
        expect(warnSpy).not.toHaveBeenCalled();
        warnSpy.mockRestore();
    });

    it('does not warn when there are fewer than 2 features with ratings', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const features = [
            {rating: 5.0, name: 'A'}
        ];
        detectSpamPatterns(features);
        expect(warnSpy).not.toHaveBeenCalled();
        warnSpy.mockRestore();
    });
});
