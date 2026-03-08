import type {SchemaPreset, PresetType} from './types';

export const ALL_PRESETS: Record<PresetType, SchemaPreset> = {
    // --- POINT presets (7) ---
    restaurant: {
        schemaType: 'Restaurant',
        geometryTypes: ['Point'],
        propertyMappings: {
            name: 'name',
            address: 'address',
            cuisine: 'servesCuisine',
            rating: 'aggregateRating',
            ratingCount: 'aggregateRating.ratingCount',
            priceRange: 'priceRange',
            telephone: 'telephone',
            url: 'url',
        },
        requiredProperties: ['name'],
        trustGated: ['rating', 'priceRange'],
    },
    hotel: {
        schemaType: 'Hotel',
        geometryTypes: ['Point'],
        propertyMappings: {
            name: 'name',
            address: 'address',
            starRating: 'starRating',
            priceRange: 'priceRange',
            amenities: 'amenityFeature',
        },
        requiredProperties: ['name'],
        trustGated: ['starRating', 'priceRange'],
    },
    store: {
        schemaType: 'LocalBusiness',
        geometryTypes: ['Point'],
        propertyMappings: {
            name: 'name',
            address: 'address',
            openingHours: 'openingHours',
            telephone: 'telephone',
            url: 'url',
        },
        requiredProperties: ['name'],
        trustGated: [],
    },
    parking: {
        schemaType: 'ParkingFacility',
        geometryTypes: ['Point'],
        propertyMappings: {
            name: 'name',
            address: 'address',
            capacity: 'maximumAttendeeCapacity',
            priceRange: 'priceRange',
        },
        requiredProperties: ['name'],
        trustGated: ['priceRange'],
    },
    poi: {
        schemaType: 'TouristAttraction',
        geometryTypes: ['Point'],
        propertyMappings: {
            name: 'name',
            address: 'address',
            description: 'description',
            category: 'additionalType',
        },
        requiredProperties: ['name'],
        trustGated: [],
    },
    property: {
        schemaType: 'RealEstateListing',
        geometryTypes: ['Point'],
        propertyMappings: {
            name: 'name',
            address: 'address',
            price: 'price',
            numberOfRooms: 'numberOfRooms',
        },
        requiredProperties: ['name'],
        trustGated: ['price'],
    },
    'ev-charger': {
        schemaType: 'Place',
        geometryTypes: ['Point'],
        propertyMappings: {
            name: 'name',
            address: 'address',
            capacity: 'maximumAttendeeCapacity',
            connectorType: 'additionalProperty',
        },
        requiredProperties: ['name'],
        trustGated: [],
    },
    // --- LINESTRING presets (4) ---
    route: {
        schemaType: 'Trip',
        geometryTypes: ['LineString', 'MultiLineString'],
        propertyMappings: {
            name: 'name',
            distance: 'distance',
            duration: 'duration',
            origin: 'itinerary.origin',
            destination: 'itinerary.destination',
            mode: 'additionalType',
        },
        requiredProperties: ['name'],
        trustGated: [],
    },
    cycling: {
        schemaType: 'Trip',
        geometryTypes: ['LineString', 'MultiLineString'],
        propertyMappings: {
            name: 'name',
            distance: 'distance',
            duration: 'duration',
            elevation: 'additionalProperty.elevation',
            surface: 'additionalProperty.surface',
        },
        requiredProperties: ['name'],
        trustGated: [],
    },
    transit: {
        schemaType: 'Trip',
        geometryTypes: ['LineString', 'MultiLineString'],
        propertyMappings: {
            name: 'name',
            line: 'name',
            stops: 'itinerary',
            frequency: 'additionalProperty.frequency',
        },
        requiredProperties: ['name'],
        trustGated: [],
    },
    trail: {
        schemaType: 'TouristTrip',
        geometryTypes: ['LineString', 'MultiLineString'],
        propertyMappings: {
            name: 'name',
            distance: 'distance',
            difficulty: 'additionalProperty.difficulty',
            elevation: 'additionalProperty.elevation',
            description: 'description',
        },
        requiredProperties: ['name'],
        trustGated: [],
    },
    // --- POLYGON presets (4) ---
    serviceArea: {
        schemaType: 'Service',
        geometryTypes: ['Polygon', 'MultiPolygon'],
        propertyMappings: {
            name: 'name',
            description: 'description',
        },
        requiredProperties: ['name'],
        trustGated: [],
    },
    neighborhood: {
        schemaType: 'AdministrativeArea',
        geometryTypes: ['Polygon', 'MultiPolygon'],
        propertyMappings: {
            name: 'name',
            population: 'population',
            description: 'description',
        },
        requiredProperties: ['name'],
        trustGated: [],
    },
    zone: {
        schemaType: 'Place',
        geometryTypes: ['Polygon', 'MultiPolygon'],
        propertyMappings: {
            name: 'name',
            description: 'description',
            category: 'additionalType',
        },
        requiredProperties: ['name'],
        trustGated: [],
    },
    coverage: {
        schemaType: 'OfferShippingDetails',
        geometryTypes: ['Polygon', 'MultiPolygon'],
        propertyMappings: {
            name: 'name',
            deliveryTime: 'transitTime',
            shippingRate: 'shippingRate',
        },
        requiredProperties: ['name'],
        trustGated: [],
    },
};

export function getPreset(type: PresetType): SchemaPreset | undefined {
    return ALL_PRESETS[type];
}
