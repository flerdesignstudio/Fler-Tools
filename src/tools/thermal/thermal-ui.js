import { animate, stagger } from 'motion';
import { ThermalVisualizer } from './thermal-visualizer.js';
import { createPanZoom, addListenerTracked } from '../../utils/pan-zoom.js';
import { bindDropZone } from '../../utils/drop-zone.js';
import thermalIcon from '../../Assets/thermal.svg?raw';

export default {
    id: 'thermal',
    label: 'Thermal',
    icon: thermalIcon,
    _visualizer: null,
    _listeners: [],
    _view: { isDragging: false, startX: 0, startY: 0, panX: 0, panY: 0, zoom: 1 },
    _resetView: null,

    getSidebarHTML() {
        return `
            <section class="control-group">
                <h2 class="group-title">Source</h2>
                <div class="segmented-switch" id="thermalSourceType" style="margin-bottom: 12px;">
                    <input type="radio" id="thermalSrcFile" name="thermalSrc" value="file" checked>
                    <label for="thermalSrcFile">File</label>
                    <input type="radio" id="thermalSrcWebcam" name="thermalSrc" value="webcam">
                    <label for="thermalSrcWebcam">Webcam</label>
                </div>

                <div class="setting-row" id="thermalDropZoneContainer">
                    <div id="thermalDropZone" class="tool-drop-zone">
                        <span class="material-symbols-outlined">upload_file</span>
                        <p>Drag & drop image/video<br>or click to browse</p>
                        <input type="file" id="thermalMediaUpload" accept="image/*,video/*" class="tool-file-input">
                    </div>
                </div>

                <div class="setting-row" id="thermalWebcamContainer" style="display: none;">
                    <button class="notion-btn notion-btn-primary" id="thermalStartWebcamBtn" style="width: 100%;">
                        <span class="material-symbols-outlined" style="font-size: 18px; margin-right: 6px;">videocam</span>
                        Start Webcam
                    </button>
                    <p style="font-size: 12px; color: var(--text-secondary); text-align: center; margin-top: 8px;">
                        Allows live thermal processing from your camera.
                    </p>
                </div>
            </section>
            <hr class="separator" />
            <section class="control-group">
                <h2 class="group-title">Thermal Mapping</h2>
                <div class="setting-row">
                    <label for="thermalPalette">False-color Palette</label>
                    <select id="thermalPalette" class="notion-select">
                        <option value="classic">Classic Thermal</option>
                        <option value="ironbow">Ironbow</option>
                        <option value="inferno">Inferno</option>
                        <option value="arctic">Arctic</option>
                        <option value="grayscale">White Hot</option>
                        <option value="vibrant">Vibrant</option>
                        <option value="custom">Custom Colors</option>
                    </select>
                </div>
                <div class="color-grid" id="thermalCustomColors" style="display: none; margin-top: 10px;">
                    <div class="color-item"><label for="thermalColor0">0%</label><div class="color-wrapper"><input type="color" id="thermalColor0" value="#000004"></div></div>
                    <div class="color-item"><label for="thermalColor1">25%</label><div class="color-wrapper"><input type="color" id="thermalColor1" value="#320a5f"></div></div>
                    <div class="color-item"><label for="thermalColor2">50%</label><div class="color-wrapper"><input type="color" id="thermalColor2" value="#bb3754"></div></div>
                    <div class="color-item"><label for="thermalColor3">75%</label><div class="color-wrapper"><input type="color" id="thermalColor3" value="#ed6925"></div></div>
                    <div class="color-item"><label for="thermalColor4">100%</label><div class="color-wrapper"><input type="color" id="thermalColor4" value="#fcffa4"></div></div>
                </div>
                <label class="toggle-row" for="thermalAutoLevels">
                    <input type="checkbox" id="thermalAutoLevels" class="notion-checkbox" checked>
                    <span>Auto Levels</span>
                </label>
                <div class="slider-row">
                    <div class="slider-header"><label for="thermalBlackPoint">Black Point</label><span id="thermalBlackPointVal">0%</span></div>
                    <input type="range" id="thermalBlackPoint" min="0" max="95" value="0" class="notion-slider">
                </div>
                <div class="slider-row">
                    <div class="slider-header"><label for="thermalWhitePoint">White Point</label><span id="thermalWhitePointVal">100%</span></div>
                    <input type="range" id="thermalWhitePoint" min="5" max="100" value="100" class="notion-slider">
                </div>
                <label class="toggle-row" for="thermalInvert">
                    <input type="checkbox" id="thermalInvert" class="notion-checkbox">
                    <span>Invert Intensity</span>
                </label>
            </section>
            <hr class="separator" />
            <section class="control-group">
                <h2 class="group-title">Output</h2>
                ${this._slider('thermalResolution', 'Resolution Width', '800px', 100, 1600, 10, 800)}
                ${this._slider('thermalBlur', 'Blur', '0px', 0, 50, 1, 0)}
                ${this._slider('thermalSensorNoise', 'Sensor Noise', '0', 0, 100, 1, 0)}
                ${this._slider('thermalOverlayGrain', 'Overlay Grain', '0', 0, 100, 1, 0)}
                ${this._slider('thermalBrightness', 'Brightness', '0', -50, 50, 1, 0)}
                ${this._slider('thermalContrast', 'Contrast', '1.0', 0.2, 3, 0.1, 1)}
                ${this._slider('thermalGamma', 'Gamma', '1.0', 0.2, 3, 0.1, 1)}
                <button id="thermalResetView" class="notion-btn notion-btn-secondary" style="margin-top: 15px;">Reset Zoom & Pan</button>
            </section>`;
    },

    _slider(id, label, display, min, max, step, value) {
        return `<div class="slider-row"><div class="slider-header"><label for="${id}">${label}</label><span id="${id}Val" aria-live="polite">${display}</span></div><input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${value}" class="notion-slider"></div>`;
    },

    init(sidebarContainer, mainContainer) {
        sidebarContainer.innerHTML = this.getSidebarHTML();
        mainContainer.innerHTML = `<div id="thermalPreview" class="thermal-preview"><div id="thermalCanvasWrapper" class="thermal-canvas-wrapper"><canvas id="thermalCanvas" role="img" aria-label="False-color thermal image render"></canvas></div></div>`;
        if (!document.getElementById('thermal-tool-styles')) {
            const style = document.createElement('style');
            style.id = 'thermal-tool-styles';
            style.textContent = `.thermal-preview { width:100%; height:100%; display:flex; align-items:center; justify-content:center; overflow:hidden; cursor:grab; } .thermal-preview:active { cursor:grabbing; } .thermal-canvas-wrapper { display:inline-block; transform-origin:center; } #thermalCanvas { display:block; max-width:100%; max-height:100%; }`;
            document.head.appendChild(style);
        }
        animate('#thermalPreview', { opacity: [0, 1], scale: [0.97, 1] }, { duration: 0.5, easing: [0.05, 0.7, 0.1, 1] });
        this._visualizer = new ThermalVisualizer(document.getElementById('thermalCanvas'));
        this._setLevelControlsEnabled(false);

        // Shared pan/zoom
        const { resetView } = createPanZoom({
            containerId: 'thermalPreview',
            wrapperId: 'thermalCanvasWrapper',
            listeners: this._listeners,
            view: this._view,
        });
        this._resetView = resetView;

        // Shared drop zone
        bindDropZone({
            dropZoneId: 'thermalDropZone',
            fileInputId: 'thermalMediaUpload',
            onFile: (file) => this._visualizer.loadMedia(file),
            listeners: this._listeners,
        });

        this._setupListeners();
    },

    _addListenerEl(el, eventName, handler) { addListenerTracked(el, eventName, handler, this._listeners); },
    _addListener(id, eventName, handler) { addListenerTracked(document.getElementById(id), eventName, handler, this._listeners); },
    _setLevelControlsEnabled(enabled) {
        ['thermalBlackPoint', 'thermalWhitePoint'].forEach((id) => {
            const control = document.getElementById(id);
            if (control) control.disabled = !enabled;
        });
    },

    _setupListeners() {
        const srcTypeRadios = document.querySelectorAll('input[name="thermalSrc"]');
        srcTypeRadios.forEach(radio => {
            this._addListenerEl(radio, 'change', (e) => {
                const dropZoneContainer = document.getElementById('thermalDropZoneContainer');
                const webcamContainer = document.getElementById('thermalWebcamContainer');
                if (e.target.value === 'webcam') {
                    if (dropZoneContainer) dropZoneContainer.style.display = 'none';
                    if (webcamContainer) webcamContainer.style.display = 'block';
                } else {
                    if (dropZoneContainer) dropZoneContainer.style.display = 'block';
                    if (webcamContainer) webcamContainer.style.display = 'none';
                    if (this._visualizer) this._visualizer.stopWebcam();
                }
            });
        });

        this._addListener('thermalStartWebcamBtn', 'click', () => {
            if (this._visualizer) this._visualizer.startWebcam();
        });

        this._addListener('thermalPalette', 'change', (event) => {
            const paletteKey = event.target.value;
            this._visualizer.updateConfig({ paletteKey });
            const customColorsEl = document.getElementById('thermalCustomColors');
            if (customColorsEl) customColorsEl.style.display = (paletteKey === 'custom') ? 'flex' : 'none';
        });
        for (let i = 0; i < 5; i++) {
            this._addListener(`thermalColor${i}`, 'input', () => {
                const colors = [];
                for (let j = 0; j < 5; j++) {
                    const input = document.getElementById(`thermalColor${j}`);
                    colors.push(input ? input.value : '#000000');
                }
                this._visualizer.updateConfig({ customColors: colors });
            });
        }
        this._addListener('thermalAutoLevels', 'change', (event) => {
            this._setLevelControlsEnabled(!event.target.checked);
            this._visualizer.updateConfig({ autoLevels: event.target.checked });
        });
        this._addListener('thermalInvert', 'change', (event) => this._visualizer.updateConfig({ invert: event.target.checked }));
        this._addListener('thermalResolution', 'input', (event) => { document.getElementById('thermalResolutionVal').textContent = `${event.target.value}px`; this._visualizer.updateConfig({ resolution: event.target.value }); });
        ['thermalBlackPoint', 'thermalWhitePoint'].forEach((id) => this._addListener(id, 'input', (event) => { document.getElementById(`${id}Val`).textContent = `${event.target.value}%`; this._visualizer.updateConfig({ [id === 'thermalBlackPoint' ? 'blackPoint' : 'whitePoint']: event.target.value }); }));
        ['thermalBlur', 'thermalSensorNoise', 'thermalOverlayGrain'].forEach((id) => this._addListener(id, 'input', (event) => { const suffix = id === 'thermalBlur' ? 'px' : ''; document.getElementById(`${id}Val`).textContent = `${event.target.value}${suffix}`; const key = id.replace('thermal', '').replace(/^./, (c) => c.toLowerCase()); this._visualizer.updateConfig({ [key]: event.target.value }); }));
        ['thermalBrightness', 'thermalContrast', 'thermalGamma'].forEach((id) => this._addListener(id, 'input', (event) => { document.getElementById(`${id}Val`).textContent = id === 'thermalBrightness' ? event.target.value : Number(event.target.value).toFixed(1); const key = id.replace('thermal', '').replace(/^./, (c) => c.toLowerCase()); this._visualizer.updateConfig({ [key]: event.target.value }); }));
        this._addListener('thermalResetView', 'click', () => { if (this._resetView) this._resetView(); });
    },

    destroy() {
        this._listeners.forEach(({ el, eventName, handler }) => el.removeEventListener(eventName, handler));
        this._listeners = [];
        this._visualizer?.destroy();
        this._visualizer = null;
        this._resetView = null;
        // Reset view state so zoom/pan doesn't persist between sessions
        this._view = { isDragging: false, startX: 0, startY: 0, panX: 0, panY: 0, zoom: 1 };
    }
};
