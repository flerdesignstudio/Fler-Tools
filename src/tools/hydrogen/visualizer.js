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
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16)
    ] : [0, 0, 0];
};

export class HydrogenVisualizer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = this.canvas.getContext('2d');
        
        this.offscreen = document.createElement('canvas');
        this.oCtx = this.offscreen.getContext('2d');

        // State
        this.params = { n: 4, l: 2, m: 1 };
        
        // Morphing State
        this.isMorphing = false;
        this.morphStartTime = 0;
        this.morphDuration = 2000;
        
        // Caches
        this.psiGrid = null;
        this.psiGridTarget = null;
        this.maxPsiSq = 1;
        this.maxPsiSqTarget = 1;
        
        this.gridWidth = 0;
        this.gridHeight = 0;
        this.isInteractive = false;

        this.config = {
            bgColor: '#000000',
            exposure: 2.0,
            
            posGradType: 'solid',
            posColor1: '#00FFFF',
            posColor2: '#FF00FF',
            posAngle: 0,
            
            negGradType: 'solid',
            negColor1: '#FF4500',
            negColor2: '#FFFF00',
            negAngle: 180,
            
            rotateColors: false,
            rotationSpeed: 0.5,
            
            autoMorph: false,
            morphSpeed: 'slow'
        };

        this.aspectRatio = '1:1';
        this.animationFrameId = null;
        
        this.resize();
        
        // Initial compute
        const result = this._generateDensityField(this.params.n, this.params.l, this.params.m, false);
        this.psiGrid = result.grid;
        this.maxPsiSq = result.maxSq;

        this.animate();
    }

    setAspectRatio(ratioStr) {
        this.aspectRatio = ratioStr;
        this.resize();
        // Recompute current state
        const result = this._generateDensityField(this.params.n, this.params.l, this.params.m, false);
        this.psiGrid = result.grid;
        this.maxPsiSq = result.maxSq;
        this.isMorphing = false;
        this.renderColors();
    }

    // Triggered when sliders move or auto-morph picks a new state
    updatePattern(n, l, m) {
        if (n === this.params.n && l === this.params.l && m === this.params.m) return;
        
        const duration = this.config.morphSpeed === 'slow' ? 2500 : 5000;
        
        // If we are already morphing, we instantly snap the current state to the in-progress blend
        if (this.isMorphing) {
            // This is complex to do flawlessly without stutter, 
            // so we will just restart the morph from the origin state to the new target.
        }
        
        const result = this._generateDensityField(n, l, m, false);
        this.psiGridTarget = result.grid;
        this.maxPsiSqTarget = result.maxSq;
        
        this.targetParams = { n, l, m };
        
        this.isMorphing = true;
        this.morphStartTime = performance.now();
        this.morphDuration = duration;
    }

    finalizePattern() {
        // Unused in morphing paradigm, handled naturally by reaching t=1
    }

    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        this.renderColors();
    }

    resize() {
        const ratios = {
            '1:1': { w: 1000, h: 1000 },
            '16:9': { w: 1600, h: 900 },
            '9:16': { w: 900, h: 1600 },
            '4:3': { w: 1200, h: 900 }
        };

        const dims = ratios[this.aspectRatio] || ratios['1:1'];

        this.canvas.width = dims.w;
        this.canvas.height = dims.h;
        this.canvas.style.aspectRatio = `${dims.w} / ${dims.h}`;
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        this.canvas.style.objectFit = 'contain';
        
        this.gridWidth = dims.w;
        this.gridHeight = dims.h;
        this.offscreen.width = dims.w;
        this.offscreen.height = dims.h;
    }

    _generateDensityField(n, l, m, isInteractive = false) {
        const scaleFactor = isInteractive ? 0.3 : 1.0;
        const w = Math.floor(this.canvas.width * scaleFactor);
        const h = Math.floor(this.canvas.height * scaleFactor);
        
        // Ensure offscreen canvas matches generation resolution
        if (this.offscreen.width !== w) {
             this.gridWidth = w;
             this.gridHeight = h;
             this.offscreen.width = w;
             this.offscreen.height = h;
        }

        const maxR = 2.0 * n * n + 5.0; 
        const physScale = 2.0 * maxR / Math.min(w, h);
        const m_abs = Math.abs(m);

        let maxPsiSq = 0;
        const grid = new Float32Array(w * h);

        let idx = 0;
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
                    
                    const sign = (x < 0 && m_abs % 2 !== 0) ? -1 : 1;
                    psi = R_part * Y_part * sign;
                } else if (l === 0) {
                    psi = laguerre(n - 1, 1, 0); 
                }

                grid[idx] = psi;
                const psiSq = psi * psi;
                if (psiSq > maxPsiSq) {
                    maxPsiSq = psiSq;
                }
                idx++;
            }
        }

        return { grid, maxSq: maxPsiSq > 0 ? maxPsiSq : 1 };
    }

    _getGradientT(type, nx, ny, angleRad, density) {
        if (type === 'solid') return 0;
        if (type === 'density') return 1.0 - density;
        if (type === 'linear') {
            const dx = nx * Math.cos(angleRad) + ny * Math.sin(angleRad);
            return Math.max(0, Math.min(1, dx * 0.5 + 0.5));
        }
        if (type === 'radial') {
            const r = Math.sqrt(nx * nx + ny * ny);
            return Math.max(0, Math.min(1, r));
        }
        if (type === 'angular') {
            let theta = Math.atan2(ny, nx);
            let dTheta = (theta - angleRad) % (Math.PI * 2);
            if (dTheta < 0) dTheta += Math.PI * 2;
            return dTheta / (Math.PI * 2);
        }
        return 0;
    }

    renderColors() {
        if (!this.psiGrid) return;

        const w = this.gridWidth;
        const h = this.gridHeight;
        
        const imgData = this.oCtx.createImageData(w, h);
        const data = imgData.data;

        const bgCol = hexToRgb(this.config.bgColor);
        const pCol1 = hexToRgb(this.config.posColor1);
        const pCol2 = hexToRgb(this.config.posColor2);
        const pAngleRad = this.config.posAngle * Math.PI / 180;
        const pType = this.config.posGradType;
        
        const nCol1 = hexToRgb(this.config.negColor1);
        const nCol2 = hexToRgb(this.config.negColor2);
        const nAngleRad = this.config.negAngle * Math.PI / 180;
        const nType = this.config.negGradType;

        const exposure = this.config.exposure;
        
        let t = 0;
        let activeMaxSq = this.maxPsiSq;
        
        if (this.isMorphing) {
            const elapsed = performance.now() - this.morphStartTime;
            t = elapsed / this.morphDuration;
            if (t >= 1.0) {
                t = 1.0;
                this.isMorphing = false;
                this.psiGrid = this.psiGridTarget;
                this.maxPsiSq = this.maxPsiSqTarget;
                this.params = this.targetParams;
                activeMaxSq = this.maxPsiSq;
            } else {
                // Smooth sinusoidal easing
                const blend = Math.sin(t * Math.PI / 2);
                const cosBlend = Math.cos(t * Math.PI / 2);
                activeMaxSq = this.maxPsiSq * (1 - blend) + this.maxPsiSqTarget * blend;
                t = blend;
            }
        }

        const currentGrid = this.psiGrid;
        const targetGrid = this.psiGridTarget;
        const isBlending = this.isMorphing && targetGrid;
        const blendFactor = t;
        const cosFactor = isBlending ? Math.cos(t * Math.PI / 2) : 1;

        let idx = 0;
        for (let py = 0; py < h; py++) {
            const ny = 2.0 * (py - h/2) / h;
            for (let px = 0; px < w; px++) {
                const nx = 2.0 * (px - w/2) / w;
                
                let psi = currentGrid[idx];
                if (isBlending) {
                    psi = cosFactor * psi + blendFactor * targetGrid[idx];
                }
                
                const density = Math.min(1.0, (psi * psi / activeMaxSq) * exposure);
                
                let r, g, b;
                if (psi > 0) {
                    const gt = this._getGradientT(pType, nx, ny, pAngleRad, density);
                    const baseR = pCol1[0] + (pCol2[0] - pCol1[0]) * gt;
                    const baseG = pCol1[1] + (pCol2[1] - pCol1[1]) * gt;
                    const baseB = pCol1[2] + (pCol2[2] - pCol1[2]) * gt;
                    r = bgCol[0] + (baseR - bgCol[0]) * density;
                    g = bgCol[1] + (baseG - bgCol[1]) * density;
                    b = bgCol[2] + (baseB - bgCol[2]) * density;
                } else {
                    const gt = this._getGradientT(nType, nx, ny, nAngleRad, density);
                    const baseR = nCol1[0] + (nCol2[0] - nCol1[0]) * gt;
                    const baseG = nCol1[1] + (nCol2[1] - nCol1[1]) * gt;
                    const baseB = nCol1[2] + (nCol2[2] - nCol1[2]) * gt;
                    r = bgCol[0] + (baseR - bgCol[0]) * density;
                    g = bgCol[1] + (baseG - bgCol[1]) * density;
                    b = bgCol[2] + (baseB - bgCol[2]) * density;
                }

                const dIdx = idx * 4;
                data[dIdx] = r;
                data[dIdx + 1] = g;
                data[dIdx + 2] = b;
                data[dIdx + 3] = 255;
                idx++;
            }
        }

        this.oCtx.putImageData(imgData, 0, 0);
        this.ctx.imageSmoothingEnabled = false;
        this.ctx.drawImage(this.offscreen, 0, 0, this.canvas.width, this.canvas.height);
    }

    animate() {
        let needsRender = false;

        if (this.config.rotateColors) {
            this.config.posAngle = (this.config.posAngle + this.config.rotationSpeed) % 360;
            this.config.negAngle = (this.config.negAngle + this.config.rotationSpeed) % 360;
            window.dispatchEvent(new CustomEvent('hydrogenAngleUpdate', {
                detail: { pos: this.config.posAngle, neg: this.config.negAngle }
            }));
            needsRender = true;
        }

        if (this.isMorphing) {
            needsRender = true;
        }

        if (needsRender) {
            this.renderColors();
        }
        
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

    destroy() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
}
