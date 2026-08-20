function rewind(gj: any, outer: boolean): any {
    const type = gj?.type;
    let i;

    if (type === 'FeatureCollection') {
        for (i = 0; i < gj.features.length; i++) rewind(gj.features[i], outer);
    } else if (type === 'GeometryCollection') {
        for (i = 0; i < gj.geometries.length; i++)
            rewind(gj.geometries[i], outer);
    } else if (type === 'Feature') {
        rewind(gj.geometry, outer);
    } else if (type === 'Polygon') {
        rewindRings(gj.coordinates, outer);
    } else if (type === 'MultiPolygon') {
        for (i = 0; i < gj.coordinates.length; i++)
            rewindRings(gj.coordinates[i], outer);
    }

    return gj;
}

function rewindRings(rings: any[], outer: boolean): void {
    if (rings.length === 0) return;

    rewindRing(rings[0], outer);
    for (let i = 1; i < rings.length; i++) {
        rewindRing(rings[i], !outer);
    }
}

function rewindRing(ring: any[], dir: boolean): void {
    let area = 0,
        err = 0;
    for (let i = 0, len = ring.length, j = len - 1; i < len; j = i++) {
        const k = (ring[i][0] - ring[j][0]) * (ring[j][1] + ring[i][1]);
        const m = area + k;
        err += Math.abs(area) >= Math.abs(k) ? area - m + k : k - m + area;
        area = m;
    }
    if (area + err >= 0 !== !!dir) ring.reverse();
}

// Export the function
export default rewind;
