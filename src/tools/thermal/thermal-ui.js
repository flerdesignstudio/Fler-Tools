import { animate } from 'motion';
import { ThermalVisualizer } from './thermal-visualizer.js';

export default {
    id: 'thermal',
    label: 'Thermal Image',
    icon: '♨︎',
    _visualizer: null,
    _listeners: [],
    _view: { isDragging: false, startX: 0, startY: 0, panX: 0, panY: 0, zoom: 1 },

    getSidebarHTML() {
        return `
            <section class="control-group">
                <h2 class="group-title">Source</h2>
                <div class="setting-row">
                    <label>Upload Image</label>
                    <div id="thermalDropZone" class="tool-drop-zone">
                        <span class="material-symbols-outlined">upload_file</span>
                        <p>Drag & drop image here<br>or click to browse</p>
                        <input type="file" id="thermalMediaUpload" accept="image/*" class="tool-file-input">
                    </div>
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
                    </select>
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
            style.textContent = `.thermal-preview { width:100%; height:100%; display:flex; align-items:center; justify-content:center; overflow:hidden; cursor:grab; } .thermal-preview:active { cursor:grabbing; } .thermal-canvas-wrapper { display:inline-block; box-shadow:0 4px 20px rgba(0,0,0,.15); transform-origin:center; } #thermalCanvas { display:block; max-width:100%; max-height:100%; }`;
            document.head.appendChild(style);
        }
        animate('#thermalPreview', { opacity: [0, 1], scale: [0.97, 1] }, { duration: 0.5, easing: [0.05, 0.7, 0.1, 1] });
        this._visualizer = new ThermalVisualizer(document.getElementById('thermalCanvas'));
        this._setLevelControlsEnabled(false);
        this._bindPanZoom();
        this._setupListeners();
    },

    _addListener(id, eventName, handler) { this._addListenerEl(document.getElementById(id), eventName, handler); },
    _addListenerEl(el, eventName, handler) { if (el) { el.addEventListener(eventName, handler); this._listeners.push({ el, eventName, handler }); } },
    _setLevelControlsEnabled(enabled) {
        ['thermalBlackPoint', 'thermalWhitePoint'].forEach((id) => {
            const control = document.getElementById(id);
            if (control) control.disabled = !enabled;
        });
    },
    _applyViewTransforms() { const el = document.getElementById('thermalCanvasWrapper'); if (el) el.style.transform = `translate(${this._view.panX}px, ${this._view.panY}px) scale(${this._view.zoom})`; },

    _bindPanZoom() {
        const container = document.getElementById('thermalPreview');
        this._addListenerEl(container, 'wheel', (event) => { event.preventDefault(); this._view.zoom = Math.min(10, Math.max(0.1, this._view.zoom - event.deltaY * 0.002)); this._applyViewTransforms(); });
        this._addListenerEl(container, 'pointerdown', (event) => { if (event.button !== 0) return; this._view.isDragging = true; this._view.startX = event.clientX - this._view.panX; this._view.startY = event.clientY - this._view.panY; container.setPointerCapture(event.pointerId); });
        this._addListenerEl(container, 'pointermove', (event) => { if (!this._view.isDragging) return; this._view.panX = event.clientX - this._view.startX; this._view.panY = event.clientY - this._view.startY; this._applyViewTransforms(); });
        const stopDrag = (event) => { this._view.isDragging = false; if (container.hasPointerCapture(event.pointerId)) container.releasePointerCapture(event.pointerId); };
        this._addListenerEl(container, 'pointerup', stopDrag);
        this._addListenerEl(container, 'pointercancel', stopDrag);
    },

    _setupListeners() {
        const dropZone = document.getElementById('thermalDropZone');
        ['dragenter', 'dragover'].forEach((name) => this._addListenerEl(dropZone, name, (event) => { event.preventDefault(); event.stopPropagation(); dropZone.classList.add('dragover'); }));
        ['dragleave', 'drop'].forEach((name) => this._addListenerEl(dropZone, name, (event) => { event.preventDefault(); event.stopPropagation(); dropZone.classList.remove('dragover'); if (name === 'drop' && event.dataTransfer.files[0]) this._visualizer.loadMedia(event.dataTransfer.files[0]); }));
        this._addListener('thermalMediaUpload', 'change', (event) => this._visualizer.loadMedia(event.target.files[0]));
        this._addListener('thermalPalette', 'change', (event) => this._visualizer.updateConfig({ paletteKey: event.target.value }));
        this._addListener('thermalAutoLevels', 'change', (event) => {
            this._setLevelControlsEnabled(!event.target.checked);
            this._visualizer.updateConfig({ autoLevels: event.target.checked });
        });
        this._addListener('thermalInvert', 'change', (event) => this._visualizer.updateConfig({ invert: event.target.checked }));
        this._addListener('thermalResolution', 'input', (event) => { document.getElementById('thermalResolutionVal').textContent = `${event.target.value}px`; this._visualizer.updateConfig({ resolution: event.target.value }); });
        ['thermalBlackPoint', 'thermalWhitePoint'].forEach((id) => this._addListener(id, 'input', (event) => { document.getElementById(`${id}Val`).textContent = `${event.target.value}%`; this._visualizer.updateConfig({ [id === 'thermalBlackPoint' ? 'blackPoint' : 'whitePoint']: event.target.value }); }));
        ['thermalBlur', 'thermalSensorNoise', 'thermalOverlayGrain'].forEach((id) => this._addListener(id, 'input', (event) => { const suffix = id === 'thermalBlur' ? 'px' : ''; document.getElementById(`${id}Val`).textContent = `${event.target.value}${suffix}`; const key = id.replace('thermal', '').replace(/^./, (c) => c.toLowerCase()); this._visualizer.updateConfig({ [key]: event.target.value }); }));
        ['thermalBrightness', 'thermalContrast', 'thermalGamma'].forEach((id) => this._addListener(id, 'input', (event) => { document.getElementById(`${id}Val`).textContent = id === 'thermalBrightness' ? event.target.value : Number(event.target.value).toFixed(1); const key = id.replace('thermal', '').replace(/^./, (c) => c.toLowerCase()); this._visualizer.updateConfig({ [key]: event.target.value }); }));
        this._addListener('thermalResetView', 'click', () => { this._view = { isDragging: false, startX: 0, startY: 0, panX: 0, panY: 0, zoom: 1 }; this._applyViewTransforms(); });
    },

    destroy() { this._listeners.forEach(({ el, eventName, handler }) => el.removeEventListener(eventName, handler)); this._listeners = []; this._visualizer?.destroy(); this._visualizer = null; }
};
