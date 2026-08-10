/**
 * Abstract base class for video encoders.
 */
export class VideoEncoderBase {
    constructor() {
        this.options = null;
        this.frameCount = 0;
    }

    /**
     * Start the encoder session.
     * @param {Object} options
     * @param {number} options.width
     * @param {number} options.height
     * @param {number} options.fps
     * @param {number} [options.bitrate]
     */
    async start(options) {
        this.options = options;
        this.frameCount = 0;
    }

    /**
     * Add a frame to the video encoder.
     * @param {HTMLCanvasElement | CanvasImageSource} canvas
     * @param {number} timestampMs - Frame timestamp in milliseconds
     */
    async addFrame(canvas, timestampMs) {
        throw new Error('addFrame() must be implemented by subclass');
    }

    /**
     * Finalize encoding and return the video Blob.
     * @returns {Promise<Blob>}
     */
    async finish() {
        throw new Error('finish() must be implemented by subclass');
    }

    /**
     * Cancel and cleanup encoding session.
     */
    cancel() {
        this.frameCount = 0;
    }
}
