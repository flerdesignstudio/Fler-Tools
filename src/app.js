import { injectSpeedInsights } from '@vercel/speed-insights';
import { inject } from '@vercel/analytics';
import chladniTool from './tools/chladni/chladni-ui.js';
import hydrogenTool from './tools/hydrogen/hydrogen-ui.js';
import oscilloscopeTool from './tools/oscilloscope/oscilloscope-ui.js';
import asciiTool from './tools/ascii/ascii-ui.js';
import ditherTool from './tools/dither/dither-ui.js';
import cellsTool from './tools/cells/cells-ui.js';
import thermalTool from './tools/thermal/thermal-ui.js';
import matrixTool from './tools/matrix/matrix-ui.js';

// Inizializza Vercel Speed Insights e Web Analytics
injectSpeedInsights();
inject();

// --- Tool Registry ---
export const tools = {
    [chladniTool.id]: chladniTool,
    [hydrogenTool.id]: hydrogenTool,
    [oscilloscopeTool.id]: oscilloscopeTool,
    [asciiTool.id]: asciiTool,
    [ditherTool.id]: ditherTool,
    [cellsTool.id]: cellsTool,
    [thermalTool.id]: thermalTool,
    [matrixTool.id]: matrixTool
};

import { animate } from 'motion';

let navToolIds = null;
let mruQueue = [];

function renderNavigation(activeToolId) {
    const navMenu = document.getElementById('app-navigation');
    if (!navMenu) return;
    navMenu.innerHTML = '';
    
    const toolsArray = Object.values(tools);
    const maxNavTools = 3;
    const activeTool = tools[activeToolId];
    if (!activeTool) return;
    
    // Initialize state on first run
    if (!navToolIds) {
        navToolIds = toolsArray.slice(0, maxNavTools).map(t => t.id);
        mruQueue = [...navToolIds];
    }

    // Update MRU queue
    mruQueue = [activeToolId, ...mruQueue.filter(id => id !== activeToolId)];
    
    // Check if we need to replace a tool in the visible nav
    if (!navToolIds.includes(activeToolId)) {
        // Find the least recently used tool that is currently in navToolIds
        let victimId = null;
        for (let i = mruQueue.length - 1; i >= 0; i--) {
            if (navToolIds.includes(mruQueue[i])) {
                victimId = mruQueue[i];
                break;
            }
        }
        
        // Replace victimId with activeToolId in navToolIds
        const victimIndex = navToolIds.indexOf(victimId);
        if (victimIndex !== -1) {
            navToolIds[victimIndex] = activeToolId;
        } else {
            // Fallback (shouldn't happen)
            navToolIds.unshift(activeToolId);
            if (navToolIds.length > maxNavTools) navToolIds.pop();
        }
    }
    
    const navTools = navToolIds.map(id => tools[id]).filter(Boolean);

    navTools.forEach(tool => {
        const btn = document.createElement('button');
        btn.className = 'notion-btn notion-btn-secondary nav-btn';
        btn.dataset.toolId = tool.id;
        btn.innerHTML = `<span class="icon">${tool.icon}</span> ${tool.label}`;
        if (tool.id === activeToolId) {
            btn.classList.add('active');
        }
        btn.onclick = () => loadTool(tool.id);
        navMenu.appendChild(btn);
    });

    if (toolsArray.length > maxNavTools) {
        const moreBtn = document.createElement('button');
        moreBtn.className = 'notion-btn notion-btn-secondary more-tools-btn';
        moreBtn.innerHTML = `<span class="icon" style="font-size: 16px;">+</span>`;
        moreBtn.title = "More Tools";
        moreBtn.onclick = () => {
            const overlay = document.getElementById('tools-modal-overlay');
            if (overlay) overlay.classList.add('active');
        };
        navMenu.appendChild(moreBtn);
    }
}

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

    // Update active state in nav by re-rendering
    renderNavigation(toolId);

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
    
    // 3. Update export buttons state
    updateExportButtonsState();
};

function updateExportButtonsState() {
    const exportSvgBtn = document.getElementById('exportSvgBtn');
    if (exportSvgBtn) {
        exportSvgBtn.disabled = !(currentTool && currentTool._visualizer && typeof currentTool._visualizer.exportToSVG === 'function');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const toolsArray = Object.values(tools);

    // Build Modal Grid
    const modalGrid = document.getElementById('tools-modal-grid');
    if (modalGrid) {
        toolsArray.forEach(tool => {
            const card = document.createElement('div');
            card.className = 'tool-card';
            card.innerHTML = `<span class="icon">${tool.icon}</span><span class="label">${tool.label}</span>`;
            card.onclick = () => {
                loadTool(tool.id);
                const overlay = document.getElementById('tools-modal-overlay');
                if (overlay) overlay.classList.remove('active');
            };
            modalGrid.appendChild(card);
        });
    }

    // Modal Close Handlers
    const closeBtn = document.getElementById('closeToolsModalBtn');
    const modalOverlay = document.getElementById('tools-modal-overlay');
    if (closeBtn && modalOverlay) {
        closeBtn.onclick = () => modalOverlay.classList.remove('active');
    }
    if (modalOverlay) {
        modalOverlay.onclick = (e) => {
            if (e.target === modalOverlay) modalOverlay.classList.remove('active');
        };
    }

    // Info Modal Handlers
    const infoBtn = document.getElementById('infoBtn');
    const infoModalOverlay = document.getElementById('info-modal-overlay');
    const closeInfoBtn = document.getElementById('closeInfoModalBtn');

    if (infoBtn && infoModalOverlay) {
        infoBtn.onclick = () => infoModalOverlay.classList.add('active');
    }
    if (closeInfoBtn && infoModalOverlay) {
        closeInfoBtn.onclick = () => infoModalOverlay.classList.remove('active');
    }
    if (infoModalOverlay) {
        infoModalOverlay.onclick = (e) => {
            if (e.target === infoModalOverlay) infoModalOverlay.classList.remove('active');
        };
    }

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
            const canvas = document.getElementById('visualizer') || document.getElementById('hydrogen_visualizer') || document.getElementById('oscVisualizer') || document.getElementById('matrixCanvas');
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
