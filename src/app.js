import chladniTool from './tools/chladni/chladni-ui.js';
import hydrogenTool from './tools/hydrogen/hydrogen-ui.js';
import oscilloscopeTool from './tools/oscilloscope/oscilloscope-ui.js';

// --- Tool Registry ---
export const tools = {
    [chladniTool.id]: chladniTool,
    [hydrogenTool.id]: hydrogenTool,
    [oscilloscopeTool.id]: oscilloscopeTool
    // New tools will be imported and added here
};

import { animate } from 'motion';

let currentTool = null;

export const loadTool = async (toolId) => {
    const tool = tools[toolId];
    if (!tool) return;
    if (currentTool === tool) return; // already loaded

    const sidebarContainer = document.getElementById('tool-sidebar-container');
    const mainContainer = document.getElementById('tool-main-container');

    // 1. Teardown active tool
    if (currentTool) {
        // Animate out (exit)
        await Promise.all([
            animate(sidebarContainer, { opacity: 0, x: -10 }, { duration: 0.15, easing: [0.3, 0, 1, 1] }).finished,
            animate(mainContainer, { opacity: 0, scale: 0.98 }, { duration: 0.15, easing: [0.3, 0, 1, 1] }).finished
        ]).catch(() => {});

        if (currentTool.destroy) {
            currentTool.destroy();
        }
    }

    // Update active state in nav
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.toolId === toolId);
    });

    // Reset container styles for new tool's entrance
    sidebarContainer.style.opacity = 1;
    sidebarContainer.style.transform = 'none';
    mainContainer.style.opacity = 1;
    mainContainer.style.transform = 'none';

    // 2. Initialize new tool
    currentTool = tool;
    if (tool.init) {
        tool.init(sidebarContainer, mainContainer);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const navMenu = document.getElementById('app-navigation');

    // Build Navigation UI
    Object.values(tools).forEach(tool => {
        const btn = document.createElement('button');
        btn.className = 'notion-btn notion-btn-secondary nav-btn';
        btn.dataset.toolId = tool.id;
        btn.innerHTML = `<span class="icon">${tool.icon}</span> ${tool.label}`;
        btn.onclick = () => loadTool(tool.id);
        navMenu.appendChild(btn);
    });



    // Load initial tool (Chladni)
    loadTool(chladniTool.id);

    const fullscreenBtn = document.getElementById('fullscreenBtn');
    fullscreenBtn.addEventListener('click', () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.error(`Error attempting to enable fullscreen: ${err.message}`);
            });
        } else {
            document.exitFullscreen();
        }
    });

    document.addEventListener('fullscreenchange', () => {
        const iconSpan = fullscreenBtn.querySelector('.material-symbols-outlined');
        if (iconSpan) {
            iconSpan.textContent = document.fullscreenElement ? 'fullscreen_exit' : 'fullscreen';
        }
    });

    document.getElementById('exportSvgBtn').addEventListener('click', () => {
        if (currentTool && currentTool._visualizer && currentTool._visualizer.exportToSVG) {
            const svgString = currentTool._visualizer.exportToSVG();
            const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${currentTool.id}-export.svg`;
            document.body.appendChild(a);
            a.click();
            URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } else {
            alert('SVG export is not supported by this tool.');
        }
    });

    document.getElementById('exportPngBtn').addEventListener('click', () => {
        if (currentTool && currentTool._visualizer && currentTool._visualizer.exportToPNG) {
            currentTool._visualizer.exportToPNG(`${currentTool.id}-export.png`);
        } else {
            // Fallback to directly capturing the canvas
            const canvas = document.getElementById('visualizer') || document.getElementById('hydrogen_visualizer') || document.getElementById('oscVisualizer');
            if (canvas) {
                const url = canvas.toDataURL('image/png');
                const a = document.createElement('a');
                a.href = url;
                a.download = `${currentTool.id}-export.png`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            }
        }
    });
});
