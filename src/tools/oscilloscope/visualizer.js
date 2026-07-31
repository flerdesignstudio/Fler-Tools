import { showLargeExportWarning } from '../../utils/export-warning.js';

export class OscilloscopeVisualizer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = this.canvas.getContext('2d');
        this.particles = [];
        this.numParticles = 2000;

        // Oscilloscope State
        this.config = {
            freqMode: 'integer', // integer, decimal
            freqX: 3,
            freqY: 2,
            ampX: 150,
            ampY: 150,
            phase: 0,
            speed: 1, // time multiplier for animation
            thickness: 5,
            particleSize: 1.5,
            
            // Theme
            particleColor1: '#39FF14', // Green
            particleColor2: '#39FF14',
            trailColor: '#000000',     // Black
            useGradient: false,
            bgGradStart: '#000000',
            bgGradEnd: '#000000',
            useBgGradient: false
        };

        this.isPlaying = true;
        this.animationFrameId = null;
        this.time = 0;

        this.aspectRatio = '1:1';
        this.resize();

        this.initParticles();
        this.animate();
    }

    setAspectRatio(ratioStr) {
        this.aspectRatio = ratioStr;
        this.resize();
    }

    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
    }

    updateParticleCount(count) {
        this.numParticles = count;
        // Adjust thickness based on particle count. For example, baseline is 2000 particles = thickness 5
        this.config.thickness = (count / 2000) * 5;
        this.initParticles();
    }

    resize() {
        // Internal high-res dimensions
        const ratios = {
            '1:1': { w: 1200, h: 1200 },
            '16:9': { w: 1920, h: 1080 },
            '9:16': { w: 1080, h: 1920 },
            '4:3': { w: 1600, h: 1200 }
        };

        const dims = ratios[this.aspectRatio] || ratios['1:1'];

        this.canvas.width = dims.w;
        this.canvas.height = dims.h;
        this.canvas.style.aspectRatio = `${dims.w} / ${dims.h}`;
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        this.canvas.style.objectFit = 'contain';

        if (this.particles.length > 0) {
            this.initParticles();
        }
    }

    initParticles() {
        this.particles = [];
        for (let i = 0; i < this.numParticles; i++) {
            this.particles.push({
                tOffset: Math.random() * Math.PI * 2 * 10,
                noiseX: (Math.random() - 0.5) * 2,
                noiseY: (Math.random() - 0.5) * 2
            });
        }
    }

    togglePlay() {
        this.isPlaying = !this.isPlaying;
        if (this.isPlaying) {
            this.animate();
        }
    }

    animate(singleFrame = false) {
        if (!this.isPlaying && !singleFrame) return;

        const hexToRgba = (hex, alpha) => {
            if(!hex) return `rgba(0,0,0,${alpha})`;
            const r = parseInt(hex.slice(1, 3), 16) || 0;
            const g = parseInt(hex.slice(3, 5), 16) || 0;
            const b = parseInt(hex.slice(5, 7), 16) || 0;
            return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        };

        if (this.config.useBgGradient) {
            const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
            gradient.addColorStop(0, hexToRgba(this.config.bgGradStart, 0.3));
            gradient.addColorStop(1, hexToRgba(this.config.bgGradEnd, 0.3));
            this.ctx.fillStyle = gradient;
        } else {
            this.ctx.fillStyle = hexToRgba(this.config.trailColor, 0.3);
        }

        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Set Particle Color
        if (this.config.useGradient) {
            const gradient = this.ctx.createLinearGradient(0, 0, this.canvas.width, this.canvas.height);
            gradient.addColorStop(0, this.config.particleColor1);
            gradient.addColorStop(1, this.config.particleColor2);
            this.ctx.fillStyle = gradient;
        } else {
            this.ctx.fillStyle = this.config.particleColor1;
        }

        this.ctx.beginPath();
        
        this.time += this.config.speed * 0.05; // Animation speed affects how fast particles spin around the path
        const globalPhase = this.config.phase * Math.PI;

        let fx = this.config.freqX;
        let fy = this.config.freqY;
        
        if (this.config.freqMode === 'integer') {
            fx = Math.round(fx);
            fy = Math.round(fy);
        }

        for (let p of this.particles) {
            const t = p.tOffset + this.time;
            
            const rawX = Math.sin(fx * t + globalPhase);
            const rawY = Math.sin(fy * t);
            
            const noiseX = p.noiseX * this.config.thickness;
            const noiseY = p.noiseY * this.config.thickness;
            
            p.x = (this.canvas.width / 2) + (rawX * this.config.ampX) + noiseX;
            p.y = (this.canvas.height / 2) - (rawY * this.config.ampY) + noiseY;

            this.ctx.moveTo(p.x + this.config.particleSize, p.y);
            this.ctx.arc(p.x, p.y, this.config.particleSize, 0, Math.PI * 2);
        }
        this.ctx.fill();

        if (!singleFrame) {
            this.animationFrameId = requestAnimationFrame(() => this.animate());
        }
    }

    async exportToSVG() {
        const particleCount = this.particles.length;
        if (particleCount > 8000) {
            const proceed = await showLargeExportWarning(particleCount, 'points');
            if (!proceed) return null;
        }

        const width = this.canvas.width;
        const height = this.canvas.height;
        let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">\n`;

        if (this.config.useBgGradient) {
            svgContent += `  <defs>\n    <linearGradient id="bgGrad" x1="0" y1="0" x2="0" y2="1">\n      <stop offset="0%" stop-color="${this.config.bgGradStart}" />\n      <stop offset="100%" stop-color="${this.config.bgGradEnd}" />\n    </linearGradient>\n  </defs>\n`;
            svgContent += `  <rect width="${width}" height="${height}" fill="url(#bgGrad)" />\n`;
        } else {
            svgContent += `  <rect width="${width}" height="${height}" fill="${this.config.trailColor}" />\n`;
        }

        if (this.config.useGradient) {
            svgContent += `  <defs>\n    <linearGradient id="particleGrad" x1="0" y1="0" x2="1" y2="0">\n      <stop offset="0%" stop-color="${this.config.particleColor1}" />\n      <stop offset="100%" stop-color="${this.config.particleColor2}" />\n    </linearGradient>\n  </defs>\n`;
        }

        const fillStyle = this.config.useGradient ? 'url(#particleGrad)' : this.config.particleColor1;

        let pathData = '';
        for (let p of this.particles) {
            const y = parseFloat(p.y).toFixed(2);
            const r = this.config.particleSize;
            const xMinus = (parseFloat(p.x) - r).toFixed(2);
            const xPlus = (parseFloat(p.x) + r).toFixed(2);
            pathData += `M ${xMinus} ${y} A ${r} ${r} 0 1 0 ${xPlus} ${y} A ${r} ${r} 0 1 0 ${xMinus} ${y}\n`;
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
