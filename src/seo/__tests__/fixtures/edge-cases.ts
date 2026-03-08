import type {FeatureCollection} from 'geojson';

export const edgeCases: FeatureCollection = {
    type: 'FeatureCollection',
    features: [
        {
            type: 'Feature',
            geometry: {type: 'Point', coordinates: [4.88, 52.37]},
            properties: null
        },
        {
            type: 'Feature',
            geometry: {type: 'Point', coordinates: [4.88, 52.37]},
            properties: {}
        },
        {
            type: 'Feature',
            geometry: {type: 'Point', coordinates: [4.88, 52.37]},
            properties: {name: ''}
        },
        {
            type: 'Feature',
            geometry: {type: 'Point', coordinates: [4.88, 52.37]},
            properties: {name: 'Caf\u00e9 Sm\u00fcl', address: 'Stra\u00dfe 42'}
        },
        {
            type: 'Feature',
            geometry: {type: 'Point', coordinates: [4.88, 52.37]},
            properties: {rating: 7, ratingCount: -1}
        }
    ]
};
