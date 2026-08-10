import { AsciiVisualizer } from './ascii-visualizer.js';
import { animate, stagger } from 'motion';
import { createPanZoom, addListenerTracked } from '../../utils/pan-zoom.js';
import { bindDropZone } from '../../utils/drop-zone.js';
import asciiIcon from '../../Assets/ascii.svg?raw';

export default {
    id: 'ascii',
    label: 'ASCII',
    icon: asciiIcon,

    _visualizer: null,
    _listeners: [],       // { el, eventName, handler } — element-bound listeners, cleaned up in destroy()

    // View-only state (pan/zoom/rotation). Never touches pixels, so it lives here, not in the visualizer.
    _view: { isDragging: false, startX: 0, startY: 0, panX: 0, panY: 0, zoom: 1 },
    _resetView: null,

    getSidebarHTML() {
        return `
            <section class="control-group">
                <h2 class="group-title">Source</h2>
                <div class="segmented-switch" id="asciiSourceType" style="margin-bottom: 12px;">
                    <input type="radio" id="asciiSrcFile" name="asciiSrc" value="file" checked>
                    <label for="asciiSrcFile">File</label>
                    <input type="radio" id="asciiSrcWebcam" name="asciiSrc" value="webcam">
                    <label for="asciiSrcWebcam">Webcam</label>
                </div>

                <div class="setting-row" id="asciiDropZoneContainer">
                    <div id="asciiDropZone" class="tool-drop-zone">
                        <span class="material-symbols-outlined">upload_file</span>
                        <p>Drag & drop image/video<br>or click to browse</p>
                        <input type="file" id="asciiMediaUpload" accept="image/*,video/*" class="tool-file-input">
                    </div>
                </div>

                <div class="setting-row" id="asciiWebcamContainer" style="display: none;">
                    <button class="notion-btn notion-btn-primary" id="asciiStartWebcamBtn" style="width: 100%;">
                        <span class="material-symbols-outlined" style="font-size: 18px; margin-right: 6px;">videocam</span>
                        Start Webcam
                    </button>
                    <p style="font-size: 12px; color: var(--text-secondary); text-align: center; margin-top: 8px;">
                        Allows live ASCII processing from your camera.
                    </p>
                </div>

                <div class="setting-row">
                    <label>Aspect Ratio</label>
                    <select id="asciiAspectRatio" class="notion-select">
                        <option value="original">Original Aspect Ratio</option>
                        <option value="square">1:1 (Square)</option>
                    </select>
                </div>
            </section>
            <hr class="separator" />
            <section class="control-group">
                <h2 class="group-title">Settings & Pattern</h2>
                <div class="slider-row">
                    <div class="slider-header">
                        <label for="asciiResolution">Grid Resolution</label>
                        <span id="asciiResVal" aria-live="polite">80</span>
                    </div>
                    <input type="range" id="asciiResolution" min="20" max="180" step="1" value="80" class="notion-slider">
                    <span class="status-msg">Horizontal characters count</span>
                </div>
                <div class="setting-row">
                    <label>Canvas Resolution</label>
                    <select id="asciiCanvasRes" class="notion-select">
                        <option value="800">Standard (800px)</option>
                        <option value="1280">HD (1280px / 720p)</option>
                        <option value="1920">Full HD (1920px / 1080p)</option>
                        <option value="1080">Square HD (1080x1080)</option>
                        <option value="2560">2K QHD (2560px / 1440p)</option>
                    </select>
                </div>
                <div class="setting-row">
                    <label>Character Set</label>
                    <select id="asciiCharset" class="notion-select">
                        <option value="alphanumeric">Letters & Numbers</option>
                        <option value="letters">Letters Only</option>
                        <option value="numbers">Numbers Only</option>
                        <option value="emoji">Custom Emoji</option>
                    </select>
                </div>
                <div class="setting-row" id="asciiEmojiGroup" style="display: none;">
                    <label for="asciiCustomEmoji">Emoji (Dark to Light)</label>
                    <input type="text" id="asciiCustomEmoji" value="🌑🌒🌓🌔🌕🌞" class="notion-input">
                </div>
                <div class="setting-row">
                    <label>Font</label>
                    <select id="asciiFontFamily" class="notion-select">
                        <option value="Space Mono">Space Mono</option>
                        <option value="Roboto Mono">Roboto Mono</option>
                        <option value="Fira Code">Fira Code</option>
                        <option value="VT323">VT323</option>
                        <option value="JetBrains Mono">JetBrains Mono</option>
                        <option value="Inconsolata">Inconsolata</option>
                        <option value="Source Code Pro">Source Code Pro</option>
                        <option value="IBM Plex Mono">IBM Plex Mono</option>
                        <option value="Ubuntu Mono">Ubuntu Mono</option>
                        <option value="Courier Prime">Courier Prime</option>
                    </select>
                </div>
            </section>
            <hr class="separator" />
            <section class="control-group">
                <h2 class="group-title">Colors</h2>
                <div class="color-grid">
                    <div class="color-item">
                        <label for="asciiBgColor">Background</label>
                        <div class="color-wrapper"><input type="color" id="asciiBgColor" value="#0d47a1"></div>
                    </div>
                    <div class="color-item">
                        <label for="asciiTextColor">Text</label>
                        <div class="color-wrapper"><input type="color" id="asciiTextColor" value="#ffffff"></div>
                    </div>
                </div>
            </section>
            <hr class="separator" />
            <section class="control-group">
                <h2 class="group-title">3D View</h2>
                <div class="slider-row">
                    <div class="slider-header">
                        <label for="asciiRotX">Rotation X</label>
                    </div>
                    <input type="range" id="asciiRotX" min="-60" max="60" step="1" value="0" class="notion-slider">
                </div>
                <div class="slider-row">
                    <div class="slider-header">
                        <label for="asciiRotY">Rotation Y</label>
                    </div>
                    <input type="range" id="asciiRotY" min="-60" max="60" step="1" value="0" class="notion-slider">
                </div>
                <button id="asciiResetView" class="notion-btn notion-btn-secondary">Reset Zoom & Pan</button>
            </section>
        `;
    },

    getMainHTML() {
        return `
            <div id="asciiPreview" class="ascii-preview">
                <div id="asciiCanvasWrapper" class="ascii-canvas-wrapper">
                    <canvas id="asciiCanvas" role="img" aria-label="ASCII art render"></canvas>
                </div>
            </div>
        `;
    },

    _injectScopedAssets() {
        if (!document.getElementById('ascii-tool-fonts')) {
            const link = document.createElement('link');
            link.id = 'ascii-tool-fonts';
            link.rel = 'stylesheet';
            link.href = 'https://fonts.googleapis.com/css2?family=Courier+Prime&family=Fira+Code:wght@400&family=IBM+Plex+Mono:wght@400&family=Inconsolata:wght@400&family=JetBrains+Mono:wght@400&family=Roboto+Mono:wght@400&family=Source+Code+Pro:wght@400&family=Space+Mono:wght@400&family=Ubuntu+Mono:wght@400&family=VT323&display=swap';
            document.head.appendChild(link);
        }

        if (!document.getElementById('ascii-tool-styles')) {
            const style = document.createElement('style');
            style.id = 'ascii-tool-styles';
            style.textContent = `
                .ascii-preview {
                    width: 100%;
                    height: 100%;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    overflow: hidden;
                    position: relative;
                    cursor: grab;
                    perspective: 1200px;
                }
                .ascii-preview:active { cursor: grabbing; }
                .ascii-canvas-wrapper { transform-origin: center center; display: inline-block; }
                #asciiCanvas {
                    transition: transform 0.05s linear, width var(--dur-slow) var(--ease-premium), height var(--dur-slow) var(--ease-premium);
                    object-fit: contain;
                }
            `;
            document.head.appendChild(style);
        }
    },

    _addListenerEl(el, eventName, handler) {
        addListenerTracked(el, eventName, handler, this._listeners);
    },

    _addListener(elementId, eventName, handler) {
        addListenerTracked(document.getElementById(elementId), eventName, handler, this._listeners);
    },

    init(sidebarContainer, mainContainer) {
        this._injectScopedAssets();

        sidebarContainer.innerHTML = this.getSidebarHTML();
        mainContainer.innerHTML = this.getMainHTML();

        animate(".control-group", { opacity: [0, 1], x: [-15, 0] }, { delay: stagger(0.08), duration: 0.4, easing: [0.4, 0, 0.2, 1] });
        animate("#asciiPreview", { opacity: [0, 1], scale: [0.97, 1] }, { duration: 0.5, easing: [0.05, 0.7, 0.1, 1] });

        const canvas = document.getElementById('asciiCanvas');
        this._visualizer = new AsciiVisualizer(canvas);

        this._syncUIToVisualizer();

        // Shared pan/zoom
        const { resetView } = createPanZoom({
            containerId: 'asciiPreview',
            wrapperId: 'asciiCanvasWrapper',
            listeners: this._listeners,
            view: this._view,
        });
        this._resetView = resetView;

        // Bind rotation sliders (ASCII-specific add-on)
        this._bindRotation();

        // Shared drop zone
        bindDropZone({
            dropZoneId: 'asciiDropZone',
            fileInputId: 'asciiMediaUpload',
            onFile: (file) => this._visualizer.loadMedia(file),
            listeners: this._listeners,
        });

        this._bindControls();
    },

    _syncUIToVisualizer() {
        const v = this._visualizer;
        if (!v) return;

        const configMap = {
            'asciiResolution': v.config.gridResolution,
            'asciiCanvasRes': v.config.canvasRes,
            'asciiCharset': v.config.charsetKey,
            'asciiCustomEmoji': v.config.customEmoji,
            'asciiFontFamily': v.config.fontFamily,
            'asciiBgColor': v.config.bgColor,
            'asciiTextColor': v.config.textColor
        };

        for (const [id, val] of Object.entries(configMap)) {
            const input = document.getElementById(id);
            if (input) input.value = val;
        }

        const resVal = document.getElementById('asciiResVal');
        if (resVal) resVal.textContent = v.config.gridResolution;

        const emojiGroup = document.getElementById('asciiEmojiGroup');
        if (emojiGroup) {
            emojiGroup.style.display = (v.config.charsetKey === 'emoji') ? 'flex' : 'none';
        }
    },

    _updateRotation() {
        const canvas = document.getElementById('asciiCanvas');
        const rotX = document.getElementById('asciiRotX').value;
        const rotY = document.getElementById('asciiRotY').value;
        canvas.style.transform = `rotateX(${rotX}deg) rotateY(${rotY}deg)`;
    },

    _bindRotation() {
        this._addListener('asciiRotX', 'input', () => this._updateRotation());
        this._addListener('asciiRotY', 'input', () => this._updateRotation());

        this._addListener('asciiResetView', 'click', () => {
            if (this._resetView) this._resetView();
            document.getElementById('asciiRotX').value = 0;
            document.getElementById('asciiRotY').value = 0;
            this._updateRotation();
        });
    },

    _bindControls() {
        const v = this._visualizer;

        const srcTypeRadios = document.querySelectorAll('input[name="asciiSrc"]');
        srcTypeRadios.forEach(radio => {
            this._addListenerEl(radio, 'change', (e) => {
                const dropZoneContainer = document.getElementById('asciiDropZoneContainer');
                const webcamContainer = document.getElementById('asciiWebcamContainer');
                if (e.target.value === 'webcam') {
                    if (dropZoneContainer) dropZoneContainer.style.display = 'none';
                    if (webcamContainer) webcamContainer.style.display = 'block';
                } else {
                    if (dropZoneContainer) dropZoneContainer.style.display = 'block';
                    if (webcamContainer) webcamContainer.style.display = 'none';
                    if (v) v.stopWebcam();
                }
            });
        });

        this._addListener('asciiStartWebcamBtn', 'click', () => {
            if (v) v.startWebcam();
        });

        this._addListener('asciiAspectRatio', 'change', (e) => {
            v.updateConfig({ aspectMode: e.target.value });
        });

        this._addListener('asciiResolution', 'input', (e) => {
            document.getElementById('asciiResVal').textContent = e.target.value;
            v.updateConfig({ gridResolution: parseInt(e.target.value) });
        });

        this._addListener('asciiCharset', 'change', (e) => {
            document.getElementById('asciiEmojiGroup').style.display = (e.target.value === 'emoji') ? 'flex' : 'none';
            v.updateConfig({ charsetKey: e.target.value });
        });

        this._addListener('asciiCustomEmoji', 'input', (e) => {
            v.updateConfig({ customEmoji: e.target.value });
        });

        this._addListener('asciiFontFamily', 'change', (e) => {
            v.updateConfig({ fontFamily: e.target.value });
        });

        this._addListener('asciiBgColor', 'input', (e) => {
            v.updateConfig({ bgColor: e.target.value });
        });

        this._addListener('asciiTextColor', 'input', (e) => {
            v.updateConfig({ textColor: e.target.value });
        });

        this._addListener('asciiCanvasRes', 'change', (e) => {
            v.updateConfig({ canvasRes: parseInt(e.target.value) });
        });
    },

    destroy() {
        if (this._visualizer) {
            this._visualizer.destroy();
            this._visualizer = null;
        }

        this._listeners.forEach(({ el, eventName, handler }) => {
            el.removeEventListener(eventName, handler);
        });
        this._listeners = [];
        this._resetView = null;
        // Reset view state so zoom/pan doesn't persist between sessions
        this._view = { isDragging: false, startX: 0, startY: 0, panX: 0, panY: 0, zoom: 1 };
    }
}
