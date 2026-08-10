import { showLargeExportWarning } from '../../utils/export-warning.js';

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
        this.isPlaying = true;
        this.isLooping = true;
        this.speed = 1.0;
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

    play() {
        this.isPlaying = true;
        if (this.isVideo && this.mediaElement) {
            this.mediaElement.play();
            if (!this.animationFrameId) this._renderLoop();
        } else if (!this.isVideo && this.mediaElement) {
            this._renderFrame();
        }
    }

    pause() {
        this.isPlaying = false;
        if (this.isVideo && this.mediaElement) {
            this.mediaElement.pause();
        }
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    restart() {
        if (this.isVideo && this.mediaElement && !this._webcamStream) {
            this.mediaElement.currentTime = 0;
            if (this.isPlaying) this.mediaElement.play();
        } else if (!this.isVideo && this.mediaElement) {
            this._renderFrame();
        }
    }

    setLoop(loop) {
        this.isLooping = loop;
        if (this.mediaElement && this.isVideo) {
            this.mediaElement.loop = loop;
        }
    }

    setSpeed(speed) {
        this.speed = speed;
        if (this.mediaElement && this.isVideo) {
            this.mediaElement.playbackRate = speed;
        }
    }

    loadMedia(file) {
        if (!file) return;

        this.stopWebcam();
        if (this._objectUrl) URL.revokeObjectURL(this._objectUrl);
        const url = URL.createObjectURL(file);
        this._objectUrl = url;

        if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);

        const isVideo = (file.type && file.type.startsWith('video/')) || /\.(mp4|webm|mov|avi|mkv|m4v|ogv)$/i.test(file.name || '');

        if (isVideo) {
            this.isVideo = true;
            const video = document.createElement('video');
            video.loop = this.isLooping;
            video.playbackRate = this.speed;
            video.muted = true;
            video.playsInline = true;
            video.onloadeddata = () => {
                if (this.isPlaying) video.play().catch(() => {});
                if (this.isPlaying && !this.animationFrameId) this._renderLoop();
            };
            video.oncanplay = () => {
                if (this.isPlaying && !this.animationFrameId) this._renderLoop();
            };
            video.src = url;
            this.mediaElement = video;
            if (this.isPlaying) video.play().catch(() => {});
            video.load();
        } else {
            this.isVideo = false;
            const img = new Image();
            img.onload = () => this._renderFrame();
            img.src = url;
            this.mediaElement = img;
        }
    }

    async startWebcam() {
        this.stopWebcam();
        if (this._objectUrl) {
            URL.revokeObjectURL(this._objectUrl);
            this._objectUrl = null;
        }

        try {
            this._webcamStream = await navigator.mediaDevices.getUserMedia({ video: true });
            this.isVideo = true;
            const video = document.createElement('video');
            video.srcObject = this._webcamStream;
            video.autoplay = true;
            video.loop = this.isLooping;
            video.playbackRate = this.speed;
            video.muted = true;
            video.playsInline = true;
            video.onloadeddata = () => {
                if (this.isPlaying) video.play().catch(() => {});
                if (this.isPlaying && !this.animationFrameId) this._renderLoop();
            };
            this.mediaElement = video;
            if (this.isPlaying) video.play().catch(() => {});
        } catch (err) {
            console.error('Error accessing webcam', err);
            alert('Could not access webcam. Please check permissions.');
        }
    }

    stopWebcam() {
        if (this._webcamStream) {
            this._webcamStream.getTracks().forEach(track => track.stop());
            this._webcamStream = null;
        }
    }

    beginExport() {
        this._isExporting = true;
        if (this.isVideo && this.mediaElement) {
            this.mediaElement.pause();
        }
    }

    endExport() {
        this._isExporting = false;
        if (this.isVideo && this.mediaElement && this.isPlaying) {
            this.mediaElement.play().catch(() => {});
        }
    }

    async renderFrame(timeSec, targetCanvas = null) {
        if (this.isVideo && this.mediaElement && this.mediaElement.duration) {
            this.mediaElement.currentTime = timeSec % this.mediaElement.duration;
            await new Promise(resolve => {
                const onSeeked = () => {
                    this.mediaElement.removeEventListener('seeked', onSeeked);
                    resolve();
                };
                this.mediaElement.addEventListener('seeked', onSeeked);
                setTimeout(resolve, 50);
            });
        }
        this._renderFrame();
        if (targetCanvas && targetCanvas !== this.canvas) {
            const ctx = targetCanvas.getContext('2d');
            ctx.drawImage(this.canvas, 0, 0, targetCanvas.width, targetCanvas.height);
        }
    }

    _renderLoop() {
        if (!this.isPlaying || !this.mediaElement) {
            this.animationFrameId = null;
            return;
        }
        this._renderFrame();
        this.animationFrameId = requestAnimationFrame(() => this._renderLoop());
    }

    _renderFrame() {
        if (!this.mediaElement) return;

        const { gridResolution, aspectMode, canvasRes, bgColor, textColor, fontFamily, charsetKey, customEmoji } = this.config;

        const activeCharset = charsetKey === 'emoji'
            ? [...(customEmoji || ' ')]
            : AsciiVisualizer.CHAR_SETS[charsetKey];

        const sourceWidth = this.mediaElement.videoWidth || this.mediaElement.naturalWidth || this.mediaElement.width;
        const sourceHeight = this.mediaElement.videoHeight || this.mediaElement.naturalHeight || this.mediaElement.height;
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

        if (this._webcamStream) {
            this.offscreenCtx.save();
            this.offscreenCtx.translate(sampleWidth, 0);
            this.offscreenCtx.scale(-1, 1);
        }

        if (aspectMode === 'square' || canvasRes === 1080) {
            const minDim = Math.min(sourceWidth, sourceHeight);
            const sx = (sourceWidth - minDim) / 2;
            const sy = (sourceHeight - minDim) / 2;
            this.offscreenCtx.drawImage(this.mediaElement, sx, sy, minDim, minDim, 0, 0, sampleWidth, sampleHeight);
        } else {
            this.offscreenCtx.drawImage(this.mediaElement, 0, 0, sampleWidth, sampleHeight);
        }

        if (this._webcamStream) {
            this.offscreenCtx.restore();
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

    async exportToSVG() {
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

        const textNodes = sampleWidth * sampleHeight;
        if (textNodes > 8000) {
            const proceed = await showLargeExportWarning(textNodes, 'characters');
            if (!proceed) return null;
        }

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
        this.stopWebcam();
        if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
        if (this._objectUrl) URL.revokeObjectURL(this._objectUrl);
        if (this.isVideo && this.mediaElement) {
            this.mediaElement.pause();
            this.mediaElement.src = '';
            this.mediaElement.srcObject = null;
        }
        this.mediaElement = null;
    }
}
