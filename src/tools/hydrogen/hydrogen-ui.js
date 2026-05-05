import { HydrogenVisualizer } from './visualizer.js';
import { animate, stagger } from 'motion';

export default {
    id: 'hydrogen',
    label: 'Hydrogen',
    icon: '⚛',
    
    _visualizer: null,
    _listeners: [],
    _updateTimeout: null,
    _autoMorphInterval: null,

    getSidebarHTML() {
        return `
            <section class="control-group">
                <h2 class="group-title">Quantum Numbers</h2>
                <div class="slider-row">
                    <div class="slider-header">
                        <label for="nSlider_h">Principal (n)</label>
                        <span id="nVal_h" aria-live="polite">4</span>
                    </div>
                    <input type="range" id="nSlider_h" min="1" max="10" step="1" value="4" class="notion-slider">
                </div>
                <div class="slider-row">
                    <div class="slider-header">
                        <label for="lSlider_h">Azimuthal (l)</label>
                        <span id="lVal_h" aria-live="polite">2</span>
                    </div>
                    <input type="range" id="lSlider_h" min="0" max="3" step="1" value="2" class="notion-slider">
                </div>
                <div class="slider-row">
                    <div class="slider-header">
                        <label for="mSlider_h">Magnetic (m)</label>
                        <span id="mVal_h" aria-live="polite">1</span>
                    </div>
                    <input type="range" id="mSlider_h" min="-2" max="2" step="1" value="1" class="notion-slider">
                </div>
            </section>
            
            <hr class="separator" />

            <section class="control-group">
                <h2 class="group-title">Shape Morphing</h2>
                <label class="toggle-row">
                    <input type="checkbox" id="autoMorph_h" class="notion-checkbox">
                    <span>Auto-Morph Shape</span>
                </label>
                <div class="setting-row">
                    <label>Morph Speed</label>
                    <select id="morphSpeed_h" class="notion-select">
                        <option value="slow">Slow (2.5s)</option>
                        <option value="slower">Slower (5s)</option>
                    </select>
                </div>
            </section>
            
            <hr class="separator" />
            
            <section class="control-group">
                <h2 class="group-title">Spatial Gradients</h2>
                
                <h3 class="sub-title" style="margin-top:0;">Positive Phase (+)</h3>
                <div class="setting-row">
                    <select id="posGradType_h" class="notion-select">
                        <option value="solid">Solid</option>
                        <option value="linear" selected>Linear</option>
                        <option value="radial">Radial</option>
                        <option value="angular">Angular</option>
                        <option value="density">Density (Depth)</option>
                    </select>
                </div>
                <div class="color-grid">
                    <div class="color-item">
                        <label for="posColor1_h">Color 1</label>
                        <div class="color-wrapper"><input type="color" id="posColor1_h" value="#00FFFF"></div>
                    </div>
                    <div class="color-item">
                        <label for="posColor2_h">Color 2</label>
                        <div class="color-wrapper"><input type="color" id="posColor2_h" value="#FF00FF"></div>
                    </div>
                </div>
                <div class="slider-row">
                    <div class="slider-header">
                        <label for="posAngle_h">Angle</label>
                        <span id="posAngleVal_h">0°</span>
                    </div>
                    <input type="range" id="posAngle_h" min="0" max="360" step="1" value="0" class="notion-slider">
                </div>

                <h3 class="sub-title">Negative Phase (-)</h3>
                <div class="setting-row">
                    <select id="negGradType_h" class="notion-select">
                        <option value="solid">Solid</option>
                        <option value="linear" selected>Linear</option>
                        <option value="radial">Radial</option>
                        <option value="angular">Angular</option>
                        <option value="density">Density (Depth)</option>
                    </select>
                </div>
                <div class="color-grid">
                    <div class="color-item">
                        <label for="negColor1_h">Color 1</label>
                        <div class="color-wrapper"><input type="color" id="negColor1_h" value="#FF4500"></div>
                    </div>
                    <div class="color-item">
                        <label for="negColor2_h">Color 2</label>
                        <div class="color-wrapper"><input type="color" id="negColor2_h" value="#FFFF00"></div>
                    </div>
                </div>
                <div class="slider-row">
                    <div class="slider-header">
                        <label for="negAngle_h">Angle</label>
                        <span id="negAngleVal_h">180°</span>
                    </div>
                    <input type="range" id="negAngle_h" min="0" max="360" step="1" value="180" class="notion-slider">
                </div>
                
                <h3 class="sub-title">Global Adjustments</h3>
                <label class="toggle-row">
                    <input type="checkbox" id="rotateColors_h" class="notion-checkbox">
                    <span>Animate Gradient Rotation</span>
                </label>
                <div class="color-grid" style="margin-top: 12px;">
                    <div class="color-item">
                        <label for="colorBg_h">Background</label>
                        <div class="color-wrapper"><input type="color" id="colorBg_h" value="#000000"></div>
                    </div>
                </div>
                <div class="slider-row" style="margin-top: 8px;">
                    <div class="slider-header">
                        <label for="exposureSlider_h">Exposure</label>
                        <span id="exposureVal_h" aria-live="polite">2.0</span>
                    </div>
                    <input type="range" id="exposureSlider_h" min="0.1" max="10.0" step="0.1" value="2.0" class="notion-slider">
                </div>
            </section>
            
            <hr class="separator" />
            
            <section class="control-group">
                <h2 class="group-title">Settings & Export</h2>
                <h3 class="sub-title">Aspect Ratio</h3>
                <div class="setting-row">
                    <select id="aspectRatioSelect_h" class="notion-select">
                        <option value="1:1">1:1 (Square)</option>
                        <option value="16:9">16:9 (Landscape)</option>
                        <option value="9:16">9:16 (Portrait)</option>
                        <option value="4:3">4:3 (Standard)</option>
                    </select>
                </div>
                <div style="margin-top: 16px; display: flex; flex-direction: column; gap: 8px;">
                    <button id="fullscreenBtn_h" class="notion-btn notion-btn-secondary">Fullscreen Preview</button>
                    <button id="downloadBtn_h" class="notion-btn notion-btn-primary">Export PNG</button>
                </div>
            </section>
        `;
    },

    getMainHTML() {
        return `<canvas id="hydrogen_visualizer" role="img" aria-label="Hydrogen orbital cross section"></canvas>`;
    },

    _addListener(elementId, eventName, handler) {
        const el = document.getElementById(elementId);
        if (el) {
            el.addEventListener(eventName, handler);
            this._listeners.push({ el, eventName, handler });
        }
    },

    init(sidebarContainer, mainContainer) {
        sidebarContainer.innerHTML = this.getSidebarHTML();
        mainContainer.innerHTML = this.getMainHTML();

        animate(".control-group", { opacity: [0, 1], x: [-20, 0] }, { delay: stagger(0.1), duration: 0.5 });

        const canvas = document.getElementById('hydrogen_visualizer');
        this._visualizer = new HydrogenVisualizer(canvas);
        
        this._pushConfig();
        this._bindEvents();
    },
    
    _pushConfig() {
        if (!this._visualizer) return;
        this._visualizer.updateConfig({
            posGradType: document.getElementById('posGradType_h').value,
            posColor1: document.getElementById('posColor1_h').value,
            posColor2: document.getElementById('posColor2_h').value,
            posAngle: parseFloat(document.getElementById('posAngle_h').value),
            
            negGradType: document.getElementById('negGradType_h').value,
            negColor1: document.getElementById('negColor1_h').value,
            negColor2: document.getElementById('negColor2_h').value,
            negAngle: parseFloat(document.getElementById('negAngle_h').value),
            
            bgColor: document.getElementById('colorBg_h').value,
            exposure: parseFloat(document.getElementById('exposureSlider_h').value),
            rotateColors: document.getElementById('rotateColors_h').checked,
            
            morphSpeed: document.getElementById('morphSpeed_h').value
        });
    },

    _bindEvents() {
        const v = this._visualizer;
        
        const nSlider = document.getElementById('nSlider_h');
        const lSlider = document.getElementById('lSlider_h');
        const mSlider = document.getElementById('mSlider_h');

        const updateConstraints = () => {
            const n = parseInt(nSlider.value);
            lSlider.max = n - 1;
            if (parseInt(lSlider.value) > n - 1) lSlider.value = n - 1;
            const l = parseInt(lSlider.value);
            
            mSlider.min = -l;
            mSlider.max = l;
            if (parseInt(mSlider.value) > l) mSlider.value = l;
            if (parseInt(mSlider.value) < -l) mSlider.value = -l;
            
            document.getElementById('nVal_h').textContent = n;
            document.getElementById('lVal_h').textContent = l;
            document.getElementById('mVal_h').textContent = parseInt(mSlider.value);
        };

        const onMathSliderInput = () => {
            updateConstraints();
            const n = parseInt(nSlider.value);
            const l = parseInt(lSlider.value);
            const m = parseInt(mSlider.value);
            
            // If user manually changes slider, pause auto morph briefly or let it be overriden
            v.updatePattern(n, l, m);
        };

        this._addListener('nSlider_h', 'input', onMathSliderInput);
        this._addListener('lSlider_h', 'input', onMathSliderInput);
        this._addListener('mSlider_h', 'input', onMathSliderInput);

        // Auto-Morph Logic
        const manageAutoMorph = () => {
            if (this._autoMorphInterval) {
                clearInterval(this._autoMorphInterval);
                this._autoMorphInterval = null;
            }
            
            const isAuto = document.getElementById('autoMorph_h').checked;
            if (isAuto) {
                const speed = document.getElementById('morphSpeed_h').value;
                const duration = speed === 'slow' ? 2500 : 5000;
                // Add a small pause at the target before starting next morph
                const intervalTime = duration + 500;
                
                this._autoMorphInterval = setInterval(() => {
                    const n = Math.floor(Math.random() * 6) + 1; // 1 to 6
                    const l = Math.floor(Math.random() * n);     // 0 to n-1
                    const m = Math.floor(Math.random() * (2 * l + 1)) - l; // -l to l
                    
                    nSlider.value = n;
                    lSlider.value = l;
                    mSlider.value = m;
                    updateConstraints();
                    
                    v.updatePattern(n, l, m);
                }, intervalTime);
                
                // Immediately trigger first pick
                const n = Math.floor(Math.random() * 6) + 1;
                const l = Math.floor(Math.random() * n);
                const m = Math.floor(Math.random() * (2 * l + 1)) - l;
                nSlider.value = n; lSlider.value = l; mSlider.value = m;
                updateConstraints();
                v.updatePattern(n, l, m);
            }
        };

        this._addListener('autoMorph_h', 'change', manageAutoMorph);
        this._addListener('morphSpeed_h', 'change', () => {
            this._pushConfig();
            if (document.getElementById('autoMorph_h').checked) {
                manageAutoMorph(); // restart interval with new speed
            }
        });

        // Bind visual sliders
        const visualInputs = [
            'posGradType_h', 'posColor1_h', 'posColor2_h', 'posAngle_h',
            'negGradType_h', 'negColor1_h', 'negColor2_h', 'negAngle_h',
            'colorBg_h', 'exposureSlider_h', 'rotateColors_h'
        ];
        
        visualInputs.forEach(id => {
            this._addListener(id, 'input', (e) => {
                if (id === 'posAngle_h') document.getElementById('posAngleVal_h').textContent = e.target.value + '°';
                if (id === 'negAngle_h') document.getElementById('negAngleVal_h').textContent = e.target.value + '°';
                if (id === 'exposureSlider_h') document.getElementById('exposureVal_h').textContent = parseFloat(e.target.value).toFixed(1);
                this._pushConfig();
            });
            this._addListener(id, 'change', () => this._pushConfig());
        });

        this._addListener('aspectRatioSelect_h', 'change', (e) => {
            v.setAspectRatio(e.target.value);
        });

        this._addListener('downloadBtn_h', 'click', () => {
            const n = nSlider.value;
            const l = lSlider.value;
            const m = mSlider.value;
            v.exportToPNG(`hydrogen-n${n}-l${l}-m${m}.png`);
        });

        this._addListener('fullscreenBtn_h', 'click', () => {
             if (!document.fullscreenElement) {
                 document.documentElement.requestFullscreen().catch(err => {
                     console.error(`Error attempting to enable fullscreen: ${err.message}`);
                 });
             } else {
                 document.exitFullscreen();
             }
        });

        const angleUpdateHandler = (e) => {
            const posSlider = document.getElementById('posAngle_h');
            const negSlider = document.getElementById('negAngle_h');
            if (posSlider && negSlider) {
                posSlider.value = Math.floor(e.detail.pos);
                negSlider.value = Math.floor(e.detail.neg);
                document.getElementById('posAngleVal_h').textContent = posSlider.value + '°';
                document.getElementById('negAngleVal_h').textContent = negSlider.value + '°';
            }
        };
        window.addEventListener('hydrogenAngleUpdate', angleUpdateHandler);
        this._listeners.push({ el: window, eventName: 'hydrogenAngleUpdate', handler: angleUpdateHandler });

        // Animations
        document.querySelectorAll('.notion-btn').forEach(btn => {
            this._addListener(btn.id || btn.className, 'mousedown', () => animate(btn, { scale: 0.95 }, { duration: 0.1 }));
            this._addListener(btn.id || btn.className, 'mouseup', () => animate(btn, { scale: 1 }, { type: "spring", stiffness: 300, damping: 15 }));
            this._addListener(btn.id || btn.className, 'mouseleave', () => animate(btn, { scale: 1 }, { duration: 0.1 }));
        });
    },

    destroy() {
        if (this._updateTimeout) clearTimeout(this._updateTimeout);
        if (this._autoMorphInterval) clearInterval(this._autoMorphInterval);
        if (this._visualizer) {
            this._visualizer.destroy();
            this._visualizer = null;
        }

        this._listeners.forEach(({ el, eventName, handler }) => {
            el.removeEventListener(eventName, handler);
        });
        this._listeners = [];
    }
}
