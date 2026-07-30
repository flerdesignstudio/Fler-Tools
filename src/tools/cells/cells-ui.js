import { CellsVisualizer } from './visualizer.js';
import { animate, stagger } from 'motion';
import { createPanZoom, addListenerTracked } from '../../utils/pan-zoom.js';
import cellsIcon from '../../Assets/cells.svg?raw';

export default {
    id: 'cells',
    label: 'Cells',
    icon: cellsIcon,
    
    _visualizer: null,
    _listeners: [],

    _view: { isDragging: false, startX: 0, startY: 0, panX: 0, panY: 0, zoom: 1 },
    _resetView: null,

    getSidebarHTML() {
        return `
            <section class="control-group">
                <h2 class="group-title">Pattern Generation</h2>
                <div class="slider-row">
                    <div class="slider-header">
                        <label for="cellCount">Cell Count</label>
                        <span id="cellCountVal" aria-live="polite">20</span>
                    </div>
                    <input type="range" id="cellCount" min="5" max="100" step="1" value="20" class="notion-slider">
                </div>
                <div class="slider-row">
                    <div class="slider-header">
                        <label for="cellGap">Cell Gap</label>
                        <span id="cellGapVal" aria-live="polite">1</span>
                    </div>
                    <input type="range" id="cellGap" min="0" max="20" step="1" value="1" class="notion-slider">
                </div>
                <div class="slider-row">
                    <div class="slider-header">
                        <label for="junctionGap">Junction Gap</label>
                        <span id="junctionGapVal" aria-live="polite">0</span>
                    </div>
                    <input type="range" id="junctionGap" min="0" max="30" step="1" value="0" class="notion-slider">
                </div>
                <div class="slider-row">
                    <div class="slider-header">
                        <label for="cellSmoothness">Smoothness</label>
                        <span id="cellSmoothnessVal" aria-live="polite">2</span>
                    </div>
                    <input type="range" id="cellSmoothness" min="0" max="20" step="1" value="2" class="notion-slider">
                </div>
                <div class="slider-row">
                    <div class="slider-header">
                        <label for="canvasMargin">Canvas Margin</label>
                        <span id="canvasMarginVal" aria-live="polite">1</span>
                    </div>
                    <input type="range" id="canvasMargin" min="0" max="100" step="1" value="1" class="notion-slider">
                </div>
                <div style="display: flex; gap: 8px; margin-top: 12px;">
                    <button id="randomizeBtn" class="notion-btn notion-btn-secondary" style="flex: 1;">
                        <span class="material-symbols-outlined" style="font-size: 18px;">shuffle</span>
                        Randomize
                    </button>
                </div>
            </section>
            <hr class="separator" />
            <section class="control-group">
                <h2 class="group-title">Visuals & Colors</h2>
                <div class="segmented-switch" style="margin-bottom: 16px;">
                    <input type="radio" id="drawModeFill" name="drawMode" value="fill" checked>
                    <label for="drawModeFill">Fill</label>
                    <input type="radio" id="drawModeStroke" name="drawMode" value="stroke">
                    <label for="drawModeStroke">Stroke</label>
                </div>
                <div class="slider-row" id="strokeWidthRow" style="opacity: 0.5; pointer-events: none;">
                    <div class="slider-header">
                        <label for="strokeWidth">Stroke Width</label>
                        <span id="strokeWidthVal" aria-live="polite">2</span>
                    </div>
                    <input type="range" id="strokeWidth" min="1" max="20" step="1" value="2" class="notion-slider">
                </div>
                <div class="color-grid">
                    <div class="color-item">
                        <label for="cellColor">Cell Color</label>
                        <div class="color-wrapper"><input type="color" id="cellColor" value="#191919"></div>
                    </div>
                    <div class="color-item">
                        <label for="bgColor">Background</label>
                        <div class="color-wrapper"><input type="color" id="bgColor" value="#39FF14"></div>
                    </div>
                </div>
            </section>
            <hr class="separator" />
            <section class="control-group">
                <h2 class="group-title">Settings & Export</h2>
                <h3 class="sub-title">Aspect Ratio</h3>
                <div class="setting-row">
                    <select id="aspectRatioSelect" class="notion-select">
                        <option value="1:1">1:1 (Square)</option>
                        <option value="16:9">16:9 (Landscape)</option>
                        <option value="9:16">9:16 (Portrait)</option>
                        <option value="4:3">4:3 (Standard)</option>
                    </select>
                </div>
                
                <button id="cellsResetView" class="notion-btn notion-btn-secondary" style="margin-top: 15px;">Reset Zoom & Pan</button>
            </section>
        `;
    },

    getMainHTML() {
        return `
            <div id="cellsPreview" class="cells-preview" style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; overflow: hidden; position: relative; cursor: grab;">
                <div id="cellsCanvasWrapper" style="display: inline-block; background: transparent; transform-origin: center center;">
                    <canvas id="cells_visualizer" role="img" aria-label="Static cell pattern"></canvas>
                </div>
            </div>
        `;
    },

    _addListener(elementId, eventName, handler) {
        addListenerTracked(document.getElementById(elementId), eventName, handler, this._listeners);
    },

    _addListenerEl(el, eventName, handler) {
        addListenerTracked(el, eventName, handler, this._listeners);
    },

    init(sidebarContainer, mainContainer) {
        sidebarContainer.innerHTML = this.getSidebarHTML();
        mainContainer.innerHTML = this.getMainHTML();

        animate(".control-group", { opacity: [0, 1], x: [-15, 0] }, { delay: stagger(0.08), duration: 0.4, easing: [0.4, 0, 0.2, 1] });
        animate("#cells_visualizer", { opacity: [0, 1], scale: [0.97, 1] }, { duration: 0.5, easing: [0.05, 0.7, 0.1, 1] });

        const canvas = document.getElementById('cells_visualizer');
        this._visualizer = new CellsVisualizer(canvas);

        this._controls = {
            cellCount: document.getElementById('cellCount'),
            cellGap: document.getElementById('cellGap'),
            junctionGap: document.getElementById('junctionGap'),
            cellSmoothness: document.getElementById('cellSmoothness'),
            canvasMargin: document.getElementById('canvasMargin'),
            cellColor: document.getElementById('cellColor'),
            bgColor: document.getElementById('bgColor'),
            strokeWidth: document.getElementById('strokeWidth')
        };
        this._controlVals = {
            cellCount: document.getElementById('cellCountVal'),
            cellGap: document.getElementById('cellGapVal'),
            junctionGap: document.getElementById('junctionGapVal'),
            cellSmoothness: document.getElementById('cellSmoothnessVal'),
            canvasMargin: document.getElementById('canvasMarginVal'),
            strokeWidth: document.getElementById('strokeWidthVal')
        };

        this._syncUIToVisualizer();

        // Shared pan/zoom
        const { resetView } = createPanZoom({
            containerId: 'cellsPreview',
            wrapperId: 'cellsCanvasWrapper',
            listeners: this._listeners,
            view: this._view,
        });
        this._resetView = resetView;

        this._bindEvents();
    },

    _syncUIToVisualizer() {
        const v = this._visualizer;
        if (!v) return;

        const mappings = {
            'cellCount': v.pattern.count,
            'cellGap': v.pattern.gap,
            'junctionGap': v.pattern.junctionGap,
            'cellSmoothness': v.pattern.smoothness,
            'canvasMargin': v.pattern.margin
        };

        for (const [id, val] of Object.entries(mappings)) {
            const input = this._controls[id];
            const valSpan = this._controlVals[id];
            if (input) input.value = val;
            if (valSpan) valSpan.textContent = val;
        }

        const cellColor = this._controls.cellColor;
        if (cellColor) cellColor.value = v.config.cellColor;

        const bgColor = this._controls.bgColor;
        if (bgColor) bgColor.value = v.config.bgColor;

        const strokeWidthInput = this._controls.strokeWidth;
        const strokeWidthVal = this._controlVals.strokeWidth;
        if (strokeWidthInput) strokeWidthInput.value = v.config.strokeWidth;
        if (strokeWidthVal) strokeWidthVal.textContent = v.config.strokeWidth;

        const fillRadio = document.getElementById('drawModeFill');
        const strokeRadio = document.getElementById('drawModeStroke');
        if (v.config.drawMode === 'stroke' && strokeRadio) strokeRadio.checked = true;
        else if (fillRadio) fillRadio.checked = true;

        const strokeWidthRow = document.getElementById('strokeWidthRow');
        if (strokeWidthRow) {
            if (v.config.drawMode === 'stroke') {
                strokeWidthRow.style.opacity = '1';
                strokeWidthRow.style.pointerEvents = 'auto';
            } else {
                strokeWidthRow.style.opacity = '0.5';
                strokeWidthRow.style.pointerEvents = 'none';
            }
        }
    },

    _bindEvents() {
        const v = this._visualizer;
        
        const updatePatternFromUI = () => {
            const count = parseInt(this._controls.cellCount.value);
            const gap = parseInt(this._controls.cellGap.value);
            const junctionGap = parseInt(this._controls.junctionGap.value);
            const smoothness = parseInt(this._controls.cellSmoothness.value);
            const margin = parseInt(this._controls.canvasMargin.value);
            v.updatePattern(count, gap, smoothness, margin, junctionGap);
        };

        ['cellCount', 'cellGap', 'junctionGap', 'cellSmoothness', 'canvasMargin'].forEach(id => {
            this._addListener(id, 'input', (e) => {
                this._controlVals[id].textContent = e.target.value;
            });
            this._addListener(id, 'change', () => {
                updatePatternFromUI();
            });
        });

        this._addListener('randomizeBtn', 'click', () => {
            this._controls.cellCount.value = Math.floor(Math.random() * 80) + 10;
            this._controls.cellGap.value = Math.floor(Math.random() * 10);
            this._controls.junctionGap.value = Math.floor(Math.random() * 15);
            this._controls.cellSmoothness.value = Math.floor(Math.random() * 15);
            this._controls.canvasMargin.value = Math.floor(Math.random() * 30);
            
            ['cellCount', 'cellGap', 'junctionGap', 'cellSmoothness', 'canvasMargin'].forEach(id => {
                this._controlVals[id].textContent = this._controls[id].value;
            });
            
            updatePatternFromUI();
        });

        this._addListener('aspectRatioSelect', 'change', (e) => {
            v.setAspectRatio(e.target.value);
            updatePatternFromUI(); 
        });

        let rafId = null;
        const updateVisualizerConfig = () => {
            if (rafId) cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(() => {
                const drawModeNode = document.querySelector('input[name="drawMode"]:checked');
                const drawMode = drawModeNode ? drawModeNode.value : 'fill';

                v.updateConfig({
                    cellColor: this._controls.cellColor.value,
                    bgColor: this._controls.bgColor.value,
                    drawMode: drawMode,
                    strokeWidth: parseInt(this._controls.strokeWidth.value)
                });

                const strokeWidthRow = document.getElementById('strokeWidthRow');
                if (strokeWidthRow) {
                    if (drawMode === 'stroke') {
                        strokeWidthRow.style.opacity = '1';
                        strokeWidthRow.style.pointerEvents = 'auto';
                    } else {
                        strokeWidthRow.style.opacity = '0.5';
                        strokeWidthRow.style.pointerEvents = 'none';
                    }
                }
                rafId = null;
            });
        };

        ['cellColor', 'bgColor'].forEach(id => {
            this._addListener(id, 'input', () => {
                updateVisualizerConfig();
            });
        });

        this._addListener('strokeWidth', 'input', (e) => {
            this._controlVals['strokeWidth'].textContent = e.target.value;
            updateVisualizerConfig();
        });

        ['drawModeFill', 'drawModeStroke'].forEach(id => {
            this._addListener(id, 'change', () => updateVisualizerConfig());
        });

        this._addListener('cellsResetView', 'click', () => {
            if (this._resetView) this._resetView();
        });

        document.querySelectorAll('.notion-btn').forEach(btn => {
            const down = () => animate(btn, { scale: 0.95 }, { duration: 0.1 });
            const up = () => animate(btn, { scale: 1 }, { type: "spring", stiffness: 300, damping: 15 });
            
            btn.addEventListener('mousedown', down);
            btn.addEventListener('mouseup', up);
            btn.addEventListener('mouseleave', up);
            
            this._listeners.push(
                { el: btn, eventName: 'mousedown', handler: down },
                { el: btn, eventName: 'mouseup', handler: up },
                { el: btn, eventName: 'mouseleave', handler: up }
            );
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
