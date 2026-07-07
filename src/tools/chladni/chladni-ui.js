import { ChladniVisualizer } from './visualizer.js';
import { animate, stagger, spring } from 'motion';

export default {
    id: 'chladni',
    label: 'Chladni',
    icon: '◈',
    
    _visualizer: null,
    _listeners: [], // to store { element, event, handler } for easy cleanup

    getSidebarHTML() {
        return `
            <section class="control-group">
                <h2 class="group-title">Pattern Math</h2>
                <div class="slider-row">
                    <div class="slider-header">
                        <label for="nSlider">N Parameter</label>
                        <span id="nVal" aria-live="polite">3</span>
                    </div>
                    <input type="range" id="nSlider" min="1" max="20" step="1" value="3" class="notion-slider">
                </div>
                <div class="slider-row">
                    <div class="slider-header">
                        <label for="mSlider">M Parameter</label>
                        <span id="mVal" aria-live="polite">5</span>
                    </div>
                    <input type="range" id="mSlider" min="1" max="20" step="1" value="5" class="notion-slider">
                </div>
                <label class="toggle-row">
                    <input type="checkbox" id="variantToggle" class="notion-checkbox">
                    <span>Variant (Addition Formula)</span>
                </label>
                <div style="display: flex; gap: 8px;">
                    <button id="togglePlayBtn" class="notion-btn notion-btn-secondary" style="flex: 1;">
                        <span class="material-symbols-outlined" style="font-size: 18px;">pause</span>
                        <span id="playBtnText">Pause</span>
                    </button>
                    <button id="randomizeBtn" class="notion-btn notion-btn-secondary" style="flex: 1;">
                        <span class="material-symbols-outlined" style="font-size: 18px;">shuffle</span>
                        Random
                    </button>
                </div>
            </section>
            <hr class="separator" />
            <section class="control-group">
                <h2 class="group-title">Visuals & Colors</h2>
                <div class="setting-row">
                    <label>Theme Preset</label>
                    <select id="themeSelect" class="notion-select">
                        <option value="neon">Neon</option>
                        <option value="fire">Fire</option>
                        <option value="ocean">Ocean</option>
                        <option value="forest">Forest</option>
                        <option value="custom">Custom</option>
                    </select>
                </div>
                <h3 class="sub-title">Particles</h3>
                <div class="color-grid">
                    <div class="color-item">
                        <label for="color1">Color 1</label>
                        <div class="color-wrapper"><input type="color" id="color1" value="#39FF14"></div>
                    </div>
                    <div class="color-item">
                        <label for="color2">Color 2</label>
                        <div class="color-wrapper"><input type="color" id="color2" value="#00FFFF"></div>
                    </div>
                </div>
                <label class="toggle-row">
                    <input type="checkbox" id="useGradient" class="notion-checkbox" checked>
                    <span>Particle Gradient</span>
                </label>
                <h3 class="sub-title">Background</h3>
                <div class="color-grid">
                    <div class="color-item">
                        <label for="bgGradStart">Start</label>
                        <div class="color-wrapper"><input type="color" id="bgGradStart" value="#000000"></div>
                    </div>
                    <div class="color-item">
                        <label for="bgGradEnd">End</label>
                        <div class="color-wrapper"><input type="color" id="bgGradEnd" value="#1a1a2e"></div>
                    </div>
                    <div class="color-item">
                        <label for="bgTrail">Solid Mode</label>
                        <div class="color-wrapper"><input type="color" id="bgTrail" value="#000a00"></div>
                    </div>
                </div>
                <label class="toggle-row">
                    <input type="checkbox" id="useBgGradient" class="notion-checkbox">
                    <span>Background Gradient</span>
                </label>
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
                <h3 class="sub-title">Density & Size</h3>
                <div class="slider-row">
                    <div class="slider-header">
                        <label for="particleCount">Count</label>
                        <span id="particleCountVal">2000</span>
                    </div>
                    <input type="range" id="particleCount" min="500" max="8000" step="100" value="2000" class="notion-slider">
                    <span id="particleWarning" class="status-msg" style="margin-bottom: 8px;">Recommended</span>
                </div>
                <div class="slider-row">
                    <div class="slider-header">
                        <label for="particleSize">Size</label>
                        <span id="particleSizeVal">1.5</span>
                    </div>
                    <input type="range" id="particleSize" min="0.5" max="10" step="0.5" value="1.5" class="notion-slider">
                </div>
                <div style="margin-top: 16px; display: flex; flex-direction: column; gap: 8px;">
                </div>
            </section>
        `;
    },

    getMainHTML() {
        return `<canvas id="visualizer" role="img" aria-label="Animated Chladni pattern"></canvas>`;
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
        animate("#visualizer", { opacity: [0, 1], scale: [0.97, 1] }, { duration: 0.5, easing: [0.05, 0.7, 0.1, 1] });

        // Initialize Logic
        const canvas = document.getElementById('visualizer');
        this._visualizer = new ChladniVisualizer(canvas);

        this._bindEvents();
    },

    _bindEvents() {
        const v = this._visualizer;
        const nSlider = document.getElementById('nSlider');
        const mSlider = document.getElementById('mSlider');
        const variantToggle = document.getElementById('variantToggle');

        const updatePatternFromUI = () => {
            v.updatePattern(parseInt(nSlider.value), parseInt(mSlider.value), variantToggle.checked ? 1 : 0);
        };

        this._addListener('nSlider', 'input', (e) => {
            document.getElementById('nVal').textContent = e.target.value;
            updatePatternFromUI();
            v.initParticles();
        });

        this._addListener('mSlider', 'input', (e) => {
            document.getElementById('mVal').textContent = e.target.value;
            updatePatternFromUI();
            v.initParticles();
        });

        this._addListener('variantToggle', 'change', () => {
            updatePatternFromUI();
            v.initParticles();
        });

        this._addListener('randomizeBtn', 'click', () => {
            nSlider.value = Math.floor(Math.random() * 10) + 1;
            mSlider.value = Math.floor(Math.random() * 10) + 1;
            document.getElementById('nVal').textContent = nSlider.value;
            document.getElementById('mVal').textContent = mSlider.value;
            variantToggle.checked = Math.random() > 0.5;
            updatePatternFromUI();
            v.initParticles();
            
            if (!v.isPlaying) {
                v.isPlaying = true;
                document.getElementById('playBtnText').textContent = 'Pause';
                const iconSpan = document.getElementById('togglePlayBtn').querySelector('.material-symbols-outlined');
                if (iconSpan) iconSpan.textContent = 'pause';
                v.animate();
            }
        });

        this._addListener('togglePlayBtn', 'click', () => {
            v.togglePlay();
            document.getElementById('playBtnText').textContent = v.isPlaying ? 'Pause' : 'Play';
            const iconSpan = document.getElementById('togglePlayBtn').querySelector('.material-symbols-outlined');
            if (iconSpan) iconSpan.textContent = v.isPlaying ? 'pause' : 'play_arrow';
        });

        this._addListener('aspectRatioSelect', 'change', (e) => {
            v.setAspectRatio(e.target.value);
        });

        // Setup theme events
        const themes = {
            neon: { color1: '#39FF14', color2: '#00FFFF', trail: '#000a00', useGradient: true, bgGradStart: '#000000', bgGradEnd: '#1a1a2e', useBgGradient: false },
            fire: { color1: '#FF4500', color2: '#FFD700', trail: '#1a0500', useGradient: true, bgGradStart: '#200500', bgGradEnd: '#501000', useBgGradient: true },
            ocean: { color1: '#00BFFF', color2: '#7FFFD4', trail: '#001020', useGradient: true, bgGradStart: '#000510', bgGradEnd: '#002040', useBgGradient: true },
            forest: { color1: '#228B22', color2: '#ADFF2F', trail: '#051a05', useGradient: true, bgGradStart: '#051005', bgGradEnd: '#102e10', useBgGradient: true }
        };

        const updateVisualizerConfig = () => {
            v.updateConfig({
                particleColor1: document.getElementById('color1').value,
                particleColor2: document.getElementById('color2').value,
                trailColor: document.getElementById('bgTrail').value,
                useGradient: document.getElementById('useGradient').checked,
                bgGradStart: document.getElementById('bgGradStart').value,
                bgGradEnd: document.getElementById('bgGradEnd').value,
                useBgGradient: document.getElementById('useBgGradient').checked
            });
        };

        this._addListener('themeSelect', 'change', (e) => {
            const t = themes[e.target.value];
            if (t) {
                document.getElementById('color1').value = t.color1;
                document.getElementById('color2').value = t.color2;
                document.getElementById('bgTrail').value = t.trail;
                document.getElementById('useGradient').checked = t.useGradient;
                document.getElementById('bgGradStart').value = t.bgGradStart;
                document.getElementById('bgGradEnd').value = t.bgGradEnd;
                document.getElementById('useBgGradient').checked = t.useBgGradient;
                updateVisualizerConfig();
            }
        });

        ['color1', 'color2', 'bgTrail', 'bgGradStart', 'bgGradEnd'].forEach(id => {
            this._addListener(id, 'input', () => {
                document.getElementById('themeSelect').value = 'custom';
                updateVisualizerConfig();
            });
        });
        ['useGradient', 'useBgGradient'].forEach(id => {
            this._addListener(id, 'change', () => {
                document.getElementById('themeSelect').value = 'custom';
                updateVisualizerConfig();
            });
        });

        this._addListener('particleCount', 'change', (e) => {
            v.updateParticleCount(parseInt(e.target.value));
        });
        
        this._addListener('particleCount', 'input', (e) => {
            document.getElementById('particleCountVal').textContent = e.target.value;
        });

        this._addListener('particleSize', 'input', (e) => {
            document.getElementById('particleSizeVal').textContent = e.target.value;
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
