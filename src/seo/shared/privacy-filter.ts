import type {Feature, FeatureCollection, Position} from 'geojson';
import type {PrivacyConfig} from './types';

/**
 * Applies privacy filtering to a GeoJSON FeatureCollection.
 * Deep clones features, removes excluded properties, filters features,
 * and rounds coordinates to the specified precision.
 */
export function applyPrivacyFilter(
    collection: FeatureCollection,
    config: Partial<PrivacyConfig>
): FeatureCollection {
    // Deep clone to avoid mutating the original
    const cloned: FeatureCollection = JSON.parse(JSON.stringify(collection));

    let features = cloned.features;

    // Filter out features matching excludeFeatures callback
    if (config.excludeFeatures) {
        // Re-bind the callback since it can't survive JSON serialization
        // We use the original callback against the cloned features
        features = features.filter((f) => !config.excludeFeatures!(f));
    }

    // Remove excluded properties from each feature
    if (config.excludeProperties && config.excludeProperties.length > 0) {
        for (const feature of features) {
            if (feature.properties) {
                for (const prop of config.excludeProperties) {
                    delete feature.properties[prop];
                }
            }
        }
    }

    // Round coordinates
    if (config.roundCoordinates !== undefined) {
        const decimals = config.roundCoordinates;
        for (const feature of features) {
            roundGeometryCoordinates(feature, decimals);
        }
    }

    return {
        ...cloned,
        features
    };
}

function roundCoord(value: number, decimals: number): number {
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
}

function roundPosition(pos: Position, decimals: number): Position {
    return pos.map((v) => roundCoord(v, decimals)) as Position;
}

function roundPositionArray(positions: Position[], decimals: number): Position[] {
    return positions.map((p) => roundPosition(p, decimals));
}

function roundGeometryCoordinates(feature: Feature, decimals: number): void {
    const geom = feature.geometry;
    if (!geom) return;

    switch (geom.type) {
        case 'Point':
            geom.coordinates = roundPosition(geom.coordinates, decimals);
            break;
        case 'LineString':
        case 'MultiPoint':
            geom.coordinates = roundPositionArray(geom.coordinates, decimals);
            break;
        case 'Polygon':
        case 'MultiLineString':
            geom.coordinates = geom.coordinates.map((ring) =>
                roundPositionArray(ring, decimals)
            );
            break;
        case 'MultiPolygon':
            geom.coordinates = geom.coordinates.map((polygon) =>
                polygon.map((ring) => roundPositionArray(ring, decimals))
            );
            break;
    }
}
