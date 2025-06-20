import {OverscaledTileID} from '../../source/tile_id';
import {vec2, type vec4} from 'gl-matrix';
import {MercatorCoordinate} from '../mercator_coordinate';
import {clamp, degreesToRadians, scaleZoom} from '../../util/util';
import {type Aabb, IntersectionResult} from '../../util/primitives/aabb';

import type {IReadonlyTransform} from '../transform_interface';
import type {Terrain} from '../../render/terrain';
import type {Frustum} from '../../util/primitives/frustum';

type CoveringTilesResult = {
    tileID: OverscaledTileID;
    distanceSq: number;
    tileDistanceToCamera: number;
};

type CoveringTilesStackEntry = {
    zoom: number;
    x: number;
    y: number;
    wrap: number;
    fullyVisible: boolean;
};

export type CoveringZoomOptions = {
    /**
     * Whether to round or floor the target zoom level. If true, the value will be rounded to the closest integer. Otherwise the value will be floored.
     */
    roundZoom?: boolean;
    /**
     * Tile size, expressed in screen pixels.
     */
    tileSize: number;
};

export type CoveringTilesOptions = CoveringZoomOptions & {
    /**
     * Smallest allowed tile zoom.
     */
    minzoom?: number;
    /**
     * Largest allowed tile zoom.
     */
    maxzoom?: number;
    /**
     * `true` if tiles should be sent back to the worker for each overzoomed zoom level, `false` if not.
     * Fill this option when computing covering tiles for a source.
     * When true, any tile at `maxzoom` level that should be overscaled to a greater zoom will have
     * its zoom set to the overscaled greater zoom. When false, such tiles will have zoom set to `maxzoom`.
     */
    reparseOverscaled?: boolean;
    /**
     * When terrain is present, tile visibility will be computed in regards to the min and max elevations for each tile.
     */
    terrain?: Terrain;
    /**
     * Optional function to redefine how tiles are loaded at high pitch angles.
     */
    calculateTileZoom?: CalculateTileZoomFunction;
};

/**
 * Function to define how tiles are loaded at high pitch angles
 * @param requestedCenterZoom - the requested zoom level, valid at the center point.
 * @param distanceToTile2D - 2D distance from the camera to the candidate tile, in mercator units.
 * @param distanceToTileZ - vertical distance from the camera to the candidate tile, in mercator units.
 * @param distanceToCenter3D - distance from camera to center point, in mercator units
 * @param cameraVerticalFOV - camera vertical field of view, in degrees
 * @return the desired zoom level for this tile. May not be an integer.
 */
export type CalculateTileZoomFunction = (requestedCenterZoom: number,
    distanceToTile2D: number,
    distanceToTileZ: number,
    distanceToCenter3D: number,
    cameraVerticalFOV: number) => number;

/**
 * A simple/heuristic function that returns whether the tile is visible under the current transform.
 * @returns an {@link IntersectionResult}.
 */
export function isTileVisible(frustum: Frustum, aabb: Aabb, plane?: vec4): IntersectionResult {

    const frustumTest = aabb.intersectsFrustum(frustum);
    if (!plane) {
        return frustumTest;
    }
    const planeTest = aabb.intersectsPlane(plane);

    if (frustumTest === IntersectionResult.None || planeTest === IntersectionResult.None) {
        return IntersectionResult.None;
    }

    if (frustumTest === IntersectionResult.Full && planeTest === IntersectionResult.Full) {
        return IntersectionResult.Full;
    }

    return IntersectionResult.Partial;
}

function calculateTileZoom(requestedCenterZoom: number,
    distanceToTile2D: number,
    distanceToTileZ: number,
    distanceToCenter3D: number,
    cameraVerticalFOV: number) : number {
    /**
    * Controls how tiles are loaded at high pitch angles. Higher numbers cause fewer, lower resolution
    * tiles to be loaded. At 0, tiles are loaded with approximately constant screen X resolution.
    * At 1, tiles are loaded with approximately constant screen area.
    * At 2, tiles are loaded with approximately constant screen Y resolution.
    */
    const pitchTileLoadingBehavior = 1.0;
    /**
    * Controls how tiles are loaded at high pitch angles. Controls how different the distance to a tile must be (compared with the center point)
    * before a new zoom level is requested. For example, if tileZoomDeadband = 1 and the center zoom is 14, tiles distant enough to be loaded at
    * z13 will be loaded at z14, and tiles distant enough to be loaded at z14 will be loaded at z15. A higher number causes more tiles to be loaded
    * at the center zoom level. This also results in more tiles being loaded overall.
    */
    const tileZoomDeadband = 0.0;
    let thisTileDesiredZ = requestedCenterZoom;
    const thisTilePitch = Math.atan(distanceToTile2D / distanceToTileZ);
    const distanceToTile3D = Math.hypot(distanceToTile2D, distanceToTileZ);
    // if distance to candidate tile is a tiny bit farther than distance to center,
    // use the same zoom as the center. This is achieved by the scaling distance ratio by cos(fov/2)
    thisTileDesiredZ = requestedCenterZoom + scaleZoom(distanceToCenter3D / distanceToTile3D / Math.max(0.5, Math.cos(degreesToRadians(cameraVerticalFOV / 2))));
    thisTileDesiredZ += pitchTileLoadingBehavior * scaleZoom(Math.cos(thisTilePitch)) / 2;
    thisTileDesiredZ = thisTileDesiredZ + clamp(requestedCenterZoom - thisTileDesiredZ, -tileZoomDeadband, tileZoomDeadband);
    return thisTileDesiredZ;
}

/**
 * Return what zoom level of a tile source would most closely cover the tiles displayed by this transform.
 * @param options - The options, most importantly the source's tile size.
 * @returns An integer zoom level at which all tiles will be visible.
 */
export function coveringZoomLevel(transform: IReadonlyTransform, options: CoveringZoomOptions): number {
    const z = (options.roundZoom ? Math.round : Math.floor)(
        transform.zoom + scaleZoom(transform.tileSize / options.tileSize)
    );
    // At negative zoom levels load tiles from z0 because negative tile zoom levels don't exist.
    return Math.max(0, z);
}

/**
 * Returns a list of tiles that optimally covers the screen. Adapted for globe projection.
 * Correctly handles LOD when moving over the antimeridian.
 * @param transform - The transform instance.
 * @param frustum - The covering frustum.
 * @param plane - The clipping plane used by globe transform, or null.
 * @param cameraCoord - The x, y, z position of the camera in MercatorCoordinates.
 * @param centerCoord - The x, y, z position of the center point in MercatorCoordinates.
 * @param options - Additional coveringTiles options.
 * @param details - Interface to define required helper functions.
 * @returns A list of tile coordinates, ordered by ascending distance from camera.
 */
export function coveringTiles(transform: IReadonlyTransform, options: CoveringTilesOptions): OverscaledTileID[] {
    const frustum = transform.getCameraFrustum();
    const plane = transform.getClippingPlane();
    const cameraCoord = transform.screenPointToMercatorCoordinate(transform.getCameraPoint());
    const centerCoord = MercatorCoordinate.fromLngLat(transform.center, transform.elevation);
    cameraCoord.z = centerCoord.z + Math.cos(transform.pitchInRadians) * transform.cameraToCenterDistance / transform.worldSize;
    const detailsProvider = transform.getCoveringTilesDetailsProvider();
    const allowVariableZoom = detailsProvider.allowVariableZoom(transform, options);
    
    const desiredZ = coveringZoomLevel(transform, options);
    const minZoom = options.minzoom || 0;
    const maxZoom = options.maxzoom !== undefined ? options.maxzoom : transform.maxZoom;
    const nominalZ = Math.min(Math.max(0, desiredZ), maxZoom);

    const numTiles = Math.pow(2, nominalZ);
    const cameraPoint = [numTiles * cameraCoord.x, numTiles * cameraCoord.y, 0];
    const centerPoint = [numTiles * centerCoord.x, numTiles * centerCoord.y, 0];
    const distanceToCenter2d = Math.hypot(centerCoord.x - cameraCoord.x, centerCoord.y - cameraCoord.y);
    const distanceZ = Math.abs(centerCoord.z - cameraCoord.z);
    const distanceToCenter3d = Math.hypot(distanceToCenter2d, distanceZ);

    const newRootTile = (wrap: number): CoveringTilesStackEntry => {
        return {
            zoom: 0,
            x: 0,
            y: 0,
            wrap,
            fullyVisible: false
        };
    };

    // Do a depth-first traversal to find visible tiles and proper levels of detail
    const stack: Array<CoveringTilesStackEntry> = [];
    const result: Array<CoveringTilesResult> = [];

    if (transform.renderWorldCopies && detailsProvider.allowWorldCopies()) {
        // Render copy of the globe thrice on both sides
        for (let i = 1; i <= 3; i++) {
            stack.push(newRootTile(-i));
            stack.push(newRootTile(i));
        }
    }

    stack.push(newRootTile(0));

    while (stack.length > 0) {
        const it = stack.pop();
        const x = it.x;
        const y = it.y;
        let fullyVisible = it.fullyVisible;
        const tileID = {x, y, z: it.zoom};
        const aabb = detailsProvider.getTileAABB(tileID, it.wrap, transform.elevation, options);

        // Visibility of a tile is not required if any of its ancestor is fully visible
        if (!fullyVisible) {
            const intersectResult = isTileVisible(frustum, aabb, plane);

            if (intersectResult === IntersectionResult.None)
                continue;

            fullyVisible = intersectResult === IntersectionResult.Full;
        }

        const distToTile2d = detailsProvider.distanceToTile2d(cameraCoord.x, cameraCoord.y, tileID, aabb);

        let thisTileDesiredZ = desiredZ;
        if (allowVariableZoom) {
            const tileZoomFunc = options.calculateTileZoom || calculateTileZoom;
            thisTileDesiredZ = tileZoomFunc(transform.zoom + scaleZoom(transform.tileSize / options.tileSize),
                distToTile2d,
                distanceZ,
                distanceToCenter3d,
                transform.fov);
        }
        thisTileDesiredZ = (options.roundZoom ? Math.round : Math.floor)(thisTileDesiredZ);
        thisTileDesiredZ = Math.max(0, thisTileDesiredZ);
        const z = Math.min(thisTileDesiredZ, maxZoom);

        // We need to compute a valid wrap value for the tile to keep globe compatibility with mercator
        it.wrap = detailsProvider.getWrap(centerCoord, tileID, it.wrap);

        // Have we reached the target depth?
        if (it.zoom >= z) {
            if (it.zoom < minZoom) {
                continue;
            }
            const dz = nominalZ - it.zoom;
            const dx = cameraPoint[0] - 0.5 - (x << dz);
            const dy = cameraPoint[1] - 0.5 - (y << dz);
            const overscaledZ = options.reparseOverscaled ? Math.max(it.zoom, thisTileDesiredZ) : it.zoom;
            result.push({
                tileID: new OverscaledTileID(it.zoom === maxZoom ? overscaledZ : it.zoom, it.wrap, it.zoom, x, y),
                distanceSq: vec2.sqrLen([centerPoint[0] - 0.5 - x, centerPoint[1] - 0.5 - y]),
                // this variable is currently not used, but may be important to reduce the amount of loaded tiles
                tileDistanceToCamera: Math.sqrt(dx * dx + dy * dy)
            });
            continue;
        }

        for (let i = 0; i < 4; i++) {
            const childX = (x << 1) + (i % 2);
            const childY = (y << 1) + (i >> 1);
            const childZ = it.zoom + 1;
            stack.push({zoom: childZ, x: childX, y: childY, wrap: it.wrap, fullyVisible});
        }
    }

    return result.sort((a, b) => a.distanceSq - b.distanceSq).map(a => a.tileID);
}

/**
 * Expands tile coverage by adding neighboring tiles around the bounding box.
 * This function takes the original covering tiles and adds a buffer of additional tiles
 * around the perimeter to ensure smooth panning and zooming.
 * @param originalTiles - The original list of covering tiles
 * @param bufferSize - Number of tile rows/columns to add around the perimeter (default: 1)
 * @returns Expanded list of tiles including the buffer
 */
export function expandTileCoverage(originalTiles: OverscaledTileID[], bufferSize: number = 1): OverscaledTileID[] {
    if (bufferSize <= 0 || originalTiles.length === 0) {
        return originalTiles;
    }

    const expandedTiles = new Map<string, OverscaledTileID>();
    
    // Add original tiles to the result
    for (const tile of originalTiles) {
        expandedTiles.set(tile.key, tile);
    }

    // Group tiles by zoom level and wrap
    const tilesByZoom = new Map<string, OverscaledTileID[]>();
    for (const tile of originalTiles) {
        const key = `${tile.canonical.z}-${tile.wrap}`;
        if (!tilesByZoom.has(key)) {
            tilesByZoom.set(key, []);
        }
        tilesByZoom.get(key).push(tile);
    }

    // For each zoom level, expand the coverage
    for (const [zoomKey, tiles] of tilesByZoom) {
        const [zoomStr, wrapStr] = zoomKey.split('-');
        const zoom = parseInt(zoomStr);
        const wrap = parseInt(wrapStr);

        // Find the bounding box of tiles at this zoom level
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (const tile of tiles) {
            minX = Math.min(minX, tile.canonical.x);
            maxX = Math.max(maxX, tile.canonical.x);
            minY = Math.min(minY, tile.canonical.y);
            maxY = Math.max(maxY, tile.canonical.y);
        }

        // Add buffer tiles around the perimeter
        for (let dx = -bufferSize; dx <= bufferSize; dx++) {
            for (let dy = -bufferSize; dy <= bufferSize; dy++) {
                // Skip the original tiles (dx=0, dy=0 when within bounds)
                if (dx === 0 && dy === 0 && 
                    minX <= tiles[0].canonical.x && tiles[0].canonical.x <= maxX &&
                    minY <= tiles[0].canonical.y && tiles[0].canonical.y <= maxY) {
                    continue;
                }

                // Add tiles in the buffer area
                for (let x = minX + dx; x <= maxX + dx; x++) {
                    for (let y = minY + dy; y <= maxY + dy; y++) {
                        // Handle world wrapping
                        let adjustedX = x;
                        let adjustedWrap = wrap;
                        
                        const worldSize = Math.pow(2, zoom);
                        if (x < 0) {
                            adjustedX = x + worldSize;
                            adjustedWrap = wrap - 1;
                        } else if (x >= worldSize) {
                            adjustedX = x - worldSize;
                            adjustedWrap = wrap + 1;
                        }

                        // Clamp Y coordinates
                        if (y < 0 || y >= worldSize) {
                            continue;
                        }

                        const expandedTile = new OverscaledTileID(
                            tiles[0].overscaledZ || zoom,
                            adjustedWrap,
                            zoom,
                            adjustedX,
                            y
                        );
                        
                        expandedTiles.set(expandedTile.key, expandedTile);
                    }
                }
            }
        }
    }

    return Array.from(expandedTiles.values());
}
