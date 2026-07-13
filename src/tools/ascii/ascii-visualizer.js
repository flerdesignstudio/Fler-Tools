export class AsciiVisualizer {
    static CHAR_SETS = {
        alphanumeric: " WM$08ZEXCVs+=~-.",
        letters: " WMBRXVYIotcvx>:",
        numbers: " 8964203175"
    };

    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

        this.offscreenCanvas = document.createElement('canvas');
        this.offscreenCtx = this.offscreenCanvas.getContext('2d', { willReadFrequently: true });

        this.mediaElement = null;
        this.isVideo = false;
        this.animationFrameId = null;
        this._objectUrl = null;

        this._lastSampleWidth = 0;
        this._lastSampleHeight = 0;

        this.config = {
            gridResolution: 80,
            aspectMode: 'original', // 'original' | 'square'
            canvasRes: 800,
            bgColor: '#0d47a1',
            textColor: '#ffffff',
            fontFamily: 'Space Mono',
            charsetKey: 'alphanumeric',
            customEmoji: '🌑🌒🌓🌔🌕🌞'
        };

        // Blank initial paint so the canvas isn't empty before a media is loaded
        this.canvas.width = this.config.canvasRes;
        this.canvas.height = this.config.canvasRes;
        this.ctx.fillStyle = this.config.bgColor;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        this.triggerRender();
    }

    // For static images a config change needs an explicit repaint.
    // Video already repaints every frame via its own loop, so this is a no-op there.
    triggerRender() {
        if (!this.isVideo && this.mediaElement) this._renderFrame();
    }

    loadMedia(file) {
        if (!file) return;

        if (this._objectUrl) URL.revokeObjectURL(this._objectUrl);
        const url = URL.createObjectURL(file);
        this._objectUrl = url;

        if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);

        if (file.type.startsWith('video/')) {
            this.isVideo = true;
            const video = document.createElement('video');
            video.src = url;
            video.loop = true;
            video.muted = true;
            video.crossOrigin = 'anonymous';
            video.play();
            video.addEventListener('play', () => this._renderLoop());
            this.mediaElement = video;
        } else {
            this.isVideo = false;
            const img = new Image();
            img.src = url;
            img.onload = () => this._renderFrame();
            this.mediaElement = img;
        }
    }

    _renderLoop() {
        if (this.mediaElement && !this.mediaElement.paused && !this.mediaElement.ended) {
            this._renderFrame();
            this.animationFrameId = requestAnimationFrame(() => this._renderLoop());
        }
    }

    _renderFrame() {
        if (!this.mediaElement) return;

        const { gridResolution, aspectMode, canvasRes, bgColor, textColor, fontFamily, charsetKey, customEmoji } = this.config;

        const activeCharset = charsetKey === 'emoji'
            ? [...(customEmoji || ' ')]
            : AsciiVisualizer.CHAR_SETS[charsetKey];

        const sourceWidth = this.isVideo ? this.mediaElement.videoWidth : this.mediaElement.width;
        const sourceHeight = this.isVideo ? this.mediaElement.videoHeight : this.mediaElement.height;
        if (!sourceWidth || !sourceHeight) return;

        let sampleWidth = gridResolution;
        let sampleHeight = Math.floor(gridResolution * (sourceHeight / sourceWidth));

        this._lastSampleWidth = sampleWidth;
        this._lastSampleHeight = sampleHeight;

        if (aspectMode === 'square') {
            sampleHeight = gridResolution;
            this.canvas.width = canvasRes;
            this.canvas.height = canvasRes;
        } else {
            this.canvas.width = canvasRes;
            if (canvasRes === 1080) {
                this.canvas.height = 1080;
                sampleHeight = gridResolution;
            } else {
                this.canvas.height = Math.floor(canvasRes * (sourceHeight / sourceWidth));
            }
        }

        this.canvas.style.aspectRatio = `${this.canvas.width} / ${this.canvas.height}`;
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';

        this.offscreenCanvas.width = sampleWidth;
        this.offscreenCanvas.height = sampleHeight;

        if (aspectMode === 'square' || canvasRes === 1080) {
            const minDim = Math.min(sourceWidth, sourceHeight);
            const sx = (sourceWidth - minDim) / 2;
            const sy = (sourceHeight - minDim) / 2;
            this.offscreenCtx.drawImage(this.mediaElement, sx, sy, minDim, minDim, 0, 0, sampleWidth, sampleHeight);
        } else {
            this.offscreenCtx.drawImage(this.mediaElement, 0, 0, sampleWidth, sampleHeight);
        }

        const imageData = this.offscreenCtx.getImageData(0, 0, sampleWidth, sampleHeight);
        const pixels = imageData.data;

        this.ctx.fillStyle = bgColor;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        const cellWidth = this.canvas.width / sampleWidth;
        const cellHeight = this.canvas.height / sampleHeight;

        this.ctx.fillStyle = textColor;
        this.ctx.font = `${cellHeight * 1.15}px "${fontFamily}"`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';

        const charSetLength = activeCharset.length - 1;

        for (let y = 0; y < sampleHeight; y++) {
            const targetY = y * cellHeight + cellHeight / 2;
            for (let x = 0; x < sampleWidth; x++) {
                const i = (y * sampleWidth + x) * 4;
                const brightness = (0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2]);
                const charIndex = Math.floor((brightness / 255) * charSetLength);
                this.ctx.fillText(activeCharset[charIndex], x * cellWidth + cellWidth / 2, targetY);
            }
        }
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

    exportToSVG() {
        if (!this._lastSampleWidth || !this._lastSampleHeight) return '';

        const { bgColor, textColor, fontFamily, charsetKey, customEmoji } = this.config;
        const activeCharset = charsetKey === 'emoji' ? [...(customEmoji || ' ')] : AsciiVisualizer.CHAR_SETS[charsetKey];
        const charSetLength = activeCharset.length - 1;

        const sampleWidth = this._lastSampleWidth;
        const sampleHeight = this._lastSampleHeight;

        const imageData = this.offscreenCtx.getImageData(0, 0, sampleWidth, sampleHeight);
        const pixels = imageData.data;

        const cellWidth = this.canvas.width / sampleWidth;
        const cellHeight = this.canvas.height / sampleHeight;
        const fontSize = cellHeight * 1.15;

        let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${this.canvas.width}" height="${this.canvas.height}">\n`;
        svg += `<rect width="100%" height="100%" fill="${bgColor}"/>\n`;
        svg += `<g fill="${textColor}" font-family="${fontFamily}" font-size="${fontSize}px" text-anchor="middle" dominant-baseline="central">\n`;

        for (let y = 0; y < sampleHeight; y++) {
            const targetY = y * cellHeight + cellHeight / 2;
            for (let x = 0; x < sampleWidth; x++) {
                const i = (y * sampleWidth + x) * 4;
                const brightness = (0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2]);
                const charIndex = Math.floor((brightness / 255) * charSetLength);
                const char = activeCharset[charIndex];

                let escapedChar = char;
                if (char === '<') escapedChar = '&lt;';
                else if (char === '>') escapedChar = '&gt;';
                else if (char === '&') escapedChar = '&amp;';

                svg += `<text x="${x * cellWidth + cellWidth / 2}" y="${targetY}">${escapedChar}</text>\n`;
            }
        }

        svg += `</g>\n</svg>`;
        return svg;
    }

    destroy() {
        if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
        if (this._objectUrl) URL.revokeObjectURL(this._objectUrl);
        if (this.isVideo && this.mediaElement) {
            this.mediaElement.pause();
            this.mediaElement.src = '';
        }
        this.mediaElement = null;
    }
}
