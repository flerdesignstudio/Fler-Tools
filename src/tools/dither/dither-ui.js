import { DitherVisualizer } from './dither-visualizer.js';
import { animate } from 'motion';

export default {
    id: 'dither',
    label: 'Dithering',
    icon: '▒',

    _visualizer: null,
    _listeners: [],

    // View state for pan/zoom
    _view: { isDragging: false, startX: 0, startY: 0, panX: 0, panY: 0, zoom: 1 },

    getSidebarHTML() {
        return `
            <section class="control-group">
                <h2 class="group-title">Source</h2>
                <div class="setting-row">
                    <label>Upload Image</label>
                    <div id="ditherDropZone" class="tool-drop-zone">
                        <span class="material-symbols-outlined">upload_file</span>
                        <p>Drag & drop image here<br>or click to browse</p>
                        <input type="file" id="ditherMediaUpload" accept="image/*" class="tool-file-input">
                    </div>
                </div>
            </section>
            <hr class="separator" />
            <section class="control-group">
                <h2 class="group-title">Settings</h2>
                
                <div class="setting-row">
                    <label>Algorithm</label>
                    <select id="ditherAlgorithm" class="notion-select">
                        <option value="floyd-steinberg">Floyd-Steinberg (Diffusion)</option>
                        <option value="atkinson">Atkinson (Diffusion)</option>
                        <option value="ordered">Ordered (Bayer 4x4)</option>
                        <option value="random">Random Noise</option>
                        <option value="threshold">Basic Threshold</option>
                    </select>
                </div>

                <div class="slider-row">
                    <div class="slider-header">
                        <label for="ditherResolution">Resolution Width</label>
                        <span id="ditherResVal" aria-live="polite">400px</span>
                    </div>
                    <input type="range" id="ditherResolution" min="50" max="1200" step="10" value="400" class="notion-slider">
                </div>

                <div class="slider-row">
                    <div class="slider-header">
                        <label for="ditherBrightness">Brightness</label>
                        <span id="ditherBrightnessVal" aria-live="polite">0</span>
                    </div>
                    <input type="range" id="ditherBrightness" min="-128" max="128" step="1" value="0" class="notion-slider">
                </div>

                <div class="slider-row">
                    <div class="slider-header">
                        <label for="ditherContrast">Contrast</label>
                        <span id="ditherContrastVal" aria-live="polite">1.0</span>
                    </div>
                    <input type="range" id="ditherContrast" min="0" max="3" step="0.1" value="1.0" class="notion-slider">
                </div>
            </section>
            <hr class="separator" />
            <section class="control-group">
                <h2 class="group-title">Colors & Palette</h2>
                <div class="setting-row">
                    <label>Palette</label>
                    <select id="ditherPalette" class="notion-select">
                        <option value="bw">1-Bit B&W</option>
                        <option value="greyscale">4-Tone Greyscale</option>
                        <option value="obra-dinn">Obra Dinn</option>
                        <option value="gameboy">Nintendo Game Boy</option>
                        <option value="cga-mode4-p1">CGA Mode 4 Pal 1</option>
                        <option value="cga-mode4-p0">CGA Mode 4 Pal 0</option>
                        <option value="cga-mode5">CGA Mode 5</option>
                        <option value="cga">CGA Full (16)</option>
                        <option value="ega">EGA (16)</option>
                        <option value="vic20">Commodore VIC-20 (16)</option>
                        <option value="macintosh">Apple Macintosh</option>
                        <option value="zx-spectrum">ZX Spectrum</option>
                        <option value="amiga">Amiga Workbench</option>
                        <option value="metallica">Metallica 72 Season</option>
                        <option value="moonlight">Moonlight</option>
                        <option value="sunset">Sunset</option>
                        <option value="hulk">Hulk</option>
                        <option value="infrared">Infrared</option>
                        <option value="teletext">Teletext 3-Bit</option>
                        <option value="custom">Custom (2 Colors)</option>
                    </select>
                </div>
                
                <div class="color-grid" id="ditherCustomColors" style="display: none;">
                    <div class="color-item">
                        <label for="ditherColor1">Dark</label>
                        <div class="color-wrapper"><input type="color" id="ditherColor1" value="#000000"></div>
                    </div>
                    <div class="color-item">
                        <label for="ditherColor2">Light</label>
                        <div class="color-wrapper"><input type="color" id="ditherColor2" value="#ffffff"></div>
                    </div>
                </div>
                
                <button id="ditherResetView" class="notion-btn notion-btn-secondary" style="margin-top: 15px;">Reset Zoom & Pan</button>
            </section>
        `;
    },

    init(sidebarContainer, mainContainer) {
        sidebarContainer.innerHTML = this.getSidebarHTML();
        mainContainer.innerHTML = `
            <div id="ditherPreview" class="dither-preview">
                <div id="ditherCanvasWrapper" class="dither-canvas-wrapper">
                    <canvas id="ditherCanvas" role="img" aria-label="Dithered image render"></canvas>
                </div>
            </div>
        `;

        if (!document.getElementById('dither-tool-styles')) {
            const style = document.createElement('style');
            style.id = 'dither-tool-styles';
            style.textContent = `
                .dither-preview {
                    width: 100%; height: 100%;
                    display: flex; align-items: center; justify-content: center;
                    overflow: hidden; position: relative;
                    cursor: grab;
                }
                .dither-preview:active {
                    cursor: grabbing;
                }
                .dither-canvas-wrapper {
                    display: inline-block;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.15);
                    background: transparent;
                    transform-origin: center center;
                }
                #ditherCanvas {
                    display: block;
                    image-rendering: pixelated; /* crispy pixels */
                    max-width: 100%;
                    max-height: 100%;
                    transition: width var(--dur-slow) var(--ease-premium), height var(--dur-slow) var(--ease-premium);
                }
                

            `;
            document.head.appendChild(style);
        }

        animate("#ditherPreview", { opacity: [0, 1], scale: [0.97, 1] }, { duration: 0.5, easing: [0.05, 0.7, 0.1, 1] });

        const canvas = document.getElementById('ditherCanvas');
        this._visualizer = new DitherVisualizer(canvas);

        this._syncUIToVisualizer();

        this._bindPanZoom();
        this._setupListeners();
    },

    _syncUIToVisualizer() {
        const v = this._visualizer;
        if (!v) return;

        const configMap = {
            'ditherResolution': v.config.resolution,
            'ditherBrightness': v.config.brightness,
            'ditherContrast': v.config.contrast,
            'ditherAlgorithm': v.config.algorithm,
            'ditherPalette': v.config.paletteKey,
            'ditherColor1': v.config.customColor1,
            'ditherColor2': v.config.customColor2
        };

        for (const [id, val] of Object.entries(configMap)) {
            const input = document.getElementById(id);
            if (input) input.value = val;
        }

        const resVal = document.getElementById('ditherResVal');
        if (resVal) resVal.textContent = v.config.resolution + 'px';

        const brightnessVal = document.getElementById('ditherBrightnessVal');
        if (brightnessVal) brightnessVal.textContent = v.config.brightness;

        const contrastVal = document.getElementById('ditherContrastVal');
        if (contrastVal) contrastVal.textContent = v.config.contrast;

        const customColors = document.getElementById('ditherCustomColors');
        if (customColors) {
            customColors.style.display = (v.config.paletteKey === 'custom') ? 'grid' : 'none';
        }
    },

    _addListenerEl(el, eventName, handler) {
        if (!el) return;
        el.addEventListener(eventName, handler);
        this._listeners.push({ el, eventName, handler });
    },

    _addListener(id, event, handler) {
        this._addListenerEl(document.getElementById(id), event, handler);
    },

    _applyViewTransforms() {
        const wrapper = document.getElementById('ditherCanvasWrapper');
        if (!wrapper) return;
        const { panX, panY, zoom } = this._view;
        wrapper.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
    },

    _bindPanZoom() {
        const container = document.getElementById('ditherPreview');
        if (!container) return;

        this._addListenerEl(container, 'wheel', (e) => {
            e.preventDefault();
            const zoomDelta = e.deltaY * -0.002;
            this._view.zoom = Math.min(Math.max(0.1, this._view.zoom + zoomDelta), 10);
            this._applyViewTransforms();
        });

        this._addListenerEl(container, 'pointerdown', (e) => {
            if (e.button !== 0) return; // Only left click
            this._view.isDragging = true;
            this._view.startX = e.clientX - this._view.panX;
            this._view.startY = e.clientY - this._view.panY;
            container.setPointerCapture(e.pointerId);
        });

        this._addListenerEl(container, 'pointermove', (e) => {
            if (!this._view.isDragging) return;
            this._view.panX = e.clientX - this._view.startX;
            this._view.panY = e.clientY - this._view.startY;
            this._applyViewTransforms();
        });

        this._addListenerEl(container, 'pointerup', (e) => {
            this._view.isDragging = false;
            container.releasePointerCapture(e.pointerId);
        });

        this._addListenerEl(container, 'pointercancel', (e) => {
            this._view.isDragging = false;
            container.releasePointerCapture(e.pointerId);
        });
    },

    _setupListeners() {
        // Drop zone styling events
        const dropZone = document.getElementById('ditherDropZone');
        if (dropZone) {
            ['dragenter', 'dragover'].forEach(eventName => {
                this._addListenerEl(dropZone, eventName, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    dropZone.classList.add('dragover');
                });
            });
            ['dragleave', 'drop'].forEach(eventName => {
                this._addListenerEl(dropZone, eventName, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    dropZone.classList.remove('dragover');
                    if (eventName === 'drop' && e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                        this._visualizer.loadMedia(e.dataTransfer.files[0]);
                    }
                });
            });
        }

        // Handle file drop & selection
        this._addListener('ditherMediaUpload', 'change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this._visualizer.loadMedia(file);
            }
        });

        this._addListener('ditherAlgorithm', 'change', (e) => {
            this._visualizer.updateConfig({ algorithm: e.target.value });
        });

        this._addListener('ditherPalette', 'change', (e) => {
            const paletteKey = e.target.value;
            this._visualizer.updateConfig({ paletteKey });
            document.getElementById('ditherCustomColors').style.display = (paletteKey === 'custom') ? 'grid' : 'none';
        });

        this._addListener('ditherResolution', 'input', (e) => {
            document.getElementById('ditherResVal').textContent = e.target.value + 'px';
            this._visualizer.updateConfig({ resolution: e.target.value });
        });

        this._addListener('ditherBrightness', 'input', (e) => {
            document.getElementById('ditherBrightnessVal').textContent = e.target.value;
            this._visualizer.updateConfig({ brightness: e.target.value });
        });

        this._addListener('ditherContrast', 'input', (e) => {
            document.getElementById('ditherContrastVal').textContent = e.target.value;
            this._visualizer.updateConfig({ contrast: e.target.value });
        });

        this._addListener('ditherColor1', 'input', (e) => {
            this._visualizer.updateConfig({ customColor1: e.target.value });
        });

        this._addListener('ditherColor2', 'input', (e) => {
            this._visualizer.updateConfig({ customColor2: e.target.value });
        });

        this._addListener('ditherResetView', 'click', () => {
            this._view = { isDragging: false, startX: 0, startY: 0, panX: 0, panY: 0, zoom: 1 };
            this._applyViewTransforms();
        });
    },

    destroy() {
        this._listeners.forEach(({ el, eventName, handler }) => {
            el.removeEventListener(eventName, handler);
        });
        this._listeners = [];
        if (this._visualizer) {
            this._visualizer.destroy();
        }
        this._visualizer = null;
    }
};
