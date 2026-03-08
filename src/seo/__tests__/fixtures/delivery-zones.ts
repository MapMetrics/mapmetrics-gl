import type {FeatureCollection} from 'geojson';

export const deliveryZones: FeatureCollection = {
    type: 'FeatureCollection',
    features: [
        {
            type: 'Feature',
            geometry: {
                type: 'Polygon',
                coordinates: [[[4.87, 52.37], [4.89, 52.37], [4.89, 52.38], [4.87, 52.38], [4.87, 52.37]]]
            },
            properties: {
                name: 'Free Delivery Zone',
                description: 'Free delivery available in Jordaan area',
                category: 'free',
                deliveryTime: '25 minutes'
            }
        },
        {
            type: 'Feature',
            geometry: {
                type: 'Polygon',
                coordinates: [[[4.85, 52.35], [4.92, 52.35], [4.92, 52.40], [4.85, 52.40], [4.85, 52.35]]]
            },
            properties: {
                name: 'Standard Delivery Zone',
                description: 'Standard delivery across greater Amsterdam',
                category: 'standard',
                deliveryTime: '45 minutes'
            }
        }
    ]
};
