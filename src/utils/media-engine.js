import { OfflineRenderer } from './offline-renderer.js';

export class MediaEngine {
    constructor() {
        this.activeVisualizer = null;
        this.offlineRenderer = new OfflineRenderer();
        
        this.isPlaying = true;
        this.isRecording = false;
        this.isLooping = true;
        this.speed = 1.0;
        this.fps = 30; // Better default for generative
        this.viewportQuality = 'High';
        
        this.chunks = [];
        this.mediaRecorder = null;
        this.recordTimer = null;
        this.recordStartTime = 0;
        this.lastRecordingDuration = 0;
        this.recordedResolution = null;
        
        // HQ export state
        this._hqExportActive = false;
        this._hqRecorder = null;
        this._hqProgressInterval = null;
        this._hqPrevQuality = null;
        
        this.bindUI();
    }

    bindUI() {
        this.ui = {
            playPauseBtn: document.getElementById('playPauseBtn'),
            replayBtn: document.getElementById('replayBtn'),
            loopBtn: document.getElementById('loopBtn'),
            recordBtn: document.getElementById('recordBtn'),
            clearRecordBtn: document.getElementById('clearRecordBtn'),
            fpsBtn: document.getElementById('fpsBtn'),
            speedBtn: document.getElementById('speedBtn'),
            viewportBtn: document.getElementById('viewportBtn'),
            timerText: document.querySelector('.timer-text'),
            recordBtnIcon: document.querySelector('#recordBtn .material-symbols-outlined'),
            exportWebmBtn: document.getElementById('exportWebmBtn'),
            exportVidModal: document.getElementById('exportVidModal'),
            closeExportVidModalBtn: document.getElementById('closeExportVidModalBtn'),
            cancelExportVidBtn: document.getElementById('cancelExportVidBtn'),
            confirmExportVidBtn: document.getElementById('confirmExportVidBtn'),
            exportVidQuality: document.getElementById('exportVidQuality'),
            exportVidProgressContainer: document.getElementById('exportVidProgressContainer'),
            exportVidProgressBar: document.getElementById('exportVidProgressBar'),
            exportVidProgressPercent: document.getElementById('exportVidProgressPercent'),
            exportVidProgressText: document.getElementById('exportVidProgressText'),
            exportVidResolutionInfo: document.getElementById('exportVidResolutionInfo'),
            exportVidUnsupportedWarning: document.getElementById('exportVidUnsupportedWarning')
        };

        if (this.ui.playPauseBtn) {
            this.ui.playPauseBtn.onclick = () => this.togglePlay();
        }
        if (this.ui.replayBtn) {
            this.ui.replayBtn.onclick = () => this.replay();
        }
        if (this.ui.loopBtn) {
            this.ui.loopBtn.onclick = () => this.toggleLoop();
        }
        if (this.ui.recordBtn) {
            this.ui.recordBtn.onclick = () => this.toggleRecording();
        }
        if (this.ui.clearRecordBtn) {
            this.ui.clearRecordBtn.onclick = () => this.clearRecording();
        }
        if (this.ui.fpsBtn) {
            this.ui.fpsBtn.onclick = () => this.cycleFPS();
        }
        if (this.ui.speedBtn) {
            this.ui.speedBtn.onclick = () => this.cycleSpeed();
        }
        if (this.ui.viewportBtn) {
            this.ui.viewportBtn.onclick = () => this.cycleViewport();
        }
        if (this.ui.exportWebmBtn) {
            this.ui.exportWebmBtn.onclick = () => this.showExportModal();
        }
        if (this.ui.closeExportVidModalBtn) {
            this.ui.closeExportVidModalBtn.onclick = () => this.hideExportModal();
        }
        if (this.ui.cancelExportVidBtn) {
            this.ui.cancelExportVidBtn.onclick = () => this.hideExportModal();
        }
        if (this.ui.confirmExportVidBtn) {
            this.ui.confirmExportVidBtn.onclick = () => this.handleExportConfirm();
        }
        if (this.ui.exportVidQuality) {
            this.ui.exportVidQuality.addEventListener('change', () => this._updateExportModalInfo());
        }
        
        this.updateUI();
    }

    attachVisualizer(visualizer) {
        if (this.isRecording) {
            this.stopRecording();
        }
        
        this.activeVisualizer = visualizer;
        // Sync visualizer to current engine state if methods exist
        if (this.activeVisualizer) {
            if (typeof this.activeVisualizer.setSpeed === 'function') {
                this.activeVisualizer.setSpeed(this.speed);
            }
            if (typeof this.activeVisualizer.setLoop === 'function') {
                this.activeVisualizer.setLoop(this.isLooping);
            }
            // For generative tools, they have their own play state
            if (this.isPlaying) {
                if (typeof this.activeVisualizer.play === 'function') this.activeVisualizer.play();
            } else {
                if (typeof this.activeVisualizer.pause === 'function') this.activeVisualizer.pause();
            }
        }
    }

    detachVisualizer() {
        if (this.isRecording) {
            this.stopRecording();
        }
        if (this.offlineRenderer && this.offlineRenderer.isRendering) {
            this.offlineRenderer.cancel();
        }
        this.hideExportModal();
        this.clearRecording();
        this.activeVisualizer = null;
    }

    destroy() {
        this.detachVisualizer();
        if (this.recordTimer) {
            clearInterval(this.recordTimer);
            this.recordTimer = null;
        }
    }

    togglePlay() {
        this.isPlaying = !this.isPlaying;
        if (this.activeVisualizer) {
            // Some visualizers implement play/pause explicitly
            if (this.isPlaying && typeof this.activeVisualizer.play === 'function') {
                this.activeVisualizer.play();
            } else if (!this.isPlaying && typeof this.activeVisualizer.pause === 'function') {
                this.activeVisualizer.pause();
            } else if (typeof this.activeVisualizer.togglePlay === 'function') {
                // Fallback for Chladni/Hydrogen that use togglePlay
                this.activeVisualizer.isPlaying = this.isPlaying;
                if (this.isPlaying) {
                    this.activeVisualizer.animate();
                }
            }
        }
        this.updateUI();
    }

    replay() {
        if (this.activeVisualizer) {
            if (typeof this.activeVisualizer.restart === 'function') {
                this.activeVisualizer.restart();
            } else if (typeof this.activeVisualizer.initParticles === 'function') {
                this.activeVisualizer.initParticles(); // Chladni/Hydrogen
            }
        }
    }

    toggleLoop() {
        this.isLooping = !this.isLooping;
        if (this.activeVisualizer && typeof this.activeVisualizer.setLoop === 'function') {
            this.activeVisualizer.setLoop(this.isLooping);
        }
        this.updateUI();
    }

    cycleFPS() {
        const fpsLevels = [12, 24, 30, 60];
        const idx = fpsLevels.findIndex(v => v === this.fps);
        this.fps = fpsLevels[(idx + 1) % fpsLevels.length];
        this.updateUI();
    }

    cycleSpeed() {
        const speeds = [0.25, 0.5, 1.0, 1.5, 2.0];
        const idx = speeds.findIndex(s => Math.abs(s - this.speed) < 0.001);
        this.speed = speeds[(idx + 1) % speeds.length];
        if (this.activeVisualizer && typeof this.activeVisualizer.setSpeed === 'function') {
            this.activeVisualizer.setSpeed(this.speed);
        }
        this.updateUI();
    }

    cycleViewport() {
        const qualities = ['Low', 'Med', 'High'];
        const idx = qualities.indexOf(this.viewportQuality);
        this.viewportQuality = qualities[(idx + 1) % qualities.length];
        
        // Notify visualizer to downscale/upscale drawing operations if it supports it
        if (this.activeVisualizer && typeof this.activeVisualizer.setQuality === 'function') {
            this.activeVisualizer.setQuality(this.viewportQuality);
        }
        this.updateUI();
    }

    toggleRecording() {
        if (this.isRecording) {
            this.stopRecording();
        } else {
            this.startRecording();
        }
    }

    startRecording() {
        if (!this.activeVisualizer || !this.activeVisualizer.canvas) {
            alert("No active canvas to record.");
            return;
        }

        if (this.ui.exportWebmBtn) {
            this.ui.exportWebmBtn.disabled = true;
            this.ui.exportWebmBtn.title = "Record a video first to export";
        }
        
        if (this.ui.clearRecordBtn) {
            this.ui.clearRecordBtn.style.opacity = '0.25';
            this.ui.clearRecordBtn.style.pointerEvents = 'none';
        }

        const canvas = this.activeVisualizer.canvas;
        
        // Fix #6: Store resolution at recording time so the modal can display it
        this.recordedResolution = { w: canvas.width, h: canvas.height };
        
        let stream;
        try {
            stream = canvas.captureStream(this.fps);
        } catch (err) {
            alert("Capture stream not supported on this browser.");
            return;
        }

        // High bitrate for sharp pixel-art content.
        // Pixel art needs ~50 bits/pixel to avoid smearing edges.
        const pixels = canvas.width * canvas.height;
        const bitsPerSecond = Math.min(pixels * 50, 120_000_000); // Cap at 120 Mbps
        
        const mimeType = this._negotiateMimeType();
        const options = { mimeType, videoBitsPerSecond: bitsPerSecond };

        this.chunks = [];
        this.mediaRecorder = new MediaRecorder(stream, options);

        this.mediaRecorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) {
                this.chunks.push(e.data);
            }
        };

        this.mediaRecorder.onstop = () => {
            // Enable the export button instead of auto-downloading
            if (this.ui.exportWebmBtn) {
                this.ui.exportWebmBtn.disabled = false;
                this.ui.exportWebmBtn.title = "Download recorded WebM video";
            }
        };

        this.mediaRecorder.start();
        this.isRecording = true;
        this.recordStartTime = Date.now();
        if (this.ui.recordBtn) {
            this.ui.recordBtn.classList.add('active');
        }
        
        if (this.ui.recordBtnIcon) {
            this.ui.recordBtnIcon.textContent = 'square';
        }

        this.recordTimer = setInterval(() => this.updateTimer(), 1000);
        this.updateTimer();
    }

    stopRecording() {
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
        }
        this.lastRecordingDuration = Date.now() - this.recordStartTime;
        this.isRecording = false;
        clearInterval(this.recordTimer);
        this.recordTimer = null;
        if (this.ui.recordBtn) {
            this.ui.recordBtn.classList.remove('active');
        }
        
        if (this.ui.recordBtnIcon) {
            this.ui.recordBtnIcon.textContent = 'lens';
        }
        
        if (this.ui.clearRecordBtn) {
            this.ui.clearRecordBtn.style.opacity = '1';
            this.ui.clearRecordBtn.style.pointerEvents = 'auto';
        }
        
        // We do NOT clear the timer text here, so the user can see how long the recording was
    }

    clearRecording() {
        this.chunks = [];
        this.recordedResolution = null;
        this.lastRecordingDuration = 0;
        
        if (this.ui.exportWebmBtn) {
            this.ui.exportWebmBtn.disabled = true;
            this.ui.exportWebmBtn.title = "Record a video first to export";
        }
        
        if (this.ui.clearRecordBtn) {
            this.ui.clearRecordBtn.style.opacity = '0.25';
            this.ui.clearRecordBtn.style.pointerEvents = 'none';
        }
        
        if (this.ui.timerText) {
            this.ui.timerText.textContent = '--:--';
        }
    }

    updateTimer() {
        if (!this.isRecording || !this.ui.timerText) return;
        const elapsed = Math.floor((Date.now() - this.recordStartTime) / 1000);
        const m = Math.floor(elapsed / 60).toString().padStart(2, '0');
        const s = (elapsed % 60).toString().padStart(2, '0');
        this.ui.timerText.textContent = `${m}:${s}`;
    }

    /**
     * Fix #3: Check if the active visualizer supports HQ re-rendering.
     * Visualizers that use qualityMultiplier in their resize() method support it.
     * Tools like Cells, ASCII, Dither, Matrix, Thermal do NOT.
     */
    _supportsHQExport() {
        if (!this.activeVisualizer) return false;
        // Must have qualityMultiplier as a defined property (not just settable)
        // AND a resize method that uses it
        return (
            'qualityMultiplier' in this.activeVisualizer &&
            typeof this.activeVisualizer.resize === 'function' &&
            typeof this.activeVisualizer.setQuality === 'function'
        );
    }

    /**
     * Fix #1: Compute the correct multiplier to reach a real target resolution.
     * "2K" → longest edge = 2560px, "4K" → longest edge = 3840px.
     */
    _computeHQMultiplier(quality) {
        const currentQM = this.activeVisualizer.qualityMultiplier || 1.0;
        const baseW = this.activeVisualizer.canvas.width / currentQM;
        const baseH = this.activeVisualizer.canvas.height / currentQM;
        const longestBase = Math.max(baseW, baseH);
        
        const targetLongest = quality === '4K' ? 3840 : 2560;
        return targetLongest / longestBase;
    }

    /**
     * Compute what the output resolution would be for a given quality selection.
     */
    _getTargetResolution(quality) {
        if (quality === 'Original') {
            return this.recordedResolution || { w: '?', h: '?' };
        }
        
        let baseW = 1, baseH = 1;
        if (this.recordedResolution) {
            baseW = this.recordedResolution.w;
            baseH = this.recordedResolution.h;
        } else if (this.activeVisualizer && this.activeVisualizer.canvas) {
            baseW = this.activeVisualizer.canvas.width;
            baseH = this.activeVisualizer.canvas.height;
        } else {
            return { w: '?', h: '?' };
        }
        
        const longestBase = Math.max(baseW, baseH);
        const targetLongest = quality === '4K' ? 3840 : 2560;
        const multiplier = targetLongest / longestBase;
        
        return {
            w: Math.round(baseW * multiplier),
            h: Math.round(baseH * multiplier)
        };
    }

    showExportModal() {
        if (this.ui.exportVidModal) {
            this.ui.exportVidModal.classList.add('active');
            this.resetExportModalUI();
            this._updateExportModalInfo();
        }
    }

    /**
     * Fix #2: hideExportModal now aborts any active HQ export,
     * restoring the visualizer and cleaning up intervals/recorders.
     */
    hideExportModal() {
        if (this.offlineRenderer && this.offlineRenderer.isRendering) {
            this.offlineRenderer.cancel();
        }

        // Abort active HQ export if running
        if (this._hqExportActive) {
            if (this._hqProgressInterval) {
                clearInterval(this._hqProgressInterval);
                this._hqProgressInterval = null;
            }
            if (this._hqRecorder && this._hqRecorder.state !== 'inactive') {
                this._hqRecorder.onstop = null;
                this._hqRecorder.stop();
            }
            if (this.activeVisualizer && this._hqPrevQuality !== null) {
                this.activeVisualizer.qualityMultiplier = this._hqPrevQuality;
                if (typeof this.activeVisualizer.resize === 'function') {
                    this.activeVisualizer.resize();
                }
            }
            if (this._hqUpscaleRafId) {
                cancelAnimationFrame(this._hqUpscaleRafId);
                this._hqUpscaleRafId = null;
            }
            if (this._hqUpscaleCanvas) {
                if (this._hqUpscaleCanvas.parentNode) {
                    this._hqUpscaleCanvas.parentNode.removeChild(this._hqUpscaleCanvas);
                }
                this._hqUpscaleCanvas = null;
                this._hqUpscaleCtx = null;
            }
            if (this._hqVideoUrl) {
                URL.revokeObjectURL(this._hqVideoUrl);
                this._hqVideoUrl = null;
            }
            if (this._hqVideoElement) {
                this._hqVideoElement.pause();
                this._hqVideoElement.removeAttribute('src');
                this._hqVideoElement.load();
                this._hqVideoElement = null;
            }
            this._hqExportActive = false;
            this._hqRecorder = null;
            this._hqPrevQuality = null;
        }

        if (this.ui.exportVidModal) {
            this.ui.exportVidModal.classList.remove('active');
        }
    }

    resetExportModalUI() {
        if (this.ui.exportVidProgressContainer) {
            this.ui.exportVidProgressContainer.style.display = 'none';
        }
        if (this.ui.confirmExportVidBtn) {
            this.ui.confirmExportVidBtn.disabled = false;
        }
        if (this.ui.cancelExportVidBtn) {
            this.ui.cancelExportVidBtn.disabled = false;
        }
        if (this.ui.exportVidQuality) {
            this.ui.exportVidQuality.disabled = false;
        }
        if (this.ui.exportVidProgressBar) {
            this.ui.exportVidProgressBar.style.width = '0%';
        }
        if (this.ui.exportVidProgressPercent) {
            this.ui.exportVidProgressPercent.textContent = '0%';
        }
        if (this.ui.exportVidProgressText) {
            this.ui.exportVidProgressText.textContent = 'Rendering...';
        }
    }

    _updateExportModalInfo() {
        const quality = this.ui.exportVidQuality ? this.ui.exportVidQuality.value : 'Original';
        const res = this._getTargetResolution(quality);

        if (this.ui.exportVidResolutionInfo) {
            this.ui.exportVidResolutionInfo.textContent = `Output: ${res.w} × ${res.h}px`;
        }

        if (this.ui.exportVidUnsupportedWarning) {
            this.ui.exportVidUnsupportedWarning.style.display = 'none';
        }

        if (this.ui.confirmExportVidBtn && !this._hqExportActive) {
            this.ui.confirmExportVidBtn.disabled = false;
        }
    }

    async handleExportConfirm() {
        const quality = this.ui.exportVidQuality ? this.ui.exportVidQuality.value : 'Original';
        
        if (quality === 'Original' && this.chunks && this.chunks.length > 0) {
            this.exportWebm();
            this.hideExportModal();
            return;
        }

        if (!this.activeVisualizer || !this.activeVisualizer.canvas) {
            alert("No active canvas to render.");
            return;
        }

        const durationMs = this.lastRecordingDuration || 5000;
        const res = this._getTargetResolution(quality);

        // Modal processing UI
        if (this.ui.confirmExportVidBtn) this.ui.confirmExportVidBtn.disabled = true;
        if (this.ui.exportVidQuality) this.ui.exportVidQuality.disabled = true;
        if (this.ui.exportVidProgressContainer) this.ui.exportVidProgressContainer.style.display = 'flex';
        
        this._hqExportActive = true;

        if (typeof this.activeVisualizer.renderFrame === 'function') {
            try {
                const blob = await this.offlineRenderer.render({
                    visualizer: this.activeVisualizer,
                    width: res.w,
                    height: res.h,
                    fps: this.fps,
                    durationMs: durationMs,
                    onProgress: ({ percent, remainingSec }) => {
                        if (this.ui.exportVidProgressBar) {
                            this.ui.exportVidProgressBar.style.width = `${percent}%`;
                        }
                        if (this.ui.exportVidProgressPercent) {
                            this.ui.exportVidProgressPercent.textContent = `${Math.round(percent)}%`;
                        }
                        if (this.ui.exportVidProgressText) {
                            this.ui.exportVidProgressText.textContent = 
                                remainingSec > 0 ? `Rendering... ${remainingSec}s remaining` : 'Finalizing...';
                        }
                    }
                });

                if (blob) {
                    this._downloadBlob(blob, `FlerTools_Export_${quality}_${Date.now()}.webm`);
                }
            } catch (err) {
                if (err.message !== 'Export cancelled') {
                    console.error('Offline export failed:', err);
                    alert('Export failed.');
                }
            } finally {
                this.hideExportModal();
            }
            return;
        }

        const supportsNativeHQ = this._supportsHQExport();

        // Start playback and restart the animation/video so the HQ export captures movement
        if (!this.isPlaying) {
            this.togglePlay();
        }
        this.replay();
        
        const canvas = this.activeVisualizer.canvas;
        let stream;

        if (supportsNativeHQ) {
            // NATIVE HQ SCALING (e.g. Oscilloscope)
            const multiplier = this._computeHQMultiplier(quality);
            this._hqPrevQuality = this.activeVisualizer.qualityMultiplier || 1.0;
            this.activeVisualizer.qualityMultiplier = multiplier;
            if (typeof this.activeVisualizer.resize === 'function') {
                this.activeVisualizer.resize();
            }
            try {
                stream = canvas.captureStream(this.fps);
            } catch (err) {
                alert("Capture stream not supported on this browser.");
                this.hideExportModal();
                return;
            }

            this._startHQRecorder(stream, quality, durationMs, true);
        } else {
            // WEBM PLAYBACK UPSCALE (e.g. Dither, ASCII)
            if (!this.chunks || this.chunks.length === 0) {
                alert("No recording found to upscale. Please record a video before exporting in HQ.");
                this.hideExportModal();
                return;
            }

            const blob = new Blob(this.chunks, { type: 'video/webm' });
            this._hqVideoUrl = URL.createObjectURL(blob);
            this._hqVideoElement = document.createElement('video');
            this._hqVideoElement.muted = true;
            this._hqVideoElement.playsInline = true;

            this._hqUpscaleCanvas = document.createElement('canvas');
            this._hqUpscaleCanvas.width = res.w;
            this._hqUpscaleCanvas.height = res.h;
            
            this._hqUpscaleCanvas.style.position = 'fixed';
            this._hqUpscaleCanvas.style.left = '-99999px';
            this._hqUpscaleCanvas.style.top = '-99999px';
            this._hqUpscaleCanvas.style.pointerEvents = 'none';
            document.body.appendChild(this._hqUpscaleCanvas);

            this._hqUpscaleCtx = this._hqUpscaleCanvas.getContext('2d');
            this._hqUpscaleCtx.imageSmoothingEnabled = false; 

            try {
                stream = this._hqUpscaleCanvas.captureStream();
            } catch (err) {
                alert("Capture stream not supported on this browser.");
                this.hideExportModal();
                return;
            }

            this._hqVideoElement.onloadeddata = () => {
                const vidDuration = this._hqVideoElement.duration ? this._hqVideoElement.duration * 1000 : duration;
                this._hqVideoElement.play();
                
                const upscaleW = res.w;
                const upscaleH = res.h;
                
                const loopUpscale = () => {
                    if (!this._hqExportActive || !this._hqUpscaleCtx) return;
                    this._hqUpscaleCtx.clearRect(0, 0, upscaleW, upscaleH);
                    this._hqUpscaleCtx.drawImage(this._hqVideoElement, 0, 0, upscaleW, upscaleH);
                    this._hqUpscaleRafId = requestAnimationFrame(loopUpscale);
                };
                loopUpscale();

                this._startHQRecorder(stream, quality, vidDuration, false);
            };

            this._hqVideoElement.src = this._hqVideoUrl;
        }
    }

    _startHQRecorder(stream, quality, duration, isNative) {
        const res = this._getTargetResolution(quality);
        const pixels = res.w * res.h;
        // Very high bitrate for HQ export — pixel art needs sharp edges
        const bitsPerSecond = Math.min(pixels * 50, 200_000_000); // Cap at 200 Mbps for 4K

        const mimeType = this._negotiateMimeType();
        const options = { mimeType, videoBitsPerSecond: bitsPerSecond };

        const highResChunks = [];
        const highResRecorder = new MediaRecorder(stream, options);
        this._hqRecorder = highResRecorder;

        highResRecorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) {
                highResChunks.push(e.data);
            }
        };

        highResRecorder.onstop = () => {
            this._hqExportActive = false;
            this._hqRecorder = null;

            if (this._hqUpscaleRafId) {
                cancelAnimationFrame(this._hqUpscaleRafId);
            }
            if (this._hqUpscaleCanvas) {
                if (this._hqUpscaleCanvas.parentNode) {
                    this._hqUpscaleCanvas.parentNode.removeChild(this._hqUpscaleCanvas);
                }
                this._hqUpscaleCanvas = null;
                this._hqUpscaleCtx = null;
            }
            if (this._hqVideoUrl) {
                URL.revokeObjectURL(this._hqVideoUrl);
                this._hqVideoUrl = null;
            }
            if (this._hqVideoElement) {
                this._hqVideoElement.pause();
                this._hqVideoElement.removeAttribute('src');
                this._hqVideoElement.load();
                this._hqVideoElement = null;
            }

            if (isNative && this._hqPrevQuality !== null && this.activeVisualizer) {
                this.activeVisualizer.qualityMultiplier = this._hqPrevQuality;
                if (typeof this.activeVisualizer.resize === 'function') {
                    this.activeVisualizer.resize();
                }
                this._hqPrevQuality = null;
            }

            const blob = new Blob(highResChunks, { type: 'video/webm' });
            this._downloadBlob(blob, `FlerTools_Export_${quality}_${Date.now()}.webm`);
            this.hideExportModal();
        };

        if (!isNative && this._hqVideoElement) {
            this._hqVideoElement.onended = () => {
                if (this._hqRecorder && this._hqRecorder.state !== 'inactive') {
                    this._hqRecorder.stop();
                }
            };
        }

        highResRecorder.start();
        const startTime = Date.now();

        this._hqProgressInterval = setInterval(() => {
            // For WebM upscaler, duration might be Infinity at first, so use video duration
            const currentDuration = (!isNative && this._hqVideoElement && this._hqVideoElement.duration) 
                ? (this._hqVideoElement.duration * 1000) 
                : duration;
                
            const elapsed = Date.now() - startTime;
            let percent = Math.min((elapsed / currentDuration) * 100, 100);
            
            if (this.ui.exportVidProgressBar) {
                this.ui.exportVidProgressBar.style.width = `${percent}%`;
            }
            if (this.ui.exportVidProgressPercent) {
                this.ui.exportVidProgressPercent.textContent = `${Math.round(percent)}%`;
            }
            if (this.ui.exportVidProgressText) {
                const secsLeft = Math.max(0, Math.ceil((currentDuration - elapsed) / 1000));
                this.ui.exportVidProgressText.textContent = 
                    secsLeft > 0 ? `Rendering... ${secsLeft}s remaining` : 'Finalizing...';
            }

            if (isNative && elapsed >= currentDuration) {
                clearInterval(this._hqProgressInterval);
                this._hqProgressInterval = null;
                highResRecorder.stop();
            }
        }, 100);
    }

    exportWebm() {
        const blob = new Blob(this.chunks, { type: 'video/webm' });
        this._downloadBlob(blob, `FlerTools_Export_${Date.now()}.webm`);
    }

    _negotiateMimeType() {
        const candidates = [
            'video/webm;codecs=vp9',
            'video/webm;codecs=vp8',
            'video/webm'
        ];
        return candidates.find(m => MediaRecorder.isTypeSupported(m)) || '';
    }

    _downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            URL.revokeObjectURL(url);
            if (a.parentNode) a.parentNode.removeChild(a);
        }, 60000);
    }

    updateUI() {
        if (this.ui.playPauseBtn) {
            const icon = this.ui.playPauseBtn.querySelector('.material-symbols-outlined');
            if (icon) icon.textContent = this.isPlaying ? 'pause' : 'play_arrow';
        }
        if (this.ui.loopBtn) {
            this.ui.loopBtn.style.opacity = this.isLooping ? '1' : '0.4';
        }
        if (this.ui.fpsBtn) {
            this.ui.fpsBtn.textContent = this.fps;
        }
        if (this.ui.speedBtn) {
            this.ui.speedBtn.textContent = `${this.speed}x`;
        }
        if (this.ui.viewportBtn) {
            this.ui.viewportBtn.textContent = this.viewportQuality;
        }
    }
}

export const mediaEngine = new MediaEngine();
