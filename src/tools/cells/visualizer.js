import { showLargeExportWarning } from '../../utils/export-warning.js';

export class CellsVisualizer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = this.canvas.getContext('2d');
        this.cells = [];

        // Pattern Settings
        this.pattern = { count: 20, gap: 1, smoothness: 2, margin: 1, junctionGap: 0 };

        // Customization State
        this.config = {
            cellColor: '#191919',
            bgColor: '#39FF14',
            drawMode: 'fill',
            strokeWidth: 2
        };

        this.aspectRatio = '1:1';
        this.resize();

        this.worker = new Worker(new URL('./visualizer.worker.js', import.meta.url), { type: 'module' });
        this.worker.onmessage = (e) => {
            this.rawCells = e.data.rawCells;
            this.vertexCounts = e.data.vertexCounts;
            this.isGenerating = false;
            
            if (this.pendingRegen) {
                this.generateMesh();
            } else {
                this.processCells();
            }
        };
        this.isGenerating = false;
        this.pendingRegen = false;

        this.isPlaying = true;
        this.isLooping = true;
        this.speed = 1.0;

        this.generateMesh();
    }

    play() {
        this.isPlaying = true;
    }

    pause() {
        this.isPlaying = false;
    }

    restart() {
        this.generateMesh();
    }

    setLoop(loop) {
        this.isLooping = loop;
    }

    setSpeed(speed) {
        this.speed = speed;
    }

    setAspectRatio(ratioStr) {
        this.aspectRatio = ratioStr;
        this.resize();
        this.generateMesh();
    }

    updatePattern(count, gap, smoothness, margin, junctionGap) {
        const needsMeshRegen = (this.pattern.count !== count) || (this.pattern.margin !== margin);
        this.pattern = { count, gap, smoothness, margin, junctionGap };
        
        if (needsMeshRegen || !this.rawCells) {
            this.generateMesh();
        } else {
            this.processCells();
        }
    }

    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        this.draw();
    }

    resize() {
        const ratios = {
            '1:1': { w: 1200, h: 1200 },
            '16:9': { w: 1920, h: 1080 },
            '9:16': { w: 1080, h: 1920 },
            '4:3': { w: 1600, h: 1200 }
        };

        const dims = ratios[this.aspectRatio] || ratios['1:1'];

        this.canvas.width = dims.w;
        this.canvas.height = dims.h;

        this.canvas.style.aspectRatio = `${dims.w} / ${dims.h}`;
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        this.canvas.style.objectFit = 'contain';
    }

    generateMesh() {
        if (this.isGenerating) {
            this.pendingRegen = true;
            return;
        }

        this.isGenerating = true;
        this.pendingRegen = false;

        this.worker.postMessage({
            count: this.pattern.count,
            margin: this.pattern.margin,
            width: this.canvas.width,
            height: this.canvas.height
        });
    }

    processCells() {
        if (!this.rawCells) return;

        const getPrecisionKey = (p) => {
            const rx = Math.round(p.x * 10) / 10;
            const ry = Math.round(p.y * 10) / 10;
            return `${rx},${ry}`;
        };

        // 3. Process Cells (Gap + Smoothness)
        this.cells = [];
        for (let poly of this.rawCells) {
            if (!poly || poly.length < 3) continue;

            let cx = 0, cy = 0;
            for (let p of poly) { cx += p.x; cy += p.y; }
            const c = { x: cx / poly.length, y: cy / poly.length };

            const N = poly.length;
            let processed = [];

            for (let i = 0; i < N; i++) {
                const p = poly[i];
                const prev = poly[(i - 1 + N) % N];
                const nxt = poly[(i + 1) % N];

                const key = getPrecisionKey(p);
                const isJunc = (this.vertexCounts[key] || 0) >= 3;

                const dx1 = prev.x - p.x;
                const dy1 = prev.y - p.y;
                const len1 = Math.hypot(dx1, dy1);

                const dx2 = nxt.x - p.x;
                const dy2 = nxt.y - p.y;
                const len2 = Math.hypot(dx2, dy2);

                // Junction gap region width. Base it on the junction gap plus a small padding.
                let L_corner = isJunc ? ((this.pattern.junctionGap || 0) * 4 + 10) : 0;
                let R_round = this.pattern.smoothness * 8;

                L_corner = Math.max(L_corner, R_round);

                // Limit sizes to prevent overlapping along edges
                const maxL = Math.min(len1 / 2.01, len2 / 2.01);
                L_corner = Math.min(L_corner, maxL);
                R_round = Math.min(R_round, L_corner);

                const displace = (pt, amount) => {
                    const dx = pt.x - c.x;
                    const dy = pt.y - c.y;
                    const dLen = Math.hypot(dx, dy);
                    if (dLen === 0) return { ...pt };
                    if (dLen <= amount) return { x: c.x, y: c.y };
                    const factor = (dLen - amount) / dLen;
                    return { x: c.x + dx * factor, y: c.y + dy * factor };
                };

                if (L_corner <= 1.0 || len1 <= 0.1 || len2 <= 0.1) {
                    // Just displace the single corner point
                    const dispAmount = this.pattern.gap * 3 + (isJunc ? (this.pattern.junctionGap || 0) * 4 : 0);
                    processed.push(displace(p, dispAmount));
                } else {
                    // Direction vectors
                    const ux1 = dx1 / len1;
                    const uy1 = dy1 / len1;
                    const ux2 = dx2 / len2;
                    const uy2 = dy2 / len2;

                    // Compute points along original polygon edges
                    const P1 = { x: p.x + ux1 * L_corner, y: p.y + uy1 * L_corner };
                    const P2 = { x: p.x + ux2 * L_corner, y: p.y + uy2 * L_corner };

                    const Q1 = { x: p.x + ux1 * R_round, y: p.y + uy1 * R_round };
                    const Q2 = { x: p.x + ux2 * R_round, y: p.y + uy2 * R_round };

                    // Displace them towards centroid
                    const d_normal = this.pattern.gap * 3;
                    const d_junc = d_normal + (isJunc ? (this.pattern.junctionGap || 0) * 4 : 0);
                    
                    // Interpolated displacement at Q1/Q2
                    const t_interp = L_corner > 0 ? (1 - R_round / L_corner) : 0;
                    const d_q = d_normal + (isJunc ? (this.pattern.junctionGap || 0) * 4 * t_interp : 0);

                    const P1_disp = displace(P1, d_normal);
                    const P2_disp = displace(P2, d_normal);
                    const P_disp = displace(p, d_junc);
                    const Q1_disp = displace(Q1, d_q);
                    const Q2_disp = displace(Q2, d_q);

                    // Add to output path
                    processed.push(P1_disp);

                    if (R_round > 0.1) {
                        // Generate bezier curve with a higher minimum step count for smoothness
                        const steps = Math.max(8, Math.min(32, Math.round(R_round / 2)));
                        for (let j = 0; j <= steps; j++) {
                            const t = j / steps;
                            const mt = 1 - t;
                            processed.push({
                                x: mt * mt * Q1_disp.x + 2 * mt * t * P_disp.x + t * t * Q2_disp.x,
                                y: mt * mt * Q1_disp.y + 2 * mt * t * P_disp.y + t * t * Q2_disp.y
                            });
                        }
                    } else {
                        // No rounding, just the sharp corner point (displaced)
                        processed.push(P_disp);
                    }

                    processed.push(P2_disp);
                }
            }

            // Filter out collapsed/invalid points
            processed = processed.filter(pt => pt.x !== c.x || pt.y !== c.y);
            if (processed.length < 3) continue;

            // Filter out duplicate consecutive points
            let cleanProcessed = [];
            for (let pt of processed) {
                if (cleanProcessed.length === 0) {
                    cleanProcessed.push(pt);
                } else {
                    const last = cleanProcessed[cleanProcessed.length - 1];
                    if (Math.hypot(pt.x - last.x, pt.y - last.y) > 0.01) {
                        cleanProcessed.push(pt);
                    }
                }
            }
            processed = cleanProcessed;

            if (processed.length >= 3) {
                this.cells.push(processed);
            }
        }

        this.draw();
    }

    beginExport() {
        this._isExporting = true;
    }

    endExport() {
        this._isExporting = false;
    }

    async renderFrame(timeSec, targetCanvas = null) {
        const destCanvas = targetCanvas || this.canvas;
        const destCtx = destCanvas.getContext('2d');
        this._drawFrame(destCtx, destCanvas.width, destCanvas.height);
    }

    draw() {
        this._drawFrame(this.ctx, this.canvas.width, this.canvas.height);
    }

    _drawFrame(ctx, width, height) {
        ctx.fillStyle = this.config.bgColor;
        ctx.fillRect(0, 0, width, height);

        if (this.config.drawMode === 'fill') {
            ctx.fillStyle = this.config.cellColor;
        } else {
            ctx.strokeStyle = this.config.cellColor;
            ctx.lineWidth = this.config.strokeWidth;
        }

        for (let cell of this.cells) {
            if (cell.length < 3) continue;

            ctx.beginPath();
            ctx.moveTo(cell[0].x, cell[0].y);

            for (let i = 1; i < cell.length; i++) {
                ctx.lineTo(cell[i].x, cell[i].y);
            }

            ctx.closePath();

            if (this.config.drawMode === 'fill') {
                ctx.fill();
            } else {
                ctx.stroke();
            }
        }
    }

    async exportToSVG() {
        const cellCount = this.cells.length;
        if (cellCount > 2000) {
            const proceed = await showLargeExportWarning(cellCount, 'polygons');
            if (!proceed) return null;
        }

        const width = this.canvas.width;
        const height = this.canvas.height;
        let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">\n`;

        // Background
        svgContent += `  <rect width="${width}" height="${height}" fill="${this.config.bgColor}" />\n`;

        // Cells
        let pathData = '';
        for (let cell of this.cells) {
            if (cell.length === 0) continue;
            pathData += `M ${cell[0].x.toFixed(2)} ${cell[0].y.toFixed(2)} `;
            for (let i = 1; i < cell.length; i++) {
                pathData += `L ${cell[i].x.toFixed(2)} ${cell[i].y.toFixed(2)} `;
            }
            pathData += `Z `;
        }

        if (this.config.drawMode === 'fill') {
            svgContent += `  <path d="${pathData.trim()}" fill="${this.config.cellColor}" />\n`;
        } else {
            svgContent += `  <path d="${pathData.trim()}" fill="none" stroke="${this.config.cellColor}" stroke-width="${this.config.strokeWidth}" stroke-linejoin="round" />\n`;
        }

        svgContent += `</svg>`;
        return svgContent;
    }

    exportToPNG(filename) {
        const url = this.canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    destroy() {
        if (this.worker) {
            this.worker.terminate();
        }
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.cells = [];
    }
}
