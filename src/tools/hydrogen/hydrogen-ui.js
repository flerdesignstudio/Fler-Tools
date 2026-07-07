import { HydrogenVisualizer, CLASSIC_ORBITAL_PRESETS } from './visualizer.js';
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
                <h2 class="group-title">Classic Presets</h2>
                <div class="preset-grid" style="display:flex; flex-wrap:wrap; gap:6px;">
                    ${Object.keys(CLASSIC_ORBITAL_PRESETS).map(key =>
            `<button type="button" class="notion-btn notion-btn-secondary preset-btn" data-preset="${key}">${key}</button>`
        ).join('')}
                </div>
            </section>

            <hr class="separator" />

            <section class="control-group">
                <h2 class="group-title">Quantum Numbers</h2>
                <div class="slider-row">
                    <div class="slider-header">
                        <label for="nSlider_h">Principal (n)</label>
                        <span id="nVal_h" aria-live="polite">3</span>
                    </div>
                    <input type="range" id="nSlider_h" min="1" max="10" step="1" value="3" class="notion-slider">
                </div>
                <div class="slider-row">
                    <div class="slider-header">
                        <label for="lSlider_h">Azimuthal (l)</label>
                        <span id="lVal_h" aria-live="polite">0</span>
                    </div>
                    <input type="range" id="lSlider_h" min="0" max="9" step="1" value="0" class="notion-slider">
                </div>
                <div class="slider-row">
                    <div class="slider-header">
                        <label for="mSlider_h">Magnetic (m)</label>
                        <span id="mVal_h" aria-live="polite">0</span>
                    </div>
                    <input type="range" id="mSlider_h" min="0" max="0" step="1" value="0" class="notion-slider">
                </div>
            </section>



            <section class="control-group">
                <h2 class="group-title">Visuals</h2>

                <div class="color-grid">
                    <div class="color-item">
                        <label for="posColor_h">Positive Phase (+)</label>
                        <div class="color-wrapper"><input type="color" id="posColor_h" value="#000000"></div>
                    </div>
                    <div class="color-item">
                        <label for="negColor_h">Negative Phase (-)</label>
                        <div class="color-wrapper"><input type="color" id="negColor_h" value="#FF0000"></div>
                    </div>
                    <div class="color-item">
                        <label for="colorBg_h">Background</label>
                        <div class="color-wrapper"><input type="color" id="colorBg_h" value="#FFFFFF"></div>
                    </div>
                </div>

                <div class="slider-row" style="margin-top: 8px;">
                    <div class="slider-header">
                        <label for="particleAlpha_h">Point Opacity</label>
                        <span id="particleAlphaVal_h" aria-live="polite">0.65</span>
                    </div>
                    <input type="range" id="particleAlpha_h" min="0.05" max="1.0" step="0.05" value="0.65" class="notion-slider">
                </div>

                <label class="toggle-row" style="margin-top: 8px;">
                    <input type="checkbox" id="accumulate_h" class="notion-checkbox" checked>
                    <span>Accumulate (point-cloud statico)</span>
                </label>
                <button id="resetCanvasBtn_h" type="button" class="notion-btn notion-btn-secondary" style="margin-top: 8px;">Reset Canvas</button>
            </section>

            <hr class="separator" />

            <section class="control-group">
                <h2 class="group-title">Settings & Export</h2>
                <h3 class="sub-title" style="margin-top:0;">Aspect Ratio</h3>
                <div class="setting-row">
                    <select id="aspectRatioSelect_h" class="notion-select">
                        <option value="1:1">1:1 (Square)</option>
                        <option value="16:9">16:9 (Landscape)</option>
                        <option value="9:16">9:16 (Portrait)</option>
                        <option value="4:3">4:3 (Standard)</option>
                    </select>
                </div>
                <h3 class="sub-title">Sampling</h3>
                <div class="slider-row">
                    <div class="slider-header">
                        <label for="particleCount_h">Particle Count / Frame</label>
                        <span id="particleCountVal_h">2000</span>
                    </div>
                    <input type="range" id="particleCount_h" min="500" max="15000" step="500" value="2000" class="notion-slider">
                </div>
                <div class="slider-row">
                    <div class="slider-header">
                        <label for="rejectAttempts_h">Rejection Attempts</label>
                        <span id="rejectAttemptsVal_h">60</span>
                    </div>
                    <input type="range" id="rejectAttempts_h" min="20" max="300" step="10" value="60" class="notion-slider">
                    <p class="hint-text" style="font-size:11px; opacity:0.6; margin: 4px 0 0;">Raise if the outer shells (n top) remain sparse</p>
                </div>
                <div class="slider-row">
                    <div class="slider-header">
                        <label for="particleSize_h">Size</label>
                        <span id="particleSizeVal_h">0.7</span>
                    </div>
                    <input type="range" id="particleSize_h" min="0.3" max="5" step="0.1" value="0.7" class="notion-slider">
                </div>
                <div class="slider-row" style="margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(0,0,0,0.05);">
                    <div class="slider-header">
                        <label for="svgOpt_h">SVG Export Optimization</label>
                        <span id="svgOptVal_h">Aggressive (Lightest)</span>
                    </div>
                    <input type="range" id="svgOpt_h" min="1" max="4" step="1" value="3" class="notion-slider">
                    <p class="hint-text" style="font-size:11px; opacity:0.6; margin: 4px 0 0;">1 = Max Detail (Heavy), 4 = Ultra Aggressive (Lightest)</p>
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

        // Premium staggered entrance (1/3 rule compliance)
        animate(".control-group", { opacity: [0, 1], x: [-15, 0] }, { delay: stagger(0.08), duration: 0.4, easing: [0.4, 0, 0.2, 1] });
        // Canvas entrance (emphasized entrance)
        animate("#hydrogen_visualizer", { opacity: [0, 1], scale: [0.97, 1] }, { duration: 0.5, easing: [0.05, 0.7, 0.1, 1] });

        const canvas = document.getElementById('hydrogen_visualizer');
        this._visualizer = new HydrogenVisualizer(canvas);

        this._pushConfig();
        this._bindEvents();
    },

    // Invia SOLO le chiavi che il motore attuale conosce davvero.
    // (posGradType / posColor2 / negColor* / exposure / coreParticles /
    // edgeParticles non esistono più: non fatevi ingannare da vecchie
    // versioni di questo file, il motore ora è single-population reject-sampling.)
    _pushConfig() {
        if (!this._visualizer) return;
        this._visualizer.updateConfig({
            bgColor: document.getElementById('colorBg_h').value,
            posColor: document.getElementById('posColor_h').value,
            negColor: document.getElementById('negColor_h').value,
            particleAlpha: parseFloat(document.getElementById('particleAlpha_h').value),
            accumulate: document.getElementById('accumulate_h').checked,
            maxRejectAttempts: parseInt(document.getElementById('rejectAttempts_h').value),
            particleSize: parseFloat(document.getElementById('particleSize_h').value),
            svgOptimization: parseInt(document.getElementById('svgOpt_h').value)
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

            v.updatePattern(n, l, m);
        };

        this._addListener('nSlider_h', 'input', onMathSliderInput);
        this._addListener('lSlider_h', 'input', onMathSliderInput);
        this._addListener('mSlider_h', 'input', onMathSliderInput);

        // Preset buttons: i pannelli classici 1s/2s/2p0/3s/3p0/3d0 (m=0 sempre)
        document.querySelectorAll('.preset-btn').forEach((btn, idx) => {
            if (!btn.id) btn.id = `presetBtn_${idx}_h`;
            this._addListener(btn.id, 'click', () => {
                const key = btn.dataset.preset;
                const { n, l, m } = CLASSIC_ORBITAL_PRESETS[key];
                nSlider.value = n;
                lSlider.value = l;
                updateConstraints();
                mSlider.value = m;
                updateConstraints();
                v.updatePattern(n, l, m);
            });
        });

        // Bind visual inputs
        const visualInputs = ['posColor_h', 'negColor_h', 'colorBg_h', 'accumulate_h'];
        visualInputs.forEach(id => {
            this._addListener(id, 'input', () => this._pushConfig());
            this._addListener(id, 'change', () => this._pushConfig());
        });

        this._addListener('particleAlpha_h', 'input', (e) => {
            document.getElementById('particleAlphaVal_h').textContent = parseFloat(e.target.value).toFixed(2);
            this._pushConfig();
        });

        this._addListener('rejectAttempts_h', 'input', (e) => {
            document.getElementById('rejectAttemptsVal_h').textContent = e.target.value;
            this._pushConfig();
        });

        this._addListener('particleCount_h', 'input', (e) => {
            document.getElementById('particleCountVal_h').textContent = e.target.value;
            v.updateParticleCount(parseInt(e.target.value));
        });

        this._addListener('particleSize_h', 'input', (e) => {
            document.getElementById('particleSizeVal_h').textContent = parseFloat(e.target.value).toFixed(1);
            v.updateConfig({ particleSize: parseFloat(e.target.value) });
        });

        this._addListener('svgOpt_h', 'input', (e) => {
            const labels = { 1: 'Max Detail', 2: 'Balanced', 3: 'Aggressive', 4: 'Ultra Aggressive' };
            document.getElementById('svgOptVal_h').textContent = labels[e.target.value] || e.target.value;
            this._pushConfig();
        });

        this._addListener('resetCanvasBtn_h', 'click', () => {
            v.resetAccumulation();
        });

        this._addListener('aspectRatioSelect_h', 'change', (e) => {
            v.setAspectRatio(e.target.value);
        });

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