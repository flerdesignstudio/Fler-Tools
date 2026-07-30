import { MatrixVisualizer } from './matrix-visualizer.js';
import { animate, stagger } from 'motion';
import { createPanZoom, addListenerTracked } from '../../utils/pan-zoom.js';
import { bindDropZone } from '../../utils/drop-zone.js';
import matrixIcon from '../../Assets/matrix.svg?raw';

export default {
    id: 'matrix',
    label: 'Matrix',
    icon: matrixIcon,

    _visualizer: null,
    _listeners: [],
    _slotListeners: [], // rebuilt every time the shape-slot list re-renders — tracked separately so old detached slot nodes don't linger in _listeners

    _view: { isDragging: false, startX: 0, startY: 0, panX: 0, panY: 0, zoom: 1 },
    _resetView: null,

    getSidebarHTML() {
        return `
            <section class="control-group">
                <h2 class="group-title">Source</h2>
                <div class="setting-row">
                    <label>Upload Photo</label>
                    <div id="matrixDropZone" class="tool-drop-zone">
                        <span class="material-symbols-outlined">upload_file</span>
                        <p>Drag & drop image here<br>or click to browse</p>
                        <input type="file" id="matrixMediaUpload" accept="image/*" class="tool-file-input">
                    </div>
                </div>
            </section>
            <hr class="separator" />
            <section class="control-group">
                <h2 class="group-title">Grid & Shape</h2>
                <div class="slider-row">
                    <div class="slider-header">
                        <label for="matrixGridRes">Grid Resolution</label>
                        <span id="matrixGridResVal" aria-live="polite">16</span>
                    </div>
                    <input type="range" id="matrixGridRes" min="6" max="100" step="1" value="16" class="notion-slider">
                </div>
                <div class="slider-row">
                    <div class="slider-header">
                        <label for="matrixRotation">Rotation</label>
                        <span id="matrixRotationVal" aria-live="polite">0°</span>
                    </div>
                    <input type="range" id="matrixRotation" min="0" max="270" step="90" value="0" class="notion-slider">
                </div>
                <div class="setting-row">
                    <label>Aspect Ratio</label>
                    <select id="matrixAspectRatio" class="notion-select">
                        <option value="original">Original</option>
                        <option value="square">1:1 (Square)</option>
                    </select>
                </div>
            </section>
            <hr class="separator" />
            <section class="control-group">
                <h2 class="group-title">Tone Mapping</h2>
                <label class="toggle-row">
                    <input type="checkbox" id="matrixInvert" class="notion-checkbox">
                    <span>Invert Luminance</span>
                </label>
                <label class="toggle-row">
                    <input type="checkbox" id="matrixMidtones" class="notion-checkbox">
                    <span>Scale Up Midtones</span>
                </label>
                <div class="slider-row">
                    <div class="slider-header">
                        <label for="matrixScaleMin">Scale Min</label>
                        <span id="matrixScaleMinVal" aria-live="polite">0.1</span>
                    </div>
                    <input type="range" id="matrixScaleMin" min="0" max="1" step="0.05" value="0.1" class="notion-slider">
                </div>
                <div class="slider-row">
                    <div class="slider-header">
                        <label for="matrixScaleMax">Scale Max</label>
                        <span id="matrixScaleMaxVal" aria-live="polite">1.0</span>
                    </div>
                    <input type="range" id="matrixScaleMax" min="0.5" max="2" step="0.05" value="1.0" class="notion-slider">
                </div>
            </section>
            <hr class="separator" />
            <section class="control-group">
                <h2 class="group-title">Palette</h2>
                <div class="color-item" style="margin-bottom: 12px;">
                    <label for="matrixBgColor">Canvas Background</label>
                    <div class="color-wrapper"><input type="color" id="matrixBgColor" value="#050507"></div>
                </div>
                <div class="setting-row">
                    <label>Color Mode</label>
                    <select id="matrixColorMode" class="notion-select">
                        <option value="sampled" selected>Sampled (real image color)</option>
                        <option value="random">Random per cell</option>
                    </select>
                </div>
                <div class="color-grid" id="matrixColorGrid" style="grid-template-columns: repeat(4, 1fr); margin-top: 8px;"></div>
            </section>
            <hr class="separator" />
            <section class="control-group">
                <h2 class="group-title">Layout & Blend</h2>
                <div class="slider-row">
                    <div class="slider-header">
                        <label for="matrixCellPadding">Cell Gutter</label>
                        <span id="matrixCellPaddingVal" aria-live="polite">0.12</span>
                    </div>
                    <input type="range" id="matrixCellPadding" min="0" max="0.4" step="0.01" value="0.12" class="notion-slider">
                </div>
                <div class="setting-row">
                    <label>Blend Mode</label>
                    <select id="matrixBlendMode" class="notion-select">
                        <option value="source-over" selected>Normal</option>
                        <option value="multiply">Multiply</option>
                        <option value="screen">Screen</option>
                        <option value="overlay">Overlay</option>
                        <option value="difference">Difference</option>
                        <option value="lighten">Lighten</option>
                        <option value="darken">Darken</option>
                    </select>
                </div>
                <div class="slider-row">
                    <div class="slider-header">
                        <label for="matrixShapeOpacity">Shape Opacity</label>
                        <span id="matrixShapeOpacityVal" aria-live="polite">1.0</span>
                    </div>
                    <input type="range" id="matrixShapeOpacity" min="0.1" max="1" step="0.05" value="1.0" class="notion-slider">
                </div>
            </section>
            <hr class="separator" />
            <section class="control-group">
                <h2 class="group-title">Matrix Highlights (<span id="matrixCountText">7</span>)</h2>
                <div style="display: flex; gap: 8px;">
                    <button id="matrixRemoveState" class="notion-btn notion-btn-secondary" style="flex: 1;">− Remove</button>
                    <button id="matrixAddState" class="notion-btn notion-btn-secondary" style="flex: 1;">+ Add</button>
                </div>
                <div id="matrixSlotsContainer" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(56px, 1fr)); gap: 6px; margin-top: 10px;"></div>
                <button id="matrixResetView" class="notion-btn notion-btn-secondary" style="margin-top: 15px;">Reset Zoom & Pan</button>
            </section>
        `;
    },

    getMainHTML() {
        return `
            <div id="matrixPreview" class="matrix-preview">
                <div id="matrixCanvasWrapper" class="matrix-canvas-wrapper">
                    <canvas id="matrixCanvas" role="img" aria-label="Matrix engine render"></canvas>
                </div>
            </div>
        `;
    },

    _injectScopedStyles() {
        if (document.getElementById('matrix-tool-styles')) return;
        const style = document.createElement('style');
        style.id = 'matrix-tool-styles';
        style.textContent = `
            .matrix-preview {
                width: 100%; height: 100%;
                display: flex; align-items: center; justify-content: center;
                overflow: hidden; position: relative; cursor: grab;
            }
            .matrix-preview:active { cursor: grabbing; }
            .matrix-canvas-wrapper { transform-origin: center center; display: inline-block; }
            #matrixCanvas {
                object-fit: contain;
            }
        `;
        document.head.appendChild(style);
    },

    _addListenerEl(el, eventName, handler, store = this._listeners) {
        addListenerTracked(el, eventName, handler, store);
    },

    _addListener(elementId, eventName, handler) {
        addListenerTracked(document.getElementById(elementId), eventName, handler, this._listeners);
    },

    init(sidebarContainer, mainContainer) {
        this._injectScopedStyles();

        sidebarContainer.innerHTML = this.getSidebarHTML();
        mainContainer.innerHTML = this.getMainHTML();

        animate(".control-group", { opacity: [0, 1], x: [-15, 0] }, { delay: stagger(0.08), duration: 0.4, easing: [0.4, 0, 0.2, 1] });
        animate("#matrixPreview", { opacity: [0, 1], scale: [0.97, 1] }, { duration: 0.5, easing: [0.05, 0.7, 0.1, 1] });

        const canvas = document.getElementById('matrixCanvas');
        this._visualizer = new MatrixVisualizer(canvas);

        this._renderColorGrid();
        this._renderShapeSlots();

        // Shared pan/zoom
        const { resetView } = createPanZoom({
            containerId: 'matrixPreview',
            wrapperId: 'matrixCanvasWrapper',
            listeners: this._listeners,
            view: this._view,
        });
        this._resetView = resetView;

        this._bindControls();
    },



    // --- Dynamic sub-lists (colors + shape slots) ----------------------------

    _renderColorGrid() {
        const grid = document.getElementById('matrixColorGrid');
        const colors = this._visualizer.config.colors;
        grid.innerHTML = colors.map((c, i) => `
            <div class="color-item">
                <div class="color-wrapper"><input type="color" id="matrixColor${i}" value="${c.hex}"></div>
                <label style="display:flex; align-items:center; gap:4px; font-size:11px;">
                    <input type="checkbox" id="matrixColor${i}Active" class="notion-checkbox" ${c.active ? 'checked' : ''}>
                    Active
                </label>
            </div>
        `).join('');

        colors.forEach((_, i) => {
            this._addListener(`matrixColor${i}`, 'input', (e) => {
                this._visualizer.setColor(i, e.target.value);
                this._renderShapeSlots(); // preview swatches use the first active color
            });
            this._addListener(`matrixColor${i}Active`, 'change', (e) => {
                this._visualizer.setColorActive(i, e.target.checked);
                this._renderShapeSlots();
            });
        });
    },

    _clearSlotListeners() {
        this._slotListeners.forEach(({ el, eventName, handler }) => el.removeEventListener(eventName, handler));
        this._slotListeners = [];
    },

    _renderShapeSlots() {
        this._clearSlotListeners();

        const v = this._visualizer;
        const container = document.getElementById('matrixSlotsContainer');
        const countText = document.getElementById('matrixCountText');
        const removeBtn = document.getElementById('matrixRemoveState');
        const addBtn = document.getElementById('matrixAddState');

        countText.textContent = v.matrixSize;
        removeBtn.disabled = v.matrixSize <= 4;
        addBtn.disabled = v.matrixSize >= 7;

        const previewColor = v.getActiveColors()[0];

        container.innerHTML = v.loadedPaths.map((entry, i) => `
            <div class="mini-slot" style="background: var(--bg-button); border-radius: 6px; padding: 4px; text-align: center;">
                <div style="width: 28px; height: 28px; background: #000; border-radius: 3px; padding: 3px; margin: 0 auto 4px auto; color: ${previewColor};">
                    ${entry.rawSvg.replace('currentColor', 'currentColor')}
                </div>
                <button class="notion-btn notion-btn-secondary" id="matrixSlotSwap${i}" style="font-size: 10px; padding: 2px 4px; width: 100%;">Swap</button>
                <input type="file" id="matrixSlotFile${i}" accept=".svg" style="display:none">
            </div>
        `).join('');

        v.loadedPaths.forEach((_, i) => {
            const swapBtn = document.getElementById(`matrixSlotSwap${i}`);
            const fileInput = document.getElementById(`matrixSlotFile${i}`);
            this._addListenerEl(swapBtn, 'click', () => fileInput.click(), this._slotListeners);
            this._addListenerEl(fileInput, 'change', (e) => {
                const file = e.target.files[0];
                if (!file) return;
                v.setShapeForSlot(i, file).then(() => this._renderShapeSlots());
            }, this._slotListeners);
        });
    },

    // --- Controls -------------------------------------------------------------

    _bindControls() {
        const v = this._visualizer;

        // Shared drop zone — reset pan/zoom when a new image is loaded
        bindDropZone({
            dropZoneId: 'matrixDropZone',
            fileInputId: 'matrixMediaUpload',
            onFile: (file) => v.loadMedia(file, () => { if (this._resetView) this._resetView(); }),
            listeners: this._listeners,
        });

        this._addListener('matrixBgColor', 'input', (e) => v.updateConfig({ bgColor: e.target.value }));

        this._addListener('matrixGridRes', 'input', (e) => {
            document.getElementById('matrixGridResVal').textContent = e.target.value;
            v.updateConfig({ gridSize: parseInt(e.target.value) });
        });

        this._addListener('matrixRotation', 'input', (e) => {
            document.getElementById('matrixRotationVal').textContent = e.target.value + '°';
            v.updateConfig({ rotation: parseInt(e.target.value) });
        });

        this._addListener('matrixAspectRatio', 'change', (e) => v.updateConfig({ aspectRatio: e.target.value }));

        this._addListener('matrixColorMode', 'change', (e) => v.updateConfig({ colorMode: e.target.value }));

        this._addListener('matrixCellPadding', 'input', (e) => {
            document.getElementById('matrixCellPaddingVal').textContent = e.target.value;
            v.updateConfig({ cellPadding: parseFloat(e.target.value) });
        });

        this._addListener('matrixBlendMode', 'change', (e) => v.updateConfig({ blendMode: e.target.value }));

        this._addListener('matrixShapeOpacity', 'input', (e) => {
            document.getElementById('matrixShapeOpacityVal').textContent = e.target.value;
            v.updateConfig({ shapeOpacity: parseFloat(e.target.value) });
        });

        this._addListener('matrixInvert', 'change', (e) => v.updateConfig({ invert: e.target.checked }));
        this._addListener('matrixMidtones', 'change', (e) => v.updateConfig({ scaleUpMidtones: e.target.checked }));

        this._addListener('matrixScaleMin', 'input', (e) => {
            document.getElementById('matrixScaleMinVal').textContent = e.target.value;
            v.updateConfig({ scaleMin: parseFloat(e.target.value) });
        });
        this._addListener('matrixScaleMax', 'input', (e) => {
            document.getElementById('matrixScaleMaxVal').textContent = e.target.value;
            v.updateConfig({ scaleMax: parseFloat(e.target.value) });
        });

        this._addListener('matrixAddState', 'click', () => {
            v.setMatrixSize(v.matrixSize + 1);
            this._renderShapeSlots();
        });
        this._addListener('matrixRemoveState', 'click', () => {
            v.setMatrixSize(v.matrixSize - 1);
            this._renderShapeSlots();
        });

        this._addListener('matrixResetView', 'click', () => {
            if (this._resetView) this._resetView();
        });

    },

    destroy() {
        this._clearSlotListeners();

        if (this._visualizer) {
            this._visualizer.destroy();
            this._visualizer = null;
        }

        this._listeners.forEach(({ el, eventName, handler }) => {
            el.removeEventListener(eventName, handler);
        });
        this._listeners = [];
        this._resetView = null;
        this._view = { isDragging: false, startX: 0, startY: 0, panX: 0, panY: 0, zoom: 1 };
    }
};
