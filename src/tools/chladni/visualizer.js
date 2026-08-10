import { showLargeExportWarning } from '../../utils/export-warning.js';

export class ChladniVisualizer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = this.canvas.getContext('2d');
        this.particles = [];
        this.numParticles = 2000;

        // Current Pattern
        this.pattern = { n: 3, m: 5, v: 0 };

        this.isPlaying = true;
        this.speed = 1.0;
        this.qualityMultiplier = 1.0;
        this.animationFrameId = null;

        // Customization State
        this.config = {
            particleColor1: '#39FF14',
            particleColor2: '#00FFFF',
            trailColor: '#000a00',
            useGradient: true,
            bgGradStart: '#000000',
            bgGradEnd: '#1a1a2e',
            useBgGradient: false,
            particleSize: 1.5
        };

        this.aspectRatio = '1:1';
        this.resize();

        this.initParticles();
        this.animate();
    }

    setAspectRatio(ratioStr) {
        this.aspectRatio = ratioStr;
        this.resize();
    }

    setQuality(qualityStr) {
        if (qualityStr === 'Low') this.qualityMultiplier = 0.25;
        else if (qualityStr === 'Med') this.qualityMultiplier = 0.5;
        else this.qualityMultiplier = 1.0;
        this.resize();
    }

    updatePattern(n, m, v) {
        this.pattern = { n, m, v };
    }

    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
    }

    updateParticleCount(count) {
        this.numParticles = count;
        this.initParticles();
    }

    resize() {
        // Internal high-res dimensions for clear SVG output
        const ratios = {
            '1:1': { w: 1200, h: 1200 },
            '16:9': { w: 1920, h: 1080 },
            '9:16': { w: 1080, h: 1920 },
            '4:3': { w: 1600, h: 1200 }
        };

        const baseDims = ratios[this.aspectRatio] || ratios['1:1'];

        // Set the canvas internal resolution
        this.canvas.width = Math.round(baseDims.w * this.qualityMultiplier);
        this.canvas.height = Math.round(baseDims.h * this.qualityMultiplier);

        // Provide inline CSS to enforce the aspect ratio in the DOM
        this.canvas.style.aspectRatio = `${baseDims.w} / ${baseDims.h}`;

        // Ensure width/height CSS scales to bounds but maintains ratio
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        this.canvas.style.objectFit = 'contain';

        // Restart particles so they distribute across the new canvas bounds
        if (this.particles.length > 0) {
            this.initParticles();
        }
    }

    initParticles() {
        this.particles = [];
        for (let i = 0; i < this.numParticles; i++) {
            this.particles.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                vx: 0,
                vy: 0
            });
        }
    }

    getVibration(x, y, n, m, v) {
        const pi = Math.PI;
        // Normalize x,y to aspect ratio preserved range
        const aspect = this.canvas.width / this.canvas.height;
        const nx = (x / this.canvas.width - 0.5) * 2 * aspect;
        const ny = (y / this.canvas.height - 0.5) * 2;

        const term1 = Math.cos(n * pi * nx) * Math.cos(m * pi * ny);
        const term2 = Math.cos(m * pi * nx) * Math.cos(n * pi * ny);

        if (v === 1) {
            return term1 + term2;
        } else {
            return term1 - term2;
        }
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
        this.initParticles();
    }
    
    setLoop(loop) {
        this.isLooping = loop;
    }

    setSpeed(speed) {
        this.speed = speed;
    }

    beginExport() {
        this._isExporting = true;
    }

    endExport() {
        this._isExporting = false;
    }

    async renderFrame(timeSec, targetCanvas = null) {
        const destCanvas = targetCanvas || this.canvas;
        const destCtx = destCanvas.getContext('2d');
        this._drawFrame(destCtx, destCanvas.width, destCanvas.height);
    }

    animate(singleFrame = false) {
        if (!this.isPlaying && !singleFrame) return;

        this._drawFrame(this.ctx, this.canvas.width, this.canvas.height);

        if (!singleFrame) {
            this.animationFrameId = requestAnimationFrame(() => this.animate());
        }
    }

    _drawFrame(ctx, width, height) {
        const hexToRgba = (hex, alpha) => {
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        };

        if (this.config.useBgGradient) {
            const gradient = ctx.createLinearGradient(0, 0, 0, height);
            gradient.addColorStop(0, hexToRgba(this.config.bgGradStart, 0.2));
            gradient.addColorStop(1, hexToRgba(this.config.bgGradEnd, 0.2));
            ctx.fillStyle = gradient;
        } else {
            ctx.fillStyle = hexToRgba(this.config.trailColor, 0.2);
        }

        ctx.fillRect(0, 0, width, height);

        if (this.config.useGradient) {
            const gradient = ctx.createLinearGradient(0, 0, width, height);
            gradient.addColorStop(0, this.config.particleColor1);
            gradient.addColorStop(1, this.config.particleColor2);
            ctx.fillStyle = gradient;
        } else {
            ctx.fillStyle = this.config.particleColor1;
        }

        ctx.beginPath();
        for (let p of this.particles) {
            const vib = this.getVibration(p.x, p.y, this.pattern.n, this.pattern.m, this.pattern.v);
            const totalVibration = Math.abs(vib);

            const moveAmount = (totalVibration * 50 + 1.0) * this.speed;

            p.x += (Math.random() - 0.5) * moveAmount;
            p.y += (Math.random() - 0.5) * moveAmount;

            if (p.x < 0) p.x = width;
            if (p.x > width) p.x = 0;
            if (p.y < 0) p.y = height;
            if (p.y > height) p.y = 0;

            ctx.moveTo(p.x + this.config.particleSize, p.y);
            ctx.arc(p.x, p.y, this.config.particleSize, 0, Math.PI * 2);
        }
        ctx.fill();
    }

    async exportToSVG() {
        const particleCount = this.particles.length;
        if (particleCount > 8000) {
            const proceed = await showLargeExportWarning(particleCount, 'particles');
            if (!proceed) return null;
        }

        const width = this.canvas.width;
        const height = this.canvas.height;
        let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">\n`;

        // Background
        if (this.config.useBgGradient) {
            svgContent += `  <defs>\n    <linearGradient id="bgGrad" x1="0" y1="0" x2="0" y2="1">\n      <stop offset="0%" stop-color="${this.config.bgGradStart}" />\n      <stop offset="100%" stop-color="${this.config.bgGradEnd}" />\n    </linearGradient>\n  </defs>\n`;
            svgContent += `  <rect width="${width}" height="${height}" fill="url(#bgGrad)" />\n`;
        } else {
            svgContent += `  <rect width="${width}" height="${height}" fill="${this.config.trailColor}" />\n`;
        }

        // Particle Gradient Def
        if (this.config.useGradient) {
            svgContent += `  <defs>\n    <linearGradient id="particleGrad" x1="0" y1="0" x2="1" y2="0">\n      <stop offset="0%" stop-color="${this.config.particleColor1}" />\n      <stop offset="100%" stop-color="${this.config.particleColor2}" />\n    </linearGradient>\n  </defs>\n`;
        }

        const fillStyle = this.config.useGradient ? 'url(#particleGrad)' : this.config.particleColor1;

        // Particles as a single path
        let pathData = '';
        for (let p of this.particles) {
            const y = parseFloat(p.y).toFixed(2);
            const r = this.config.particleSize;
            const xMinus = (parseFloat(p.x) - r).toFixed(2);
            const xPlus = (parseFloat(p.x) + r).toFixed(2);

            // SVG Arc commands to draw a full circle
            pathData += `M ${xMinus} ${y} A ${r} ${r} 0 1 0 ${xPlus} ${y} A ${r} ${r} 0 1 0 ${xMinus} ${y} `;
        }
        svgContent += `  <path d="${pathData.trim()}" fill="${fillStyle}" />\n`;

        svgContent += `</svg>`;
        return svgContent;
    }

    destroy() {
        this.isPlaying = false;
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.particles = [];
    }
}
