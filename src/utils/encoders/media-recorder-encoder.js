import { VideoEncoderBase } from './video-encoder-base.js';

export class MediaRecorderEncoder extends VideoEncoderBase {
    constructor() {
        super();
        this.mediaRecorder = null;
        this.chunks = [];
        this.recordCanvas = null;
        this.recordCtx = null;
        this.streamTrack = null;
        this.isStarted = false;
    }

    async start(options) {
        await super.start(options);
        this.chunks = [];

        this.recordCanvas = document.createElement('canvas');
        this.recordCanvas.width = options.width;
        this.recordCanvas.height = options.height;
        this.recordCtx = this.recordCanvas.getContext('2d');

        const stream = this.recordCanvas.captureStream(0); // Manual frame requesting
        this.streamTrack = stream.getVideoTracks()[0];

        const pixels = options.width * options.height;
        const defaultBitrate = Math.min(pixels * options.fps * 0.15, 150_000_000);
        const bitrate = options.bitrate || defaultBitrate;

        let mimeType = 'video/webm;codecs=vp9';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = 'video/webm;codecs=vp8';
            if (!MediaRecorder.isTypeSupported(mimeType)) {
                mimeType = 'video/webm';
                if (!MediaRecorder.isTypeSupported(mimeType)) {
                    mimeType = '';
                }
            }
        }

        const recorderOptions = { videoBitsPerSecond: bitrate };
        if (mimeType) recorderOptions.mimeType = mimeType;

        this.mediaRecorder = new MediaRecorder(stream, recorderOptions);

        this.mediaRecorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) {
                this.chunks.push(e.data);
            }
        };

        this.mediaRecorder.start();
        this.isStarted = true;
    }

    async addFrame(sourceCanvas, timestampMs) {
        if (!this.isStarted || !this.recordCtx) return;

        this.recordCtx.clearRect(0, 0, this.recordCanvas.width, this.recordCanvas.height);
        this.recordCtx.drawImage(sourceCanvas, 0, 0, this.recordCanvas.width, this.recordCanvas.height);

        if (this.streamTrack && typeof this.streamTrack.requestFrame === 'function') {
            this.streamTrack.requestFrame();
        }

        // Short pause to allow MediaRecorder time to pull the frame from the stream track
        const frameInterval = 1000 / (this.options.fps || 30);
        await new Promise(resolve => setTimeout(resolve, Math.max(16, frameInterval / 2)));
        this.frameCount++;
    }

    async finish() {
        if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
            return new Blob(this.chunks, { type: 'video/webm' });
        }

        return new Promise((resolve) => {
            this.mediaRecorder.onstop = () => {
                this.isStarted = false;
                const mimeType = this.mediaRecorder.mimeType || 'video/webm';
                const blob = new Blob(this.chunks, { type: mimeType });
                resolve(blob);
            };
            this.mediaRecorder.stop();
        });
    }

    cancel() {
        super.cancel();
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.onstop = null;
            this.mediaRecorder.stop();
        }
        this.isStarted = false;
        this.chunks = [];
    }
}
