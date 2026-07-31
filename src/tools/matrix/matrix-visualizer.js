import { showLargeExportWarning } from '../../utils/export-warning.js';

function hexToRgb(hex) {
    const h = hex.replace('#', '');
    const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
    const num = parseInt(full, 16);
    return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function nearestPaletteColor(rgb, hexList, rgbList) {
    let bestIndex = 0, bestDist = Infinity;
    for (let i = 0; i < rgbList.length; i++) {
        const c = rgbList[i];
        const dr = rgb.r - c.r, dg = rgb.g - c.g, db = rgb.b - c.b;
        const dist = dr * dr + dg * dg + db * db;
        if (dist < bestDist) { bestDist = dist; bestIndex = i; }
    }
    return hexList[bestIndex];
}

export class MatrixVisualizer {
    static MASTER_DEFAULT_SVGS = [
        `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="10" fill="currentColor"/></svg>`,
        `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="22" fill="currentColor"/></svg>`,
        `<svg viewBox="0 0 100 100"><rect x="38" y="38" width="24" height="24" fill="currentColor"/></svg>`,
        `<svg viewBox="0 0 100 100"><polygon points="50,15 85,50 50,85 15,50" fill="currentColor"/></svg>`,
        `<svg viewBox="0 0 100 100"><rect x="20" y="20" width="60" height="60" fill="currentColor"/></svg>`,
        `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="44" fill="currentColor"/></svg>`,
        `<svg viewBox="0 0 100 100"><rect x="0" y="0" width="100" height="100" fill="currentColor"/></svg>`
    ];

    static parseSvgToPath2D(svgStr) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(svgStr, 'image/svg+xml');
        const circle = doc.querySelector('circle');
        const rect = doc.querySelector('rect');
        const polygon = doc.querySelector('polygon');
        const path = doc.querySelector('path');

        if (circle) {
            const cx = parseFloat(circle.getAttribute('cx'));
            const cy = parseFloat(circle.getAttribute('cy'));
            const r = parseFloat(circle.getAttribute('r'));
            return new Path2D(`M ${cx - r},${cy} a ${r},${r} 0 1,0 ${r * 2},0 a ${r},${r} 0 1,0 -${r * 2},0`);
        } else if (rect) {
            const x = parseFloat(rect.getAttribute('x'));
            const y = parseFloat(rect.getAttribute('y'));
            const w = parseFloat(rect.getAttribute('width'));
            const h = parseFloat(rect.getAttribute('height'));
            return new Path2D(`M ${x},${y} h ${w} v ${h} h -${w} Z`);
        } else if (polygon) {
            const points = polygon.getAttribute('points').trim().split(/\s+/);
            return new Path2D(`M ${points.join(' L ')} Z`);
        } else if (path) {
            return new Path2D(path.getAttribute('d'));
        }
        return new Path2D();
    }

    static normalizeCustomSvg(svgStr) {
        return new Promise((resolve) => {
            const parser = new DOMParser();
            const doc = parser.parseFromString(svgStr, 'image/svg+xml');
            const svgEl = doc.querySelector('svg');

            if (!svgEl) {
                resolve({ rawSvg: svgStr, path2D: new Path2D() });
                return;
            }

            const circle = svgEl.querySelector('circle');
            const rect = svgEl.querySelector('rect');
            const polygon = svgEl.querySelector('polygon');
            const path = svgEl.querySelector('path');

            let pathD = "";
            let targetEl = null;

            if (circle) {
                const cx = parseFloat(circle.getAttribute('cx') || 0);
                const cy = parseFloat(circle.getAttribute('cy') || 0);
                const r = parseFloat(circle.getAttribute('r') || 0);
                pathD = `M ${cx - r},${cy} a ${r},${r} 0 1,0 ${r * 2},0 a ${r},${r} 0 1,0 -${r * 2},0`;
                targetEl = circle;
            } else if (rect) {
                const x = parseFloat(rect.getAttribute('x') || 0);
                const y = parseFloat(rect.getAttribute('y') || 0);
                const w = parseFloat(rect.getAttribute('width') || 0);
                const h = parseFloat(rect.getAttribute('height') || 0);
                pathD = `M ${x},${y} h ${w} v ${h} h -${w} Z`;
                targetEl = rect;
            } else if (polygon) {
                const points = (polygon.getAttribute('points') || '').trim().split(/[\s,]+/);
                const validPoints = [];
                for (let i = 0; i < points.length; i += 2) {
                    if (points[i] !== undefined && points[i + 1] !== undefined && points[i] !== "") {
                        validPoints.push(`${points[i]},${points[i + 1]}`);
                    }
                }
                pathD = `M ${validPoints.join(' L ')} Z`;
                targetEl = polygon;
            } else if (path) {
                pathD = path.getAttribute('d') || '';
                targetEl = path;
            }

            if (!targetEl || !pathD) {
                resolve({ rawSvg: svgStr, path2D: new Path2D() });
                return;
            }

            // Temporarily append to DOM to get exact bounds
            svgEl.style.position = 'absolute';
            svgEl.style.visibility = 'hidden';
            svgEl.style.width = '100px';
            svgEl.style.height = '100px';
            document.body.appendChild(svgEl);

            let bbox = { x: 0, y: 0, width: 100, height: 100 };
            try {
                bbox = targetEl.getBBox();
            } catch (e) {
                console.warn('Could not get BBox for custom SVG', e);
            }

            document.body.removeChild(svgEl);

            const originalPath = new Path2D(pathD);

            if (bbox.width === 0 || bbox.height === 0) {
                resolve({ rawSvg: svgStr, path2D: originalPath });
                return;
            }

            // Target 100x100 box, leave a tiny 4px padding so it doesn't touch the absolute edge
            const scale = 92 / Math.max(bbox.width, bbox.height);
            const cx = bbox.x + bbox.width / 2;
            const cy = bbox.y + bbox.height / 2;

            const matrix = new DOMMatrix();
            matrix.translateSelf(50, 50);
            matrix.scaleSelf(scale, scale);
            matrix.translateSelf(-cx, -cy);

            const normalizedPath = new Path2D();
            normalizedPath.addPath(originalPath, matrix);

            // Create a normalized SVG string so the UI preview scales correctly
            const newRawSvg = `<svg viewBox="0 0 100 100"><g transform="translate(50,50) scale(${scale}) translate(${-cx},${-cy})" fill="currentColor"><path d="${pathD}" /></g></svg>`;

            resolve({ rawSvg: newRawSvg, path2D: normalizedPath });
        });
    }

    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

        // Persistent work canvases — reused every frame instead of recreated
        // (the original allocated a fresh <canvas> per frame, brutal at 60fps).
        this._sourceCanvas = document.createElement('canvas');
        this._sourceCtx = this._sourceCanvas.getContext('2d');
        this._processingCanvas = document.createElement('canvas');
        this._processingCtx = this._processingCanvas.getContext('2d');

        this.mediaType = null; // null | 'image'
        this.activeImage = null;
        this._objectUrl = null;

        this.isExportUpscalingOverride = false;

        this.matrixSize = 7;
        this.loadedPaths = [];

        this.config = {
            aspectRatio: 'original', // 'original' | 'square'
            gridSize: 16,
            bgColor: '#050507',
            invert: false,
            scaleUpMidtones: false,
            scaleMin: 0.1,
            scaleMax: 1.0,
            rotation: 0, // 0 | 90 | 180 | 270
            exportTargetRes: 1080, // 720 | 1080 | 2160
            colors: [
                { hex: '#2f54eb', active: true },
                { hex: '#13c2c2', active: false },
                { hex: '#722ed1', active: false },
                { hex: '#eb2f96', active: false }
            ],
            // --- New: cell gutter + color mapping + blending (points 2/3/4/5) ---
            cellPadding: 0.12,        // 0–0.4, fraction of cell size reserved as gutter on each side
            colorMode: 'sampled',     // 'sampled' (real block color, quantized to active palette) | 'random' (legacy pseudo-random)
            blendMode: 'source-over', // any valid ctx.globalCompositeOperation, e.g. 'multiply', 'screen'
            shapeOpacity: 1.0         // 0–1
        };

        this._syncMatrixPaths();

        // Blank initial paint
        this.canvas.width = 800;
        this.canvas.height = 800;
        this.ctx.fillStyle = this.config.bgColor;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    // --- Shape matrix -------------------------------------------------

    _syncMatrixPaths() {
        const targetSize = this.matrixSize;
        const tempPaths = [];
        for (let i = 0; i < targetSize; i++) {
            if (this.loadedPaths[i] && i < this.loadedPaths.length) {
                tempPaths.push(this.loadedPaths[i]);
            } else {
                let masterIndex = Math.floor((i / (targetSize - 1)) * 6);
                if (targetSize === 1) masterIndex = 3;
                const svgStr = MatrixVisualizer.MASTER_DEFAULT_SVGS[masterIndex];
                tempPaths.push({ rawSvg: svgStr, path2D: MatrixVisualizer.parseSvgToPath2D(svgStr) });
            }
        }
        this.loadedPaths = tempPaths;
    }

    setMatrixSize(n) {
        const clamped = Math.max(4, Math.min(7, n));
        if (clamped === this.matrixSize) return this.matrixSize;
        this.matrixSize = clamped;
        this._syncMatrixPaths();
        this.triggerRender();
        return this.matrixSize;
    }

    setShapeForSlot(index, file) {
        return new Promise((resolve, reject) => {
            if (!file) { reject(new Error('No file provided')); return; }
            const reader = new FileReader();
            reader.onload = (e) => {
                const content = e.target.result;
                MatrixVisualizer.normalizeCustomSvg(content).then(normalized => {
                    this.loadedPaths[index] = normalized;
                    this.triggerRender();
                    resolve(this.loadedPaths[index]);
                });
            };
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }

    // --- Colors ---------------------------------------------------------

    setColor(index, hex) {
        if (!this.config.colors[index]) return;
        this.config.colors[index].hex = hex;
        this.triggerRender();
    }

    setColorActive(index, active) {
        if (!this.config.colors[index]) return;
        this.config.colors[index].active = active;
        this.triggerRender();
    }

    getActiveColors() {
        const colors = this.config.colors.filter(c => c.active).map(c => c.hex);
        if (colors.length === 0) colors.push(this.config.colors[0]?.hex || '#2f54eb');
        return colors;
    }

    // --- Generic config ---------------------------------------------------

    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        this.triggerRender();
    }

    triggerRender() {
        if (this.mediaType === 'image') this._processFrame();
    }

    // --- Media pipeline ---------------------------------------------------
    // Image-only for now. Video/webcam intentionally removed pending a
    // dedicated video UX/pipeline redesign — don't re-add ad hoc here.

    _stopMediaInternals() {
        this.activeImage = null;
    }

    stopMedia() {
        this._stopMediaInternals();
        this.mediaType = null;
    }

    loadMedia(file, onReady) {
        if (!file || !file.type.startsWith('image/')) return;

        this._stopMediaInternals();
        if (this._objectUrl) URL.revokeObjectURL(this._objectUrl);
        const url = URL.createObjectURL(file);
        this._objectUrl = url;

        this.mediaType = 'image';
        const img = new Image();
        img.onload = () => {
            this.activeImage = img;
            this.triggerRender();
            if (onReady) onReady();
        };
        img.src = url;
    }

    // --- Core render algorithm ---------------------------------------------

    _processFrame() {
        if (!this.mediaType) return;

        if (this.mediaType !== 'image' || !this.activeImage) return;
        const sw = this.activeImage.width, sh = this.activeImage.height;
        if (sw === 0 || sh === 0) return;

        if (this._sourceCanvas.width !== sw || this._sourceCanvas.height !== sh) {
            this._sourceCanvas.width = sw;
            this._sourceCanvas.height = sh;
        }

        this._sourceCtx.drawImage(this.activeImage, 0, 0);

        const { aspectRatio } = this.config;
        let tw = sw, th = sh;
        if (aspectRatio === 'square') { tw = Math.min(sw, sh); th = tw; }

        const isUpscaling = this.isExportUpscalingOverride;
        if (isUpscaling) {
            const targetMax = this.config.exportTargetRes;
            if (aspectRatio === 'square') {
                tw = targetMax; th = targetMax;
            } else {
                const aspect = sw / sh;
                if (sw >= sh) { tw = Math.round(targetMax * aspect); th = targetMax; }
                else { tw = targetMax; th = Math.round(targetMax / aspect); }
            }
        }

        if (this.canvas.width !== tw || this.canvas.height !== th) {
            this.canvas.width = tw;
            this.canvas.height = th;
        }

        this.ctx.fillStyle = this.config.bgColor;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        const sxOffset = (aspectRatio === 'square') ? (sw - Math.min(sw, sh)) / 2 : 0;
        const syOffset = (aspectRatio === 'square') ? (sh - Math.min(sw, sh)) / 2 : 0;
        const swSrc = (aspectRatio === 'square') ? Math.min(sw, sh) : sw;
        const shSrc = (aspectRatio === 'square') ? Math.min(sw, sh) : sh;

        if (this._processingCanvas.width !== tw || this._processingCanvas.height !== th) {
            this._processingCanvas.width = tw;
            this._processingCanvas.height = th;
        }
        this._processingCtx.clearRect(0, 0, tw, th);
        this._processingCtx.drawImage(this._sourceCanvas, sxOffset, syOffset, swSrc, shSrc, 0, 0, tw, th);

        const imgData = this._processingCtx.getImageData(0, 0, tw, th);
        const pixels = imgData.data;

        let cell = this.config.gridSize;
        if (isUpscaling) {
            const scaleMultiplier = th / shSrc;
            cell = Math.max(4, Math.round(this.config.gridSize * scaleMultiplier));
        }

        const activeColors = this.getActiveColors();
        const activeColorsRgb = activeColors.map(hexToRgb);
        const totalSteps = this.matrixSize;
        const pad = Math.min(0.4, Math.max(0, this.config.cellPadding ?? 0));

        this.ctx.globalCompositeOperation = this.config.blendMode || 'source-over';
        this.ctx.globalAlpha = this.config.shapeOpacity ?? 1;

        let gridCol = 0;
        for (let y = 0; y < th; y += cell, gridCol = 0) {
            let gridRow = Math.floor(y / cell);
            for (let x = 0; x < tw; x += cell, gridCol++) {
                let totalLuma = 0, count = 0;
                let sumR = 0, sumG = 0, sumB = 0;

                for (let cy = 0; cy < cell && (y + cy) < th; cy++) {
                    for (let cx = 0; cx < cell && (x + cx) < tw; cx++) {
                        const pxIndex = ((y + cy) * tw + (x + cx)) * 4;
                        if (pxIndex < pixels.length) {
                            const r = pixels[pxIndex], g = pixels[pxIndex + 1], b = pixels[pxIndex + 2];
                            totalLuma += 0.299 * r + 0.587 * g + 0.114 * b;
                            sumR += r; sumG += g; sumB += b;
                            count++;
                        }
                    }
                }

                if (count === 0) continue;
                let avgLuma = totalLuma / count;
                if (this.config.invert) avgLuma = 255 - avgLuma;

                let stepIndex = Math.floor((avgLuma / 255) * totalSteps);
                if (stepIndex > totalSteps - 1) stepIndex = totalSteps - 1;
                if (stepIndex < 0) stepIndex = 0;

                const t = avgLuma / 255;
                let computedScale = this.config.scaleMin + (this.config.scaleMax - this.config.scaleMin) * t;

                if (this.config.scaleUpMidtones) {
                    const midtoneFactor = 1 - Math.pow((t - 0.5) * 2, 2);
                    computedScale = this.config.scaleMin + (this.config.scaleMax - this.config.scaleMin) * midtoneFactor;
                }

                let colorChosen;
                if (this.config.colorMode === 'sampled') {
                    // Real block color, quantized to nearest active palette entry —
                    // gives each cell true source-image color info instead of noise.
                    const avgRgb = { r: sumR / count, g: sumG / count, b: sumB / count };
                    colorChosen = nearestPaletteColor(avgRgb, activeColors, activeColorsRgb);
                } else {
                    // Legacy mode: stable per-cell pseudo-random pick, seeded by grid
                    // index (not pixel position) so it doesn't shift with gridSize/aspect
                    // and doesn't flicker frame to frame.
                    const seed = Math.sin(gridCol * 12.9898 + gridRow * 78.233) * 43758.5453;
                    colorChosen = activeColors[Math.abs(Math.floor(seed * 1000)) % activeColors.length];
                }

                // Gutter: shrink the usable cell footprint by the padding fraction
                // on each side before applying luminance scale, instead of letting
                // shapes touch edge-to-edge.
                const availableFrac = 1 - pad * 2;

                if (this.loadedPaths[stepIndex]) {
                    this.ctx.save();
                    this.ctx.translate(x + cell / 2, y + cell / 2);
                    if (this.config.rotation !== 0) this.ctx.rotate((this.config.rotation * Math.PI) / 180);
                    this.ctx.scale((cell / 100) * computedScale * availableFrac, (cell / 100) * computedScale * availableFrac);
                    this.ctx.translate(-50, -50);
                    this.ctx.fillStyle = colorChosen;
                    this.ctx.fill(this.loadedPaths[stepIndex].path2D);
                    this.ctx.restore();
                }
            }
        }

        this.ctx.globalCompositeOperation = 'source-over';
        this.ctx.globalAlpha = 1;
    }

    // --- Export -------------------------------------------------------------

    // _showWarningModal removed, now using shared utility

    async exportToSVG() {
        if (!this.mediaType || !this.activeImage) return null;

        const sw = this.activeImage.width, sh = this.activeImage.height;
        const aspectRatio = this.config.aspectRatio;

        let tw = sw, th = sh;
        if (aspectRatio === 'square') { tw = Math.min(sw, sh); th = tw; }

        let cell = this.config.gridSize;

        const cols = Math.ceil(tw / cell);
        const rows = Math.ceil(th / cell);
        const estimatedShapes = cols * rows;

        if (estimatedShapes > 8000) {
            const proceed = await showLargeExportWarning(estimatedShapes, 'shapes');
            if (!proceed) return null;
        }

        let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${tw} ${th}" width="${tw}" height="${th}">\n`;
        svg += `<rect width="100%" height="100%" fill="${this.config.bgColor}"/>\n`;

        const sxOffset = (aspectRatio === 'square') ? (sw - Math.min(sw, sh)) / 2 : 0;
        const syOffset = (aspectRatio === 'square') ? (sh - Math.min(sw, sh)) / 2 : 0;
        const swSrc = (aspectRatio === 'square') ? Math.min(sw, sh) : sw;
        const shSrc = (aspectRatio === 'square') ? Math.min(sw, sh) : sh;

        if (this._processingCanvas.width !== tw || this._processingCanvas.height !== th) {
            this._processingCanvas.width = tw;
            this._processingCanvas.height = th;
        }
        this._processingCtx.clearRect(0, 0, tw, th);
        this._processingCtx.drawImage(this._sourceCanvas, sxOffset, syOffset, swSrc, shSrc, 0, 0, tw, th);

        const imgData = this._processingCtx.getImageData(0, 0, tw, th);
        const pixels = imgData.data;

        const activeColors = this.getActiveColors();
        const activeColorsRgb = activeColors.map(hexToRgb);
        const totalSteps = this.matrixSize;
        const pad = Math.min(0.4, Math.max(0, this.config.cellPadding ?? 0));

        let gridCol = 0;
        for (let y = 0; y < th; y += cell, gridCol = 0) {
            let gridRow = Math.floor(y / cell);
            for (let x = 0; x < tw; x += cell, gridCol++) {
                let totalLuma = 0, count = 0;
                let sumR = 0, sumG = 0, sumB = 0;

                for (let cy = 0; cy < cell && (y + cy) < th; cy++) {
                    for (let cx = 0; cx < cell && (x + cx) < tw; cx++) {
                        const pxIndex = ((y + cy) * tw + (x + cx)) * 4;
                        if (pxIndex < pixels.length) {
                            const r = pixels[pxIndex], g = pixels[pxIndex + 1], b = pixels[pxIndex + 2];
                            totalLuma += 0.299 * r + 0.587 * g + 0.114 * b;
                            sumR += r; sumG += g; sumB += b;
                            count++;
                        }
                    }
                }

                if (count === 0) continue;
                let avgLuma = totalLuma / count;
                if (this.config.invert) avgLuma = 255 - avgLuma;

                let stepIndex = Math.floor((avgLuma / 255) * totalSteps);
                if (stepIndex > totalSteps - 1) stepIndex = totalSteps - 1;
                if (stepIndex < 0) stepIndex = 0;

                const t = avgLuma / 255;
                let computedScale = this.config.scaleMin + (this.config.scaleMax - this.config.scaleMin) * t;

                if (this.config.scaleUpMidtones) {
                    const midtoneFactor = 1 - Math.pow((t - 0.5) * 2, 2);
                    computedScale = this.config.scaleMin + (this.config.scaleMax - this.config.scaleMin) * midtoneFactor;
                }

                let colorChosen;
                if (this.config.colorMode === 'sampled') {
                    const avgRgb = { r: sumR / count, g: sumG / count, b: sumB / count };
                    colorChosen = nearestPaletteColor(avgRgb, activeColors, activeColorsRgb);
                } else {
                    const seed = Math.sin(gridCol * 12.9898 + gridRow * 78.233) * 43758.5453;
                    colorChosen = activeColors[Math.abs(Math.floor(seed * 1000)) % activeColors.length];
                }

                const availableFrac = 1 - pad * 2;

                if (this.loadedPaths[stepIndex]) {
                    const finalScale = (cell / 100) * computedScale * availableFrac;
                    const rot = this.config.rotation;
                    const innerContent = this.loadedPaths[stepIndex].rawSvg
                        .replace(/<svg[^>]*>/i, '')
                        .replace(/<\/svg>/i, '')
                        .replace(/currentColor/g, colorChosen);

                    const styleAttr = `mix-blend-mode: ${this.config.blendMode || 'normal'}; opacity: ${this.config.shapeOpacity ?? 1};`;

                    svg += `<g transform="translate(${x + cell / 2}, ${y + cell / 2}) rotate(${rot}) scale(${finalScale}) translate(-50, -50)" style="${styleAttr}">\n`;
                    svg += `${innerContent}\n`;
                    svg += `</g>\n`;
                }
            }
        }

        svg += `</svg>`;
        return svg;
    }

    destroy() {
        if (this._objectUrl) URL.revokeObjectURL(this._objectUrl);
        this._stopMediaInternals();
    }
}
