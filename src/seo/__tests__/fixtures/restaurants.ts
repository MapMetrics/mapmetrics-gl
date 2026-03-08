import type {FeatureCollection} from 'geojson';

export const restaurantsAmsterdam: FeatureCollection = {
    type: 'FeatureCollection',
    features: [
        {
            type: 'Feature',
            geometry: {type: 'Point', coordinates: [4.8832, 52.3742]},
            properties: {
                name: 'Cafe de Klos',
                address: 'Keizersgracht 177, Amsterdam',
                cuisine: 'Dutch',
                rating: 4.7,
                ratingCount: 312,
                priceRange: '$$',
                osm_id: 'node/123456',
                wikidata: 'Q12345'
            }
        },
        {
            type: 'Feature',
            geometry: {type: 'Point', coordinates: [4.8810, 52.3730]},
            properties: {
                name: 'De Belhamel',
                address: 'Brouwersgracht 60, Amsterdam',
                cuisine: 'French',
                rating: 4.6,
                ratingCount: 245
            }
        },
        {
            type: 'Feature',
            geometry: {type: 'Point', coordinates: [4.8790, 52.3720]},
            properties: {
                name: 'Firma Pansen',
                address: 'Tweede Tuindwarsstraat 13, Amsterdam',
                cuisine: 'Italian',
                rating: 4.8,
                ratingCount: 189,
                telephone: '+31201234567',
                url: 'https://firmapansen.nl'
            }
        }
    ]
};
