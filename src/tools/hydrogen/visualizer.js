import { showLargeExportWarning } from '../../utils/export-warning.js';

// Math helpers for Hydrogen Wavefunctions

function laguerre(k, alpha, x) {
    if (k === 0) return 1;
    if (k === 1) return 1 + alpha - x;

    let Lk_minus_2 = 1;
    let Lk_minus_1 = 1 + alpha - x;
    let Lk = 0;

    for (let i = 1; i < k; i++) {
        Lk = ((2 * i + 1 + alpha - x) * Lk_minus_1 - (i + alpha) * Lk_minus_2) / (i + 1);
        Lk_minus_2 = Lk_minus_1;
        Lk_minus_1 = Lk;
    }
    return Lk;
}

function legendre(l, m, x) {
    m = Math.abs(m);

    let p_mm = 1;
    if (m > 0) {
        let somx2 = Math.sqrt(Math.max(0, (1.0 - x) * (1.0 + x)));
        let fact = 1.0;
        for (let i = 1; i <= m; i++) {
            p_mm *= -fact * somx2;
            fact += 2.0;
        }
    }
    if (l === m) return p_mm;

    let p_mp1 = x * (2.0 * m + 1.0) * p_mm;
    if (l === m + 1) return p_mp1;

    let p_ll = 0;
    let p_ll_minus_2 = p_mm;
    let p_ll_minus_1 = p_mp1;

    for (let i = m + 2; i <= l; i++) {
        p_ll = ((2.0 * i - 1.0) * x * p_ll_minus_1 - (i + m - 1.0) * p_ll_minus_2) / (i - m);
        p_ll_minus_2 = p_ll_minus_1;
        p_ll_minus_1 = p_ll;
    }

    return p_ll;
}

const hexToRgb = (hex) => {
    if (!hex) return [0, 0, 0];
    const cleanHex = String(hex).replace('#', '');
    if (cleanHex.length === 3) {
        return [
            parseInt(cleanHex[0] + cleanHex[0], 16),
            parseInt(cleanHex[1] + cleanHex[1], 16),
            parseInt(cleanHex[2] + cleanHex[2], 16)
        ];
    }
    if (cleanHex.length >= 6) {
        return [
            parseInt(cleanHex.slice(0, 2), 16),
            parseInt(cleanHex.slice(2, 4), 16),
            parseInt(cleanHex.slice(4, 6), 16)
        ];
    }
    return [0, 0, 0];
};

function interpolateHexColors(c1, c2, t) {
    const rgb1 = hexToRgb(c1);
    const rgb2 = hexToRgb(c2);
    const r = Math.round(rgb1[0] + (rgb2[0] - rgb1[0]) * t);
    const g = Math.round(rgb1[1] + (rgb2[1] - rgb1[1]) * t);
    const b = Math.round(rgb1[2] + (rgb2[2] - rgb1[2]) * t);
    return `rgb(${r}, ${g}, ${b})`;
}

// Preset dei 6 orbitali classici del poster/manuale (nota: m=0 per tutti,
// il pedice "0" in 2p0, 3p0, 3d0 significa proprio questo — non m=1)
export const CLASSIC_ORBITAL_PRESETS = {
    '1s': { n: 1, l: 0, m: 0 },
    '2s': { n: 2, l: 0, m: 0 },
    '2p0': { n: 2, l: 1, m: 0 },
    '3s': { n: 3, l: 0, m: 0 },
    '3p0': { n: 3, l: 1, m: 0 },
    '3d0': { n: 3, l: 2, m: 0 }
};

export class HydrogenVisualizer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = this.canvas.getContext('2d');

        // State
        this.params = { n: 3, l: 0, m: 0 };

        // Morphing State
        this.isMorphing = false;
        this.morphStartTime = 0;
        this.morphDuration = 2000;

        // Caches for max wavefunction density (estimated on a coarse grid)
        this.maxPsiSq = 1;
        this.maxPsiSqTarget = 1;

        this.particles = [];
        this.numParticles = 2000;
        this.needsClear = true;
        this.accumulatedFrames = 0;
        this.accumulatedParticles = [];
        this.maxAccumulateFrames = 150;

        this.config = {
            bgColor: '#000000',
            particleSize: 0.7,
            particleAlpha: 0.65,

            samplingMode: 'reject',
            maxRejectAttempts: 60,
            respawnFraction: 1.0,

            accumulate: true,

            posColor: '#39FF14',
            negColor: '#8800FF',

            rotateColors: false,
            rotationSpeed: 0.5,

            autoMorph: false,
            morphSpeed: 'slow'
        };

        this.aspectRatio = '1:1';
        this.animationFrameId = null;
        this.isPlaying = true;
        this.speed = 1.0;
        this.qualityMultiplier = 1.0;

        this.resize();
        
        // Initial estimate of max density
        this.maxPsiSq = this._computeMaxPsiSq(this.params.n, this.params.l, this.params.m);
        this.initParticles();
        this.animate();
    }

    play() {
        if (!this.isPlaying) {
            this.isPlaying = true;
            this.animate();
        }
    }

    pause() {
        this.isPlaying = false;
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    restart() {
        this.resetAccumulation();
        this.initParticles();
    }

    setLoop(loop) {
        this.isLooping = loop;
    }

    setSpeed(speed) {
        this.speed = speed;
    }

    resetAccumulation() {
        this.needsClear = true;
        this.accumulatedFrames = 0;
        this.accumulatedParticles = [];
    }

    setAspectRatio(ratioStr) {
        this.aspectRatio = ratioStr;
        this.resize();
        this.isMorphing = false;
    }

    setQuality(qualityStr) {
        if (qualityStr === 'Low') this.qualityMultiplier = 0.25;
        else if (qualityStr === 'Med') this.qualityMultiplier = 0.5;
        else this.qualityMultiplier = 1.0;
        this.resize();
    }

    updatePattern(n, l, m) {
        if (n === this.params.n && l === this.params.l && m === this.params.m) return;

        // Con rejection sampling non ha senso "fondere" due distribuzioni
        // indipendenti punto per punto (non è come un blend di posizioni
        // continue di un random walk): switch diretto + reset dell'accumulo.
        this.params = { n, l, m };
        this.maxPsiSq = this._computeMaxPsiSq(n, l, m);
        this.resetAccumulation();
        this.isMorphing = false;
    }

    finalizePattern() {
        // Unused
    }

    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        this.resetAccumulation();
    }

    resize() {
        const ratios = {
            '1:1': { w: 1000, h: 1000 },
            '16:9': { w: 1600, h: 900 },
            '9:16': { w: 900, h: 1600 },
            '4:3': { w: 1200, h: 900 }
        };

        const baseDims = ratios[this.aspectRatio] || ratios['1:1'];

        this.canvas.width = Math.round(baseDims.w * this.qualityMultiplier);
        this.canvas.height = Math.round(baseDims.h * this.qualityMultiplier);
        this.canvas.style.aspectRatio = `${baseDims.w} / ${baseDims.h}`;
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        this.canvas.style.objectFit = 'contain';

        if (this.particles.length > 0) {
            this.initParticles();
        }
    }

    initParticles() {
        this.particles = [];
        this.resetAccumulation();
        const w = this.canvas.width;
        const h = this.canvas.height;

        for (let i = 0; i < this.numParticles; i++) {
            let p = { x: Math.random() * w, y: Math.random() * h, psi: 0 };
            p = this.rejectionSample(w, h, 200, p);
            this.particles.push(p);
        }
    }

    updateParticleCount(count) {
        this.numParticles = count;
        this.initParticles();
    }

    _computeMaxPsiSq(n, l, m) {
        const w = 80;
        const h = 80;
        const maxR = 2.0 * n * n + 5.0;
        const physScale = 2.0 * maxR / Math.min(w, h);
        const m_abs = Math.abs(m);

        const values = [];
        for (let py = 0; py < h; py++) {
            const z = -(py - h / 2) * physScale;
            for (let px = 0; px < w; px++) {
                const x = (px - w / 2) * physScale;
                const r = Math.sqrt(x * x + z * z);

                let psi = 0;
                if (r > 0) {
                    const costheta = z / r;
                    const r_scaled = 2.0 * r / n;
                    const R_part = Math.exp(-r / n) * Math.pow(r_scaled, l) * laguerre(n - l - 1, 2 * l + 1, r_scaled);
                    const Y_part = legendre(l, m_abs, costheta);
                    psi = R_part * Y_part;
                } else if (l === 0) {
                    psi = laguerre(n - 1, 1, 0);
                }
                const psiSq = psi * psi;
                if (psiSq > 0.000001) {
                    values.push(psiSq);
                }
            }
        }
        if (values.length === 0) return 1;
        values.sort((a, b) => a - b);
        const p98Index = Math.floor(values.length * 0.98);
        const p98 = values[p98Index] || values[values.length - 1];
        return Math.max(p98, 0.0001);
    }

    getPsiAt(px, py, n, l, m) {
        const w = this.canvas.width;
        const h = this.canvas.height;
        const maxR = 2.0 * n * n + 5.0;
        const physScale = 2.0 * maxR / Math.min(w, h);
        const m_abs = Math.abs(m);

        const x = (px - w / 2) * physScale;
        const z = -(py - h / 2) * physScale;
        const r = Math.sqrt(x * x + z * z);

        let psi = 0;
        if (r > 0) {
            const costheta = z / r;
            const r_scaled = 2.0 * r / n;

            const R_part = Math.exp(-r / n) * Math.pow(r_scaled, l) * laguerre(n - l - 1, 2 * l + 1, r_scaled);
            const Y_part = legendre(l, m_abs, costheta);

            const sign = (x < 0 && m_abs % 2 !== 0) ? -1 : 1;
            psi = R_part * Y_part * sign;
        } else if (l === 0) {
            psi = laguerre(n - 1, 1, 0);
        }
        return psi;
    }

    getPsiBlendAt(px, py) {
        if (this.isMorphing) {
            const elapsed = performance.now() - this.morphStartTime;
            let t = elapsed / this.morphDuration;
            if (t >= 1.0) {
                t = 1.0;
            }
            const blend = Math.sin(t * Math.PI / 2);
            const cosBlend = Math.cos(t * Math.PI / 2);

            const psi1 = this.getPsiAt(px, py, this.params.n, this.params.l, this.params.m);
            const psi2 = this.getPsiAt(px, py, this.targetParams.n, this.targetParams.l, this.targetParams.m);
            return cosBlend * psi1 + blend * psi2;
        } else {
            return this.getPsiAt(px, py, this.params.n, this.params.l, this.params.m);
        }
    }

    createCanvasStyle(type, color1, color2, angleDeg, binIndex = 0, numBins = 10) {
        if (type === 'density') {
            const t = binIndex / (numBins - 1);
            return interpolateHexColors(color2, color1, t);
        }
        if (type === 'solid') {
            return color1;
        }
        const w = this.canvas.width;
        const h = this.canvas.height;
        if (type === 'linear') {
            const angleRad = angleDeg * Math.PI / 180;
            const r = Math.sqrt(w * w + h * h) / 2;
            const cx = w / 2;
            const cy = h / 2;
            const x1 = cx - r * Math.cos(angleRad);
            const y1 = cy - r * Math.sin(angleRad);
            const x2 = cx + r * Math.cos(angleRad);
            const y2 = cy + r * Math.sin(angleRad);
            const grad = this.ctx.createLinearGradient(x1, y1, x2, y2);
            grad.addColorStop(0, color1);
            grad.addColorStop(1, color2);
            return grad;
        }
        if (type === 'radial') {
            const cx = w / 2;
            const cy = h / 2;
            const r = Math.min(cx, cy);
            const grad = this.ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
            grad.addColorStop(0, color1);
            grad.addColorStop(1, color2);
            return grad;
        }
        return color1;
    }

    // Campiona un punto per rigetto: candidato uniforme nel dominio,
    // accettato con probabilità psi^2 / maxPsiSq. Nessuna correlazione,
    // nessun "punto di partenza": ogni chiamata è statisticamente indipendente,
    // quindi i nodi radiali vengono riprodotti come vuoti netti, non sfumati.
    rejectionSample(w, h, maxAttempts, pCurrent) {
        const { n, l, m } = this.params;
        for (let i = 0; i < maxAttempts; i++) {
            const x = Math.random() * w;
            const y = Math.random() * h;
            const psi = this.getPsiAt(x, y, n, l, m);
            const density = (psi * psi) / this.maxPsiSq;
            if (Math.random() < density) {
                return { x, y, psi };
            }
        }
        // Fallback: se fallisce, NON mettere un punto a caso (crea rumore bianco in accumulate).
        // Restituisci la posizione vecchia.
        return { x: pCurrent.x, y: pCurrent.y, psi: pCurrent.psi };
    }

    updateParticles() {
        const w = this.canvas.width;
        const h = this.canvas.height;

        if (this.config.samplingMode !== 'reject') {
            return; // altre modalità non più supportate: usa 'reject'
        }

        if (this.config.accumulate && this.accumulatedFrames >= this.maxAccumulateFrames) {
            // Stop updating particles to freeze the accumulation and save CPU.
            return;
        }

        const maxAttempts = this.config.maxRejectAttempts || 60;
        const fraction = this.config.respawnFraction ?? 1.0;

        for (let p of this.particles) {
            if (fraction >= 1.0 || Math.random() < fraction) {
                const s = this.rejectionSample(w, h, maxAttempts, p);
                p.x = s.x;
                p.y = s.y;
                p.psi = s.psi;

                if (this.config.accumulate) {
                    this.accumulatedParticles.push({ ...p });
                }
            }
        }
    }

    beginExport() {
        this._isExporting = true;
    }

    endExport() {
        this._isExporting = false;
    }

    async renderFrame(timeSec, targetCanvas = null) {
        this.updateParticles();
        const destCanvas = targetCanvas || this.canvas;
        const destCtx = destCanvas.getContext('2d');
        this._drawFrame(destCtx, destCanvas.width, destCanvas.height);
    }

    render() {
        this._drawFrame(this.ctx, this.canvas.width, this.canvas.height);
    }

    _drawFrame(ctx, w, h) {
        if (this.config.accumulate) {
            if (this.accumulatedFrames >= this.maxAccumulateFrames) return;

            if (this.needsClear) {
                ctx.fillStyle = this.config.bgColor;
                ctx.fillRect(0, 0, w, h);
                this.needsClear = false;
            }
            this.accumulatedFrames++;
        } else {
            const hexToRgba = (hex, alpha) => {
                const rgb = hexToRgb(hex);
                return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
            };
            ctx.fillStyle = hexToRgba(this.config.bgColor, 0.15);
            ctx.fillRect(0, 0, w, h);
        }

        ctx.globalAlpha = this.config.particleAlpha ?? 0.65;
        const r = this.config.particleSize;

        let posPts = [];
        let negPts = [];
        for (let p of this.particles) {
            if (p.psi >= 0) posPts.push(p);
            else negPts.push(p);
        }

        if (posPts.length > 0) {
            ctx.fillStyle = this.config.posColor || '#000000';
            ctx.beginPath();
            for (let p of posPts) {
                ctx.moveTo(p.x + r, p.y);
                ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
            }
            ctx.fill();
        }

        if (negPts.length > 0) {
            ctx.fillStyle = this.config.negColor || '#FF0000';
            ctx.beginPath();
            for (let p of negPts) {
                ctx.moveTo(p.x + r, p.y);
                ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
            }
            ctx.fill();
        }

        ctx.globalAlpha = 1.0;
    }

    animate() {
        if (!this.isPlaying) return;
        
        let delta = 16.666;
        let speedMultiplier = this.speed || 1.0;
        if (this.config.rotateColors) {
            this.config.posAngle = (this.config.posAngle + this.config.rotationSpeed * speedMultiplier) % 360;
            this.config.negAngle = (this.config.negAngle + this.config.rotationSpeed * speedMultiplier) % 360;
            window.dispatchEvent(new CustomEvent('hydrogenAngleUpdate', {
                detail: { pos: this.config.posAngle, neg: this.config.negAngle }
            }));
        }

        this.updateParticles();
        this.render();

        this.animationFrameId = requestAnimationFrame(this.animate.bind(this));
    }

    exportToPNG(filename) {
        const dataUrl = this.canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    async exportToSVG() {
        const targetPts = this.config.accumulate ? this.accumulatedParticles : this.particles;
        if (targetPts.length > 8000) {
            const proceed = await showLargeExportWarning(targetPts.length, 'points');
            if (!proceed) return null;
        }

        const width = this.canvas.width;
        const height = this.canvas.height;
        let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">\n`;

        // Background
        svgContent += `  <rect width="${width}" height="${height}" fill="${this.config.bgColor}" />\n`;

        const r = this.config.particleSize;
        const optLevels = { 1: 1.0, 2: 2.0, 3: 3.5, 4: 6.0 };
        const optScale = optLevels[this.config.svgOptimization || 3];

        // 1. Spatial Binning to eliminate overdraw
        const cellSize = Math.max(1, r * 1.5 * optScale);
        const exportRadius = r * Math.sqrt(optScale);

        const getCellKey = (x, y) => `${Math.floor(x / cellSize)}_${Math.floor(y / cellSize)}`;

        const binsPos = new Map();
        const binsNeg = new Map();

        for (let p of targetPts) {
            const key = getCellKey(p.x, p.y);
            if (p.psi >= 0) {
                binsPos.set(key, (binsPos.get(key) || 0) + 1);
            } else {
                binsNeg.set(key, (binsNeg.get(key) || 0) + 1);
            }
        }

        // 2. Group paths by required opacity to minimize DOM nodes
        const baseAlpha = this.config.particleAlpha ?? 0.65;
        const posGroups = new Map();
        const negGroups = new Map();

        const getGroupKey = (count) => {
            const alpha = 1 - Math.pow(1 - baseAlpha, count);
            if (alpha >= 0.99) return 'opaque';
            return count;
        };

        const getArcPath = (cx, cy, r) => {
            const y = parseFloat(cy).toFixed(2);
            const xMinus = (parseFloat(cx) - r).toFixed(2);
            const xPlus = (parseFloat(cx) + r).toFixed(2);
            return `M ${xMinus} ${y} A ${r} ${r} 0 1 0 ${xPlus} ${y} A ${r} ${r} 0 1 0 ${xMinus} ${y} `;
        };

        for (let [key, count] of binsPos.entries()) {
            const [col, row] = key.split('_').map(Number);
            const cx = col * cellSize + cellSize / 2;
            const cy = row * cellSize + cellSize / 2;
            const gKey = getGroupKey(count);
            posGroups.set(gKey, (posGroups.get(gKey) || '') + getArcPath(cx, cy, exportRadius));
        }

        for (let [key, count] of binsNeg.entries()) {
            const [col, row] = key.split('_').map(Number);
            const cx = col * cellSize + cellSize / 2;
            const cy = row * cellSize + cellSize / 2;
            const gKey = getGroupKey(count);
            negGroups.set(gKey, (negGroups.get(gKey) || '') + getArcPath(cx, cy, exportRadius));
        }

        const posColor = this.config.posColor || '#000000';
        const negColor = this.config.negColor || '#FF0000';

        // 3. Output SVGs
        for (let [gKey, pathStr] of posGroups.entries()) {
            const alpha = gKey === 'opaque' ? 1.0 : (1 - Math.pow(1 - baseAlpha, gKey)).toFixed(3);
            svgContent += `  <path d="${pathStr.trim()}" fill="${posColor}" opacity="${alpha}" />\n`;
        }
        for (let [gKey, pathStr] of negGroups.entries()) {
            const alpha = gKey === 'opaque' ? 1.0 : (1 - Math.pow(1 - baseAlpha, gKey)).toFixed(3);
            svgContent += `  <path d="${pathStr.trim()}" fill="${negColor}" opacity="${alpha}" />\n`;
        }

        svgContent += `</svg>`;
        return svgContent;
    }

    destroy() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.particles = [];
    }
}