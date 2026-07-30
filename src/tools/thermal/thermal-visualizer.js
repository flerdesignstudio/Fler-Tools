export class ThermalVisualizer {
    // Ordered from low to high signal intensity. These are false-colour display ramps,
    // not a claim that an RGB photograph contains measured temperature information.
    static PALETTES = {
        classic: ['#02030d', '#102a72', '#0868b5', '#00b9c6', '#f04b24', '#ffb000', '#fff7c2'],
        ironbow: ['#000000', '#21003c', '#760058', '#cc1c22', '#ff7800', '#ffd54a', '#ffffff'],
        inferno: ['#000004', '#320a5f', '#781c6d', '#bb3754', '#ed6925', '#fbb318', '#fcffa4'],
        arctic: ['#050a1f', '#123b78', '#1985bb', '#55d9e8', '#d9ffff', '#ffffff'],
        grayscale: ['#000000', '#ffffff'],
        vibrant: ['#ffffff', '#00df34', '#ffe200', '#ff8c00', '#ff0000']
    };

    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d', { willReadFrequently: true });
        this.offscreenCanvas = document.createElement('canvas');
        this.offscreenCtx = this.offscreenCanvas.getContext('2d', { willReadFrequently: true });
        this.mediaElement = null;
        this._objectUrl = null;
        this._renderTimeout = null;

        this.config = {
            resolution: 800,
            paletteKey: 'classic',
            autoLevels: true,
            blackPoint: 0,
            whitePoint: 100,
            brightness: 0,
            contrast: 1,
            gamma: 1,
            invert: false,
            blur: 0,
            sensorNoise: 0,
            overlayGrain: 0
        };

        this.canvas.width = 800;
        this.canvas.height = 800;
        this.ctx.fillStyle = '#111827';
        this.ctx.fillRect(0, 0, 800, 800);
    }

    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        this.triggerRender();
    }

    triggerRender() {
        if (!this.mediaElement) return;
        clearTimeout(this._renderTimeout);
        this._renderTimeout = setTimeout(() => {
            this._renderFrame();
            this._renderTimeout = null;
        }, 50);
    }

    loadMedia(file) {
        if (!file) return;
        if (this._objectUrl) URL.revokeObjectURL(this._objectUrl);
        this._objectUrl = URL.createObjectURL(file);

        const image = new Image();
        image.onload = () => {
            this.mediaElement = image;
            this.triggerRender();
        };
        image.src = this._objectUrl;
    }

    _hexToRgb(hex) {
        const value = hex.replace('#', '');
        return [
            parseInt(value.slice(0, 2), 16),
            parseInt(value.slice(2, 4), 16),
            parseInt(value.slice(4, 6), 16)
        ];
    }

    _paletteRgb() {
        const palette = ThermalVisualizer.PALETTES[this.config.paletteKey] || ThermalVisualizer.PALETTES.classic;
        return palette.map((color) => this._hexToRgb(color));
    }

    _linearChannel(channel) {
        const value = channel / 255;
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    }

    _luminance(r, g, b) {
        // Work in linear light, so the intensity proxy behaves more naturally than
        // averaging gamma-encoded RGB values from the source image.
        return 0.2126 * this._linearChannel(r)
            + 0.7152 * this._linearChannel(g)
            + 0.0722 * this._linearChannel(b);
    }

    _findAutoLevels(luminance) {
        const histogram = new Uint32Array(256);
        let count = 0;
        for (let i = 0; i < luminance.length; i++) {
            const value = luminance[i];
            if (Number.isNaN(value)) continue;
            histogram[Math.min(255, Math.floor(value * 255))]++;
            count++;
        }
        if (!count) return [0, 1];

        const percentile = (fraction) => {
            const target = count * fraction;
            let accumulated = 0;
            for (let i = 0; i < histogram.length; i++) {
                accumulated += histogram[i];
                if (accumulated >= target) return i / 255;
            }
            return 1;
        };

        const black = percentile(0.01);
        const white = percentile(0.99);
        return white > black ? [black, white] : [0, 1];
    }

    _samplePalette(t, palette) {
        const position = t * (palette.length - 1);
        const index = Math.min(palette.length - 2, Math.floor(position));
        const amount = position - index;
        const from = palette[index];
        const to = palette[index + 1];
        return [
            Math.round(from[0] + (to[0] - from[0]) * amount),
            Math.round(from[1] + (to[1] - from[1]) * amount),
            Math.round(from[2] + (to[2] - from[2]) * amount)
        ];
    }

    _renderFrame() {
        if (!this.mediaElement) return;
        const sourceWidth = this.mediaElement.naturalWidth;
        const sourceHeight = this.mediaElement.naturalHeight;
        if (!sourceWidth || !sourceHeight) return;

        const width = Number(this.config.resolution);
        const height = Math.max(1, Math.floor(width * sourceHeight / sourceWidth));
        this.canvas.width = width;
        this.canvas.height = height;
        this.offscreenCanvas.width = width;
        this.offscreenCanvas.height = height;
        this.offscreenCtx.clearRect(0, 0, width, height);
        this.offscreenCtx.filter = Number(this.config.blur) > 0 ? `blur(${this.config.blur}px)` : 'none';
        this.offscreenCtx.drawImage(this.mediaElement, 0, 0, width, height);
        this.offscreenCtx.filter = 'none';

        const imageData = this.offscreenCtx.getImageData(0, 0, width, height);
        const pixels = imageData.data;
        const luminance = new Float32Array(width * height);
        for (let pixel = 0, offset = 0; pixel < luminance.length; pixel++, offset += 4) {
            luminance[pixel] = pixels[offset + 3] === 0
                ? Number.NaN
                : this._luminance(pixels[offset], pixels[offset + 1], pixels[offset + 2]);
        }

        const [autoBlack, autoWhite] = this._findAutoLevels(luminance);
        const black = this.config.autoLevels ? autoBlack : Number(this.config.blackPoint) / 100;
        const white = this.config.autoLevels ? autoWhite : Number(this.config.whitePoint) / 100;
        const range = Math.max(0.0001, white - black);
        const contrast = Number(this.config.contrast);
        const brightness = Number(this.config.brightness) / 100;
        const gamma = Math.max(0.1, Number(this.config.gamma));
        const palette = this._paletteRgb();
        const sensorNoiseAmt = Number(this.config.sensorNoise) / 100;
        const overlayGrainAmt = Number(this.config.overlayGrain) / 100 * 255;

        for (let pixel = 0, offset = 0; pixel < luminance.length; pixel++, offset += 4) {
            if (pixels[offset + 3] === 0) continue;
            let t = (luminance[pixel] - black) / range;
            t = (t - 0.5) * contrast + 0.5 + brightness;
            
            if (sensorNoiseAmt > 0) {
                t += (Math.random() - 0.5) * sensorNoiseAmt;
            }
            
            t = Math.max(0, Math.min(1, t));
            t = t ** (1 / gamma);
            if (this.config.invert) t = 1 - t;
            
            const color = this._samplePalette(t, palette);
            
            if (overlayGrainAmt > 0) {
                const noise = (Math.random() - 0.5) * overlayGrainAmt;
                pixels[offset] = Math.max(0, Math.min(255, color[0] + noise));
                pixels[offset + 1] = Math.max(0, Math.min(255, color[1] + noise));
                pixels[offset + 2] = Math.max(0, Math.min(255, color[2] + noise));
            } else {
                pixels[offset] = color[0];
                pixels[offset + 1] = color[1];
                pixels[offset + 2] = color[2];
            }
        }
        this.ctx.putImageData(imageData, 0, 0);
    }

    exportToPNG(filename) {
        const link = document.createElement('a');
        link.href = this.canvas.toDataURL('image/png');
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    destroy() {
        clearTimeout(this._renderTimeout);
        if (this._objectUrl) URL.revokeObjectURL(this._objectUrl);
        this.mediaElement = null;
    }
}
