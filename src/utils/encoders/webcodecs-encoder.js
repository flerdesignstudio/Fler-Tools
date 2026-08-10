import { VideoEncoderBase } from './video-encoder-base.js';
import { Muxer, ArrayBufferTarget } from 'webm-muxer';

export class WebCodecsEncoder extends VideoEncoderBase {
    static isSupported() {
        return typeof window !== 'undefined' &&
            typeof window.VideoEncoder === 'function' &&
            typeof window.VideoFrame === 'function';
    }

    constructor() {
        super();
        this.encoder = null;
        this.muxer = null;
        this.keyFrameInterval = 60;
        this.errorEncountered = null;
    }

    async start(options) {
        await super.start(options);
        this.keyFrameInterval = (options.fps || 30) * 2;
        this.errorEncountered = null;

        const pixels = options.width * options.height;
        const defaultBitrate = Math.min(pixels * options.fps * 0.15, 200_000_000);
        const bitrate = options.bitrate || defaultBitrate;

        // Initialize WebM Muxer
        this.muxer = new Muxer({
            target: new ArrayBufferTarget(),
            video: {
                codec: 'V_VP9',
                width: options.width,
                height: options.height
            },
            firstTimestampBehavior: 'offset'
        });

        // Initialize WebCodecs VideoEncoder
        this.encoder = new VideoEncoder({
            output: (chunk, meta) => {
                if (this.muxer) {
                    this.muxer.addVideoChunk(chunk, meta);
                }
            },
            error: (err) => {
                console.error('WebCodecs VideoEncoder error:', err);
                this.errorEncountered = err;
            }
        });

        // Test VP9 config, fallback to VP8
        let config = {
            codec: 'vp09.00.10.08',
            width: options.width,
            height: options.height,
            bitrate: bitrate,
            framerate: options.fps || 30
        };

        const support = await VideoEncoder.isConfigSupported(config);
        if (!support.supported) {
            config.codec = 'vp8';
            this.muxer = new Muxer({
                target: new ArrayBufferTarget(),
                video: {
                    codec: 'V_VP8',
                    width: options.width,
                    height: options.height
                },
                firstTimestampBehavior: 'offset'
            });
        }

        this.encoder.configure(config);
    }

    async addFrame(sourceCanvas, timestampMs) {
        if (!this.encoder || this.errorEncountered) {
            throw this.errorEncountered || new Error('Encoder not initialized');
        }

        // Handle backpressure if encoder queue is backing up
        if (this.encoder.encodeQueueSize > 5) {
            await new Promise(resolve => setTimeout(resolve, 20));
        }

        const timestampUs = Math.round(timestampMs * 1000);
        const frame = new VideoFrame(sourceCanvas, { timestamp: timestampUs });
        const isKeyFrame = this.frameCount % this.keyFrameInterval === 0;

        this.encoder.encode(frame, { keyFrame: isKeyFrame });
        frame.close();

        this.frameCount++;
    }

    async finish() {
        if (!this.encoder) {
            throw new Error('Encoder not initialized');
        }

        if (this.errorEncountered) {
            throw this.errorEncountered;
        }

        await this.encoder.flush();
        this.encoder.close();
        this.encoder = null;

        this.muxer.finalize();
        const buffer = this.muxer.target.buffer;
        this.muxer = null;

        return new Blob([buffer], { type: 'video/webm' });
    }

    cancel() {
        super.cancel();
        if (this.encoder) {
            try {
                this.encoder.close();
            } catch (_) {}
            this.encoder = null;
        }
        this.muxer = null;
    }
}
