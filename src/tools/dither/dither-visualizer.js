import { showLargeExportWarning } from '../../utils/export-warning.js';

export class DitherVisualizer {
    static PALETTES = {
        'bw': ['#000000', '#ffffff'],
        'cobalt-logo': ['#0b38ed', '#dfe6eb'],
        'orange-brand': ['#eb4000', '#fcebe6'],
        'emerald-icon': ['#047a40', '#e3f2ea'],
        'greyscale': ['#000000', '#555555', '#aaaaaa', '#ffffff'],
        'obra-dinn': ['#eaffcd', '#35332f'],
        'metallica': ['#000000', '#fcf12a'],
        'cga-mode4-p1': ['#000000', '#55ffff', '#ff55ff', '#ffffff'],
        'cga-mode4-p0': ['#000000', '#55ff55', '#ff5555', '#ffff55'],
        'cga-mode5': ['#000000', '#55ffff', '#ff5555', '#ffffff'],
        'gameboy': ['#0f380f', '#306230', '#8bac0f', '#9bbc0f'],
        'moonlight': ['#0f101c', '#2f3e5b', '#5f748c', '#91a8ae', '#c5d9c7', '#f0f6e8'],
        'amiga': ['#aaaaaa', '#000000', '#ffffff', '#0000aa'],
        'sunset': ['#2d1b2e', '#b45252', '#d3a068', '#4b5bab'],
        'hulk': ['#172016', '#43593a', '#7d9c67', '#c1e0a8'],
        'infrared': ['#000000', '#ff0000', '#ffff00', '#ffffff'],
        'teletext': ['#000000', '#ff0000', '#00ff00', '#ffff00', '#0000ff', '#ff00ff', '#00ffff', '#ffffff'],
        'cga': ['#000000', '#0000aa', '#00aa00', '#00aaaa', '#aa0000', '#aa00aa', '#aa5500', '#aaaaaa', '#555555', '#5555ff', '#55ff55', '#55ffff', '#ff5555', '#ff55ff', '#ffff55', '#ffffff'],
        'vic20': ['#000000', '#ffffff', '#880000', '#aaffee', '#cc44cc', '#00cc55', '#0000aa', '#eeee77', '#dd8855', '#664400', '#ff7777', '#333333', '#777777', '#aaff66', '#0088ff', '#bbbbbb'],
        'macintosh': ['#ffffff', '#fbf305', '#ff6403', '#dd0907', '#f20884', '#4700a5', '#0000d3', '#02abea', '#1fb714', '#006412', '#562c05', '#90713a', '#c0c0c0', '#808080', '#404040', '#000000'],
        'zx-spectrum': ['#000000', '#0000d7', '#d70000', '#d700d7', '#00d700', '#00d7d7', '#d7d700', '#d7d7d7', '#0000ff', '#ff0000', '#ff00ff', '#00ff00', '#00ffff', '#ffff00', '#ffffff'],
        'ega': ['#000000', '#0000aa', '#00aa00', '#00aaaa', '#aa0000', '#aa00aa', '#aa5500', '#aaaaaa', '#555555', '#5555ff', '#55ff55', '#55ffff', '#ff5555', '#ff55ff', '#ffff55', '#ffffff'],
        'custom': ['#000000', '#ffffff'] // Overwritten by config
    };

    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d', { willReadFrequently: true });

        this.offscreenCanvas = document.createElement('canvas');
        this.offscreenCtx = this.offscreenCanvas.getContext('2d', { willReadFrequently: true });

        this.mediaElement = null;
        this._objectUrl = null;

        this.config = {
            resolution: 400,
            brightness: 0,
            contrast: 1,
            pixelLogoMode: true,
            alphaThreshold: 128,
            algorithm: 'floyd-steinberg',
            paletteKey: 'bw',
            customColor1: '#000000',
            customColor2: '#ffffff'
        };

        // Blank initial paint
        this.canvas.width = 800;
        this.canvas.height = 800;
        this.ctx.fillStyle = '#222';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        this.triggerRender();
    }

    triggerRender() {
        if (this.mediaElement) {
            if (this._renderTimeout) {
                clearTimeout(this._renderTimeout);
            }
            this._renderTimeout = setTimeout(() => {
                this._renderFrame();
                this._renderTimeout = null;
            }, 50);
        }
    }

    loadMedia(file) {
        if (!file) return;

        if (this._objectUrl) URL.revokeObjectURL(this._objectUrl);
        const url = URL.createObjectURL(file);
        this._objectUrl = url;

        const img = new Image();
        img.src = url;
        img.onload = () => {
            this.mediaElement = img;
            this.triggerRender();
        };
    }

    _hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? [
            parseInt(result[1], 16),
            parseInt(result[2], 16),
            parseInt(result[3], 16)
        ] : [0, 0, 0];
    }

    _getPaletteColors() {
        let hexColors = DitherVisualizer.PALETTES[this.config.paletteKey] || DitherVisualizer.PALETTES['bw'];
        if (this.config.paletteKey === 'custom') {
            hexColors = [this.config.customColor1, this.config.customColor2];
        }
        return hexColors.map(this._hexToRgb.bind(this));
    }

    _findClosestPaletteColor(r, g, b, paletteRGB) {
        let minDistanceSq = Infinity;
        let closestIndex = 0;
        for (let i = 0; i < paletteRGB.length; i++) {
            const pr = paletteRGB[i][0];
            const pg = paletteRGB[i][1];
            const pb = paletteRGB[i][2];
            const distSq = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2;
            if (distSq < minDistanceSq) {
                minDistanceSq = distSq;
                closestIndex = i;
            }
        }
        return paletteRGB[closestIndex];
    }

    _applyBrightnessContrast(pixels, brightness, contrast) {
        for (let i = 0; i < pixels.length; i += 4) {
            for (let c = 0; c < 3; c++) {
                let val = pixels[i + c];
                val = ((val / 255.0 - 0.5) * contrast + 0.5) * 255.0 + brightness;
                pixels[i + c] = Math.max(0, Math.min(255, val));
            }
        }
    }

    _renderFrame() {
        if (!this.mediaElement) return;

        const sourceWidth = this.mediaElement.width;
        const sourceHeight = this.mediaElement.height;
        if (!sourceWidth || !sourceHeight) return;

        // Calculate aspect ratio
        const aspect = sourceHeight / sourceWidth;
        const resWidth = parseInt(this.config.resolution);
        const resHeight = Math.floor(resWidth * aspect);

        // Update canvas sizes
        this.canvas.width = resWidth;
        this.canvas.height = resHeight;
        this.offscreenCanvas.width = resWidth;
        this.offscreenCanvas.height = resHeight;

        // Draw image downscaled to offscreen canvas
        if (!this.config.pixelLogoMode) {
            this.offscreenCtx.fillStyle = '#ffffff';
            this.offscreenCtx.fillRect(0, 0, resWidth, resHeight);
        } else {
            this.offscreenCtx.clearRect(0, 0, resWidth, resHeight);
        }
        this.offscreenCtx.drawImage(this.mediaElement, 0, 0, resWidth, resHeight);

        // Get pixel data
        const imageData = this.offscreenCtx.getImageData(0, 0, resWidth, resHeight);
        const pixels = imageData.data;
        const width = resWidth;
        const height = resHeight;

        // Pre-process (brightness & contrast)
        this._applyBrightnessContrast(pixels, parseFloat(this.config.brightness), parseFloat(this.config.contrast));

        const paletteRGB = this._getPaletteColors();
        const algorithm = this.config.algorithm;

        // Error buffers for diffusion
        const errors = new Float32Array(width * height * 3);

        const bayerMatrix = [
            [0 / 16, 8 / 16, 2 / 16, 10 / 16],
            [12 / 16, 4 / 16, 14 / 16, 6 / 16],
            [3 / 16, 11 / 16, 1 / 16, 9 / 16],
            [15 / 16, 7 / 16, 13 / 16, 5 / 16]
        ];

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;
                const errIdx = (y * width + x) * 3;

                if (this.config.pixelLogoMode) {
                    if (pixels[idx + 3] < this.config.alphaThreshold) {
                        pixels[idx + 3] = 0;
                        continue;
                    } else {
                        pixels[idx + 3] = 255;
                    }
                }

                let r = pixels[idx] + (errors[errIdx] || 0);
                let g = pixels[idx + 1] + (errors[errIdx + 1] || 0);
                let b = pixels[idx + 2] + (errors[errIdx + 2] || 0);

                if (algorithm === 'random') {
                    r += (Math.random() - 0.5) * 64;
                    g += (Math.random() - 0.5) * 64;
                    b += (Math.random() - 0.5) * 64;
                } else if (algorithm === 'ordered') {
                    const threshold = (bayerMatrix[y % 4][x % 4] - 0.5) * 255;
                    r += threshold;
                    g += threshold;
                    b += threshold;
                }

                r = Math.max(0, Math.min(255, r));
                g = Math.max(0, Math.min(255, g));
                b = Math.max(0, Math.min(255, b));

                const closest = this._findClosestPaletteColor(r, g, b, paletteRGB);

                pixels[idx] = closest[0];
                pixels[idx + 1] = closest[1];
                pixels[idx + 2] = closest[2];

                const errR = r - closest[0];
                const errG = g - closest[1];
                const errB = b - closest[2];

                if (algorithm === 'floyd-steinberg') {
                    const distributeError = (dx, dy, factor) => {
                        if (x + dx >= 0 && x + dx < width && y + dy >= 0 && y + dy < height) {
                            const eIdx = ((y + dy) * width + (x + dx)) * 3;
                            errors[eIdx] += errR * factor;
                            errors[eIdx + 1] += errG * factor;
                            errors[eIdx + 2] += errB * factor;
                        }
                    };
                    distributeError(1, 0, 7 / 16);
                    distributeError(-1, 1, 3 / 16);
                    distributeError(0, 1, 5 / 16);
                    distributeError(1, 1, 1 / 16);
                } else if (algorithm === 'atkinson') {
                    const distributeError = (dx, dy) => {
                        if (x + dx >= 0 && x + dx < width && y + dy >= 0 && y + dy < height) {
                            const eIdx = ((y + dy) * width + (x + dx)) * 3;
                            const factor = 1 / 8;
                            errors[eIdx] += errR * factor;
                            errors[eIdx + 1] += errG * factor;
                            errors[eIdx + 2] += errB * factor;
                        }
                    };
                    distributeError(1, 0); distributeError(2, 0);
                    distributeError(-1, 1); distributeError(0, 1); distributeError(1, 1);
                    distributeError(0, 2);
                }
            }
        }

        this.ctx.putImageData(imageData, 0, 0);
    }

    async exportToSVG() {
        if (!this.config.pixelLogoMode) {
            alert('SVG export is only supported when Pixel Logo Builder Mode is enabled.');
            return null;
        }

        const width = this.canvas.width;
        const height = this.canvas.height;
        const imageData = this.ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        const colorLayers = {};
        let totalBlocks = 0;

        const toHex = (c) => ('0' + c.toString(16)).slice(-2);

        for (let y = 0; y < height; y++) {
            let x = 0;
            while (x < width) {
                const idx = (y * width + x) * 4;
                if (data[idx + 3] === 0) {
                    x++;
                    continue;
                }
                const r = data[idx], g = data[idx + 1], b = data[idx + 2];
                const color = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
                const startX = x;
                let runWidth = 1;
                x++;

                while (x < width) {
                    const nextIdx = (y * width + x) * 4;
                    if (data[nextIdx + 3] === 0) break;
                    if (data[nextIdx] === r && data[nextIdx + 1] === g && data[nextIdx + 2] === b) {
                        runWidth++;
                        x++;
                    } else {
                        break;
                    }
                }

                if (!colorLayers[color]) {
                    colorLayers[color] = [];
                }
                colorLayers[color].push(`M${startX} ${y}h${runWidth}v1h-${runWidth}Z`);
                totalBlocks++;
            }
        }

        if (totalBlocks > 8000) {
            const proceed = await showLargeExportWarning(totalBlocks, 'vector segments');
            if (!proceed) return null;
        }

        const scale = Math.max(1, Math.floor(800 / width));
        const svgWidth = width * scale;
        const svgHeight = height * scale;

        let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${svgWidth}" height="${svgHeight}" shape-rendering="crispEdges">\n`;

        let layerIndex = 1;
        for (const [color, pathChunks] of Object.entries(colorLayers)) {
            const hexClean = color.replace('#', '');
            svg += `  <g id="Layer_${layerIndex}_Color_${hexClean}" fill="${color}">\n`;
            svg += `    <path d="${pathChunks.join(' ')}" />\n`;
            svg += `  </g>\n`;
            layerIndex++;
        }

        svg += `</svg>`;
        return svg;
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
        if (this._objectUrl) URL.revokeObjectURL(this._objectUrl);
        this.mediaElement = null;
    }
}