import { WebCodecsEncoder } from './encoders/webcodecs-encoder.js';
import { MediaRecorderEncoder } from './encoders/media-recorder-encoder.js';

export class OfflineRenderer {
    constructor() {
        this.activeEncoder = null;
        this.isRendering = false;
        this.shouldCancel = false;
    }

    static calculateBitrate(width, height, fps, qualityFactor = 1.0) {
        const pixels = width * height;
        const bitsPerPixelPerFrame = 0.15 * qualityFactor;
        const bitrate = pixels * fps * bitsPerPixelPerFrame;
        return Math.min(Math.max(Math.round(bitrate), 2_000_000), 200_000_000);
    }

    /**
     * Render video frame-by-frame offline.
     * @param {Object} options
     * @param {Object} options.visualizer - Active visualizer instance
     * @param {number} options.width - Output width
     * @param {number} options.height - Output height
     * @param {number} options.fps - Target frames per second
     * @param {number} options.durationMs - Video duration in milliseconds
     * @param {number} [options.motionBlurSamples=1] - Subframes per frame for motion blur
     * @param {function} [options.onProgress] - Progress callback
     * @returns {Promise<Blob>}
     */
    async render(options) {
        const {
            visualizer,
            width,
            height,
            fps,
            durationMs,
            motionBlurSamples = 1,
            onProgress
        } = options;

        this.isRendering = true;
        this.shouldCancel = false;

        const totalFrames = Math.max(1, Math.round((durationMs / 1000) * fps));
        const frameDurationMs = 1000 / fps;
        const bitrate = OfflineRenderer.calculateBitrate(width, height, fps, 1.2);

        // Instantiate suitable encoder (WebCodecs if supported, otherwise MediaRecorder)
        if (WebCodecsEncoder.isSupported()) {
            this.activeEncoder = new WebCodecsEncoder();
        } else {
            this.activeEncoder = new MediaRecorderEncoder();
        }

        try {
            await this.activeEncoder.start({ width, height, fps, bitrate });
        } catch (err) {
            console.warn('Encoder start failed, falling back to MediaRecorderEncoder:', err);
            this.activeEncoder = new MediaRecorderEncoder();
            await this.activeEncoder.start({ width, height, fps, bitrate });
        }

        // Accumulation/output canvas
        const renderCanvas = document.createElement('canvas');
        renderCanvas.width = width;
        renderCanvas.height = height;
        const renderCtx = renderCanvas.getContext('2d');

        // Subframe canvas and float accumulation buffer if motion blur active
        let subCanvas = null, subCtx = null;
        let floatAccumBuffer = null, finalImageData = null;
        if (motionBlurSamples > 1) {
            subCanvas = document.createElement('canvas');
            subCanvas.width = width;
            subCanvas.height = height;
            subCtx = subCanvas.getContext('2d');

            floatAccumBuffer = new Float32Array(width * height * 4);
            finalImageData = renderCtx.createImageData(width, height);
        }

        // Notify visualizer of export start if supported
        if (typeof visualizer.beginExport === 'function') {
            visualizer.beginExport({ width, height, fps });
        }

        const startTime = Date.now();
        let lastYieldTime = performance.now();

        for (let f = 0; f < totalFrames; f++) {
            if (this.shouldCancel) {
                if (this.activeEncoder) {
                    this.activeEncoder.cancel();
                    this.activeEncoder = null;
                }
                if (typeof visualizer.endExport === 'function') visualizer.endExport();
                this.isRendering = false;
                throw new Error('Export cancelled');
            }

            const frameTimeSec = (f * frameDurationMs) / 1000;

            if (motionBlurSamples > 1 && subCtx) {
                // Accumulative motion blur with float (32-bit) precision to prevent alpha quantization
                floatAccumBuffer.fill(0);
                const stepSec = (frameDurationMs / 1000) / motionBlurSamples;

                for (let s = 0; s < motionBlurSamples; s++) {
                    const subTimeSec = frameTimeSec + (s * stepSec);
                    if (typeof visualizer.renderFrame === 'function') {
                        await visualizer.renderFrame(subTimeSec, subCanvas);
                    }
                    const subPixels = subCtx.getImageData(0, 0, width, height).data;
                    for (let i = 0; i < subPixels.length; i++) {
                        floatAccumBuffer[i] += subPixels[i];
                    }
                }

                const outPixels = finalImageData.data;
                const invSamples = 1 / motionBlurSamples;
                for (let i = 0; i < outPixels.length; i++) {
                    outPixels[i] = Math.round(floatAccumBuffer[i] * invSamples);
                }
                renderCtx.putImageData(finalImageData, 0, 0);
            } else {
                // Single Frame Rendering
                if (typeof visualizer.renderFrame === 'function') {
                    await visualizer.renderFrame(frameTimeSec, renderCanvas);
                } else if (visualizer.canvas) {
                    // Fallback if renderFrame is not yet implemented in visualizer
                    renderCtx.drawImage(visualizer.canvas, 0, 0, width, height);
                }
            }

            // Add frame to encoder
            await this.activeEncoder.addFrame(renderCanvas, f * frameDurationMs);

            // Update progress bar
            if (typeof onProgress === 'function') {
                const percent = Math.min(((f + 1) / totalFrames) * 100, 100);
                const elapsedSec = (Date.now() - startTime) / 1000;
                const estimatedTotalSec = elapsedSec / ((f + 1) / totalFrames);
                const remainingSec = Math.max(0, Math.ceil(estimatedTotalSec - elapsedSec));

                onProgress({
                    currentFrame: f + 1,
                    totalFrames,
                    percent,
                    remainingSec
                });
            }

            // Adaptive yield to browser event loop if rendering takes more than 16ms
            if (performance.now() - lastYieldTime > 16) {
                await new Promise(resolve => setTimeout(resolve, 0));
                lastYieldTime = performance.now();
            }
        }

        // Finalize recording
        const blob = await this.activeEncoder.finish();
        this.activeEncoder = null;
        this.isRendering = false;

        if (typeof visualizer.endExport === 'function') {
            visualizer.endExport();
        }

        return blob;
    }

    cancel() {
        this.shouldCancel = true;
    }
}
