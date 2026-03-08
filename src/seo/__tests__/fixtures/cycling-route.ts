import type {FeatureCollection} from 'geojson';

export const cyclingRouteVondelpark: FeatureCollection = {
    type: 'FeatureCollection',
    features: [
        {
            type: 'Feature',
            geometry: {
                type: 'LineString',
                coordinates: [
                    [4.900, 52.378],  // Amsterdam Centraal
                    [4.893, 52.373],  // Dam Square
                    [4.880, 52.365],  // Leidseplein
                    [4.868, 52.358]   // Vondelpark
                ]
            },
            properties: {
                name: 'Cycling route: Centraal to Vondelpark',
                distance: 3.2,
                duration: 12,
                mode: 'bicycle',
                origin: 'Amsterdam Centraal',
                destination: 'Vondelpark',
                surface: 'paved'
            }
        }
    ]
};
