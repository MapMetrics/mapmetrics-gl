import {type Context} from '../gl/context';
import {Mesh} from '../render/mesh';
import {PosArray, TriangleIndexArray} from '../data/array_types.g';
import {SegmentVector} from '../data/segment';
import {NORTH_POLE_Y, SOUTH_POLE_Y} from '../render/subdivision';
import {EXTENT} from '../data/extent';
import posAttributes from '../data/pos_attributes';
const EXTENT_STENCIL_BORDER = EXTENT / 128;
export type CreateTileMeshOptions = {
    granularity?: number;
    generateBorders?: boolean;
    extendToNorthPole?: boolean;
    extendToSouthPole?: boolean;
};
export type TileMesh = {
    vertices: ArrayBuffer;
    indices: ArrayBuffer;
    uses32bitIndices: boolean;
};
export type IndicesType = '32bit' | '16bit' | undefined;
export function createTileMeshWithBuffers(context: Context, options: CreateTileMeshOptions): Mesh {
    const tileMesh = createTileMesh(options, '16bit');
    const vertices = PosArray.deserialize({
        arrayBuffer: tileMesh.vertices,
        length: tileMesh.vertices.byteLength / 2 / 2, // Two values per vertex, 16 bit
    });
    const indices = TriangleIndexArray.deserialize({
        arrayBuffer: tileMesh.indices,
        length: tileMesh.indices.byteLength / 2 / 3, // Three values per triangle, 16 bit
    });
    const mesh = new Mesh(
        context.createVertexBuffer(vertices, posAttributes.members),
        context.createIndexBuffer(indices),
        SegmentVector.simpleSegment(0, 0, vertices.length, indices.length)
    );

    return mesh;
}
export function createTileMesh(options: CreateTileMeshOptions, forceIndicesSize?: IndicesType): TileMesh {
    const granularity = options.granularity !== undefined ? Math.max(options.granularity, 1) : 1;

    const quadsPerAxisX = granularity + (options.generateBorders ? 2 : 0); // two extra quads for border
    const quadsPerAxisY = granularity + ((options.extendToNorthPole || options.generateBorders) ? 1 : 0) + (options.extendToSouthPole || options.generateBorders ? 1 : 0);
    const verticesPerAxisX = quadsPerAxisX + 1; // one more vertex than quads
    const verticesPerAxisY = quadsPerAxisY + 1; // one more vertex than quads
    const offsetX = options.generateBorders ? -1 : 0;
    const offsetY = (options.generateBorders || options.extendToNorthPole) ? -1 : 0;
    const endX = granularity + (options.generateBorders ? 1 : 0);
    const endY = granularity + ((options.generateBorders || options.extendToSouthPole) ? 1 : 0);

    const vertexCount = verticesPerAxisX * verticesPerAxisY;
    const indexCount = quadsPerAxisX * quadsPerAxisY * 6;

    const overflows16bitIndices = verticesPerAxisX * verticesPerAxisY > (1 << 16);

    if (overflows16bitIndices && forceIndicesSize === '16bit') {
        throw new Error('Granularity is too large and meshes would not fit inside 16 bit vertex indices.');
    }

    const use32bitIndices = overflows16bitIndices || forceIndicesSize === '32bit';

    const vertices = new Int16Array(vertexCount * 2);

    let vertexId = 0;

    for (let y = offsetY; y <= endY; y++) {
        for (let x = offsetX; x <= endX; x++) {
            let vx = x / granularity * EXTENT;
            if (x === -1) {
                vx = -EXTENT_STENCIL_BORDER;
            }
            if (x === granularity + 1) {
                vx = EXTENT + EXTENT_STENCIL_BORDER;
            }
            let vy = y / granularity * EXTENT;
            if (y === -1) {
                vy = options.extendToNorthPole ? NORTH_POLE_Y : (-EXTENT_STENCIL_BORDER);
            }
            if (y === granularity + 1) {
                vy = options.extendToSouthPole ? SOUTH_POLE_Y : EXTENT + EXTENT_STENCIL_BORDER;
            }

            vertices[vertexId++] = vx;
            vertices[vertexId++] = vy;
        }
    }

    const indices = use32bitIndices ? new Uint32Array(indexCount) : new Uint16Array(indexCount);

    let indexId = 0;

    for (let y = 0; y < quadsPerAxisY; y++) {
        for (let x = 0; x < quadsPerAxisX; x++) {
            const v0 = x + y * verticesPerAxisX;
            const v1 = (x + 1) + y * verticesPerAxisX;
            const v2 = x + (y + 1) * verticesPerAxisX;
            const v3 = (x + 1) + (y + 1) * verticesPerAxisX;

            // v0----v1
            //  |  / |
            //  | /  |
            // v2----v3
            indices[indexId++] = v0;
            indices[indexId++] = v2;
            indices[indexId++] = v1;

            indices[indexId++] = v1;
            indices[indexId++] = v2;
            indices[indexId++] = v3;
        }
    }

    return {
        vertices: vertices.buffer.slice(0),
        indices: indices.buffer.slice(0),
        uses32bitIndices: use32bitIndices,
    };
}