import { Delaunay } from 'd3-delaunay';

const getCentroid = (poly) => {
    let cx = 0, cy = 0;
    // Note: poly from d3-delaunay has the first point repeated at the end.
    // We compute centroid omitting the last point to avoid double counting,
    // or just use d3-polygon's approach. This is an approximation for Lloyd's.
    // Actually, simple average of vertices works fine for evenly distributing seeds.
    for (let i = 0; i < poly.length - 1; i++) { 
        cx += poly[i][0]; 
        cy += poly[i][1]; 
    }
    const len = poly.length - 1;
    return { x: cx / len, y: cy / len };
};

const getPrecisionKey = (x, y) => {
    const rx = Math.round(x * 10) / 10;
    const ry = Math.round(y * 10) / 10;
    return `${rx},${ry}`;
};

self.onmessage = function(e) {
    const { count, width, height, margin } = e.data;

    const m = margin * 5; 
    const safeW = Math.max(10, width - m * 2);
    const safeH = Math.max(10, height - m * 2);

    let seeds = [];
    for (let i = 0; i < count; i++) {
        seeds.push([
            m + Math.random() * safeW,
            m + Math.random() * safeH
        ]);
    }

    const bounds = [m, m, width - m, height - m];

    // Lloyd's relaxation
    for (let iter = 0; iter < 4; iter++) {
        const delaunay = Delaunay.from(seeds);
        const voronoi = delaunay.voronoi(bounds);
        
        let maxDisp = 0;
        const newSeeds = [];

        for (let i = 0; i < seeds.length; i++) {
            const poly = voronoi.cellPolygon(i);
            if (poly && poly.length > 0) {
                const centroid = getCentroid(poly);
                const dx = centroid.x - seeds[i][0];
                const dy = centroid.y - seeds[i][1];
                maxDisp = Math.max(maxDisp, Math.hypot(dx, dy));
                newSeeds.push([centroid.x, centroid.y]);
            } else {
                newSeeds.push(seeds[i]);
            }
        }
        
        seeds = newSeeds;
        
        // Early exit if displacement is small
        if (maxDisp < 0.1) {
            break;
        }
    }

    // Final Voronoi
    const delaunay = Delaunay.from(seeds);
    const voronoi = delaunay.voronoi(bounds);
    
    const rawCells = [];
    const vertexCounts = {};

    for (let i = 0; i < seeds.length; i++) {
        const poly = voronoi.cellPolygon(i);
        if (poly && poly.length > 0) {
            // Remove the last point if it's the same as the first one
            const cell = [];
            for (let j = 0; j < poly.length - 1; j++) {
                const pt = poly[j];
                cell.push({ x: pt[0], y: pt[1] });
                
                const key = getPrecisionKey(pt[0], pt[1]);
                vertexCounts[key] = (vertexCounts[key] || 0) + 1;
            }
            rawCells.push(cell);
        }
    }

    self.postMessage({ rawCells, vertexCounts });
};
