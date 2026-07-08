import { OscilloscopeVisualizer } from './visualizer.js';
import { animate, stagger, spring } from 'motion';

export default {
    id: 'oscilloscope',
    label: 'Oscilloscope',
    icon: '∿',
    
    _visualizer: null,
    _listeners: [], 

    getSidebarHTML() {
        return `
            <section class="control-group">
                <h2 class="group-title">Lissajous Parameters</h2>
                <div class="setting-row">
                    <label>Freq Mode</label>
                    <select id="oscFreqMode" class="notion-select">
                        <option value="integer">Integer (Stable Loops)</option>
                        <option value="decimal">Decimal (Evolving)</option>
                    </select>
                </div>
                <div class="slider-row">
                    <div class="slider-header">
                        <label for="oscFreqX">X Frequency (a)</label>
                        <span id="oscFreqXVal" aria-live="polite">3</span>
                    </div>
                    <input type="range" id="oscFreqX" min="0.1" max="10" step="0.1" value="3" class="notion-slider">
                </div>
                <div class="slider-row">
                    <div class="slider-header">
                        <label for="oscFreqY">Y Frequency (b)</label>
                        <span id="oscFreqYVal" aria-live="polite">2</span>
                    </div>
                    <input type="range" id="oscFreqY" min="0.1" max="10" step="0.1" value="2" class="notion-slider">
                </div>
                <div class="slider-row">
                    <div class="slider-header">
                        <label for="oscAmpX">X Amplitude</label>
                        <span id="oscAmpXVal" aria-live="polite">150</span>
                    </div>
                    <input type="range" id="oscAmpX" min="0" max="400" step="5" value="150" class="notion-slider">
                </div>
                <div class="slider-row">
                    <div class="slider-header">
                        <label for="oscAmpY">Y Amplitude</label>
                        <span id="oscAmpYVal" aria-live="polite">150</span>
                    </div>
                    <input type="range" id="oscAmpY" min="0" max="400" step="5" value="150" class="notion-slider">
                </div>
                <div class="slider-row">
                    <div class="slider-header">
                        <label for="oscPhase">Phase (Δ)</label>
                        <span id="oscPhaseVal" aria-live="polite">0</span>
                    </div>
                    <input type="range" id="oscPhase" min="0" max="2" step="0.05" value="0" class="notion-slider">
                </div>
                <div class="slider-row">
                    <div class="slider-header">
                        <label for="oscSpeed">Scroll Speed</label>
                        <span id="oscSpeedVal" aria-live="polite">1</span>
                    </div>
                    <input type="range" id="oscSpeed" min="-5" max="5" step="0.1" value="1" class="notion-slider">
                </div>
                
                <div style="display: flex; gap: 8px; margin-top: 12px;">
                    <button id="oscPlayBtn" class="notion-btn notion-btn-secondary" style="flex: 1;">
                        <span class="material-symbols-outlined" style="font-size: 18px;">pause</span>
                        <span id="oscPlayBtnText">Pause</span>
                    </button>
                </div>
            </section>
            <hr class="separator" />
            <section class="control-group">
                <h2 class="group-title">Visuals & Colors</h2>
                <div class="setting-row">
                    <label>Theme Preset</label>
                    <select id="oscThemeSelect" class="notion-select">
                        <option value="classic">Classic Green</option>
                        <option value="neon">Neon Blue</option>
                        <option value="warm">Warm Retro</option>
                        <option value="custom">Custom</option>
                    </select>
                </div>
                <h3 class="sub-title">Particles (Thickness)</h3>
                <div class="color-grid">
                    <div class="color-item">
                        <label for="oscColor1">Color 1</label>
                        <div class="color-wrapper"><input type="color" id="oscColor1" value="#39FF14"></div>
                    </div>
                    <div class="color-item">
                        <label for="oscColor2">Color 2</label>
                        <div class="color-wrapper"><input type="color" id="oscColor2" value="#39FF14"></div>
                    </div>
                </div>
                <label class="toggle-row">
                    <input type="checkbox" id="oscUseGradient" class="notion-checkbox">
                    <span>Particle Gradient</span>
                </label>
                <h3 class="sub-title">Background</h3>
                <div class="color-grid">
                    <div class="color-item">
                        <label for="oscBgTrail">Background</label>
                        <div class="color-wrapper"><input type="color" id="oscBgTrail" value="#000000"></div>
                    </div>
                </div>
            </section>
            <hr class="separator" />
            <section class="control-group">
                <h2 class="group-title">Settings & Export</h2>
                <h3 class="sub-title">Aspect Ratio</h3>
                <div class="setting-row">
                    <select id="oscAspectRatioSelect" class="notion-select">
                        <option value="1:1" selected>1:1 (Square)</option>
                        <option value="16:9">16:9 (Landscape)</option>
                        <option value="9:16">9:16 (Portrait)</option>
                        <option value="4:3">4:3 (Standard)</option>
                    </select>
                </div>
                <h3 class="sub-title">Density & Size</h3>
                <div class="slider-row">
                    <div class="slider-header">
                        <label for="oscParticleCount">Thickness (Count)</label>
                        <span id="oscParticleCountVal">2000</span>
                    </div>
                    <input type="range" id="oscParticleCount" min="500" max="10000" step="500" value="2000" class="notion-slider">
                </div>
                <div class="slider-row">
                    <div class="slider-header">
                        <label for="oscParticleSize">Particle Size</label>
                        <span id="oscParticleSizeVal">1.5</span>
                    </div>
                    <input type="range" id="oscParticleSize" min="0.5" max="10" step="0.5" value="1.5" class="notion-slider">
                </div>
                <div style="margin-top: 16px; display: flex; flex-direction: column; gap: 8px;">
                </div>
            </section>
        `;
    },

    getMainHTML() {
        return `<canvas id="oscVisualizer" role="img" aria-label="Animated Lissajous pattern"></canvas>`;
    },

    _addListener(elementId, eventName, handler) {
        const el = document.getElementById(elementId);
        if (el) {
            el.addEventListener(eventName, handler);
            this._listeners.push({ el, eventName, handler });
        }
    },

    init(sidebarContainer, mainContainer) {
        // Mount HTML
        sidebarContainer.innerHTML = this.getSidebarHTML();
        mainContainer.innerHTML = this.getMainHTML();

        // Premium staggered entrance (1/3 rule compliance)
        animate(".control-group", { opacity: [0, 1], x: [-15, 0] }, { delay: stagger(0.08), duration: 0.4, easing: [0.4, 0, 0.2, 1] });
        // Canvas entrance (emphasized entrance)
        animate("#oscVisualizer", { opacity: [0, 1], scale: [0.97, 1] }, { duration: 0.5, easing: [0.05, 0.7, 0.1, 1] });

        // Initialize Logic
        const canvas = document.getElementById('oscVisualizer');
        this._visualizer = new OscilloscopeVisualizer(canvas);

        this._bindEvents();
    },

    _bindEvents() {
        const v = this._visualizer;
        
        const updateConfig = (key, value) => {
            v.updateConfig({ [key]: value });
        };

        this._addListener('oscFreqMode', 'change', (e) => {
            updateConfig('freqMode', e.target.value);
            // In case we switch to integer mode, update frequencies to apply rounding visually
            const freqX = document.getElementById('oscFreqX').value;
            const freqY = document.getElementById('oscFreqY').value;
            updateConfig('freqX', parseFloat(freqX));
            updateConfig('freqY', parseFloat(freqY));
        });
        
        const paramMap = {
            'FreqX': 'freqX',
            'FreqY': 'freqY',
            'AmpX': 'ampX',
            'AmpY': 'ampY',
            'Phase': 'phase',
            'Speed': 'speed'
        };

        ['FreqX', 'FreqY', 'AmpX', 'AmpY', 'Phase', 'Speed'].forEach(param => {
            const id = `osc${param}`;
            this._addListener(id, 'input', (e) => {
                document.getElementById(`${id}Val`).textContent = e.target.value;
                updateConfig(paramMap[param], parseFloat(e.target.value));
            });
        });

        this._addListener('oscPlayBtn', 'click', () => {
            v.togglePlay();
            document.getElementById('oscPlayBtnText').textContent = v.isPlaying ? 'Pause' : 'Play';
            const iconSpan = document.getElementById('oscPlayBtn').querySelector('.material-symbols-outlined');
            if (iconSpan) iconSpan.textContent = v.isPlaying ? 'pause' : 'play_arrow';
        });

        this._addListener('oscAspectRatioSelect', 'change', (e) => {
            v.setAspectRatio(e.target.value);
        });

        // Setup theme events
        const themes = {
            classic: { color1: '#39FF14', color2: '#39FF14', trail: '#000000', useGradient: false },
            neon: { color1: '#00FFFF', color2: '#0088FF', trail: '#000510', useGradient: true },
            warm: { color1: '#FF9900', color2: '#FF3300', trail: '#110500', useGradient: true }
        };

        const updateDisabledStates = () => {
            const useGrad = document.getElementById('oscUseGradient').checked;
            document.getElementById('oscColor2').closest('.color-item').classList.toggle('disabled', !useGrad);
        };

        const updateVisualizerColors = () => {
            v.updateConfig({
                particleColor1: document.getElementById('oscColor1').value,
                particleColor2: document.getElementById('oscColor2').value,
                trailColor: document.getElementById('oscBgTrail').value,
                useGradient: document.getElementById('oscUseGradient').checked
            });
            updateDisabledStates();
        };

        // Initial setup
        updateDisabledStates();

        this._addListener('oscThemeSelect', 'change', (e) => {
            const t = themes[e.target.value];
            if (t) {
                document.getElementById('oscColor1').value = t.color1;
                document.getElementById('oscColor2').value = t.color2;
                document.getElementById('oscBgTrail').value = t.trail;
                document.getElementById('oscUseGradient').checked = t.useGradient;
                updateVisualizerColors();
            }
        });

        ['oscColor1', 'oscColor2', 'oscBgTrail'].forEach(id => {
            this._addListener(id, 'input', () => {
                document.getElementById('oscThemeSelect').value = 'custom';
                updateVisualizerColors();
            });
        });
        
        this._addListener('oscUseGradient', 'change', () => {
            document.getElementById('oscThemeSelect').value = 'custom';
            updateVisualizerColors();
        });

        this._addListener('oscParticleCount', 'change', (e) => {
            v.updateParticleCount(parseInt(e.target.value));
        });
        
        this._addListener('oscParticleCount', 'input', (e) => {
            document.getElementById('oscParticleCountVal').textContent = e.target.value;
        });

        this._addListener('oscParticleSize', 'input', (e) => {
            document.getElementById('oscParticleSizeVal').textContent = e.target.value;
            v.updateConfig({ particleSize: parseFloat(e.target.value) });
            if (!v.isPlaying) v.animate(true);
        });
        
        // Setup interactive button animations
        document.querySelectorAll('.notion-btn').forEach(btn => {
            this._addListener(btn.id || btn.className, 'mousedown', () => animate(btn, { scale: 0.95 }, { duration: 0.1 }));
            this._addListener(btn.id || btn.className, 'mouseup', () => animate(btn, { scale: 1 }, { type: "spring", stiffness: 300, damping: 15 }));
            this._addListener(btn.id || btn.className, 'mouseleave', () => animate(btn, { scale: 1 }, { duration: 0.1 }));
        });
    },

    destroy() {
        if (this._visualizer) {
            this._visualizer.destroy();
            this._visualizer = null;
        }

        // Cleanup DOM listeners to prevent memory leaks during navigation
        this._listeners.forEach(({ el, eventName, handler }) => {
            el.removeEventListener(eventName, handler);
        });
        this._listeners = [];
    }
}
