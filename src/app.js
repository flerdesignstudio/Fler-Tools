import { injectSpeedInsights } from '@vercel/speed-insights';
import { inject } from '@vercel/analytics';
import chladniIcon from './Assets/chladni.svg?raw';
import hydrogenIcon from './Assets/hydrogen.svg?raw';
import oscilloscopeIcon from './Assets/oscilloscope.svg?raw';
import asciiIcon from './Assets/ascii.svg?raw';
import ditherIcon from './Assets/dither.svg?raw';
import cellsIcon from './Assets/cells.svg?raw';
import thermalIcon from './Assets/thermal.svg?raw';
import matrixIcon from './Assets/matrix.svg?raw';
import { renderToolErrorUI, setupGlobalExceptionCatchers } from './utils/error-handler.js';
import { mediaEngine } from './utils/media-engine.js';

// Inizializza Vercel Speed Insights e Web Analytics
injectSpeedInsights();
inject();

// --- Dynamic Tool Registry ---
export const tools = {
    chladni: { id: 'chladni', label: 'Chladni', icon: chladniIcon, loader: () => import('./tools/chladni/chladni-ui.js') },
    hydrogen: { id: 'hydrogen', label: 'Hydrogen', icon: hydrogenIcon, loader: () => import('./tools/hydrogen/hydrogen-ui.js') },
    oscilloscope: { id: 'oscilloscope', label: 'Oscilloscope', icon: oscilloscopeIcon, loader: () => import('./tools/oscilloscope/oscilloscope-ui.js') },
    ascii: { id: 'ascii', label: 'ASCII', icon: asciiIcon, loader: () => import('./tools/ascii/ascii-ui.js') },
    dither: { id: 'dither', label: 'Dither', icon: ditherIcon, loader: () => import('./tools/dither/dither-ui.js') },
    cells: { id: 'cells', label: 'Cells', icon: cellsIcon, loader: () => import('./tools/cells/cells-ui.js') },
    thermal: { id: 'thermal', label: 'Thermal', icon: thermalIcon, loader: () => import('./tools/thermal/thermal-ui.js') },
    matrix: { id: 'matrix', label: 'Matrix', icon: matrixIcon, loader: () => import('./tools/matrix/matrix-ui.js') }
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
            if (overlay) {
                overlay.classList.add('active');
                overlay.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')?.focus();
            }
        };
        navMenu.appendChild(moreBtn);
    }
}

let currentTool = null;

export const loadTool = async (toolId) => {
    const toolMeta = tools[toolId];
    if (!toolMeta) return;
    if (currentTool && currentTool.id === toolId) return; // already loaded

    const sidebarContainer = document.getElementById('tool-sidebar-container');
    const mainContainer = document.getElementById('tool-main-container');

    // 1. Teardown active tool
    if (currentTool) {
        // Animate out (exit)
        await Promise.all([
            animate(sidebarContainer, { opacity: 0, x: -10 }, { duration: 0.15, easing: [0.3, 0, 1, 1] }).finished,
            animate(mainContainer, { opacity: 0, scale: 0.98 }, { duration: 0.15, easing: [0.3, 0, 1, 1] }).finished
        ]).catch(() => { });

        if (currentTool.destroy) {
            currentTool.destroy();
        }
        mediaEngine.detachVisualizer();
    }

    // Update active state in nav by re-rendering
    renderNavigation(toolId);

    // Reset container styles for new tool's entrance
    sidebarContainer.style.opacity = 1;
    sidebarContainer.style.transform = 'none';
    mainContainer.style.opacity = 1;
    mainContainer.style.transform = 'none';

    // 2. Initialize new tool with resilient error boundary & dynamic lazy loading
    try {
        if (!toolMeta._module) {
            // Render Dot Matrix Loading animation (Echo Ring / @dotmatrix/dotm-square-11 style) during async fetch
            let gridHtml = '';
            for (let r = 0; r < 5; r++) {
                for (let c = 0; c < 5; c++) {
                    const ring = Math.abs(r - 2) + Math.abs(c - 2);
                    gridHtml += `<span class="dmx-dot" style="--ring: ${ring};" aria-hidden="true"></span>`;
                }
            }
            mainContainer.innerHTML = `
                <div class="dmx-loader-container" role="status" aria-live="polite">
                    <div class="dmx-grid-5x5">
                        ${gridHtml}
                    </div>
                    <div class="dmx-loading-label">Loading ${toolMeta.label || toolId}...</div>
                </div>
            `;
            if (sidebarContainer) {
                sidebarContainer.innerHTML = '';
            }

            // Ensure the loading animation displays for at least 1000ms to prevent visual flashing/stutter
            const [mod] = await Promise.all([
                toolMeta.loader(),
                new Promise(resolve => setTimeout(resolve, 1500))
            ]);
            toolMeta._module = mod.default || mod;
        }

        const toolInstance = toolMeta._module;
        currentTool = toolInstance;

        if (toolInstance.init) {
            toolInstance.init(sidebarContainer, mainContainer);
            if (toolInstance._visualizer) {
                mediaEngine.attachVisualizer(toolInstance._visualizer);
            }
        }
    } catch (error) {
        console.error(`[Fler Tools - Recovery] Failed to load or initialize tool "${toolMeta.label || toolId}":`, error);
        renderToolErrorUI(mainContainer, sidebarContainer, toolMeta.label || toolId, error, () => {
            // Safety fallback to Chladni
            loadTool('chladni');
        });
        updateExportButtonsState();
        return;
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
            card.role = 'button';
            card.tabIndex = 0;
            card.innerHTML = `<span class="icon">${tool.icon}</span><span class="label">${tool.label}</span>`;
            const activate = () => {
                loadTool(tool.id);
                const overlay = document.getElementById('tools-modal-overlay');
                if (overlay) overlay.classList.remove('active');
                document.querySelector('.more-tools-btn')?.focus();
            };
            card.onclick = activate;
            card.onkeydown = (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    activate();
                }
            };
            modalGrid.appendChild(card);
        });
    }

    // Modal Close Handlers
    const closeBtn = document.getElementById('closeToolsModalBtn');
    const modalOverlay = document.getElementById('tools-modal-overlay');
    if (closeBtn && modalOverlay) {
        closeBtn.onclick = () => {
            modalOverlay.classList.remove('active');
            document.querySelector('.more-tools-btn')?.focus();
        };
    }
    if (modalOverlay) {
        modalOverlay.onclick = (e) => {
            if (e.target === modalOverlay) {
                modalOverlay.classList.remove('active');
                document.querySelector('.more-tools-btn')?.focus();
            }
        };
    }

    // Info Modal Handlers
    const infoBtn = document.getElementById('infoBtn');
    const infoModalOverlay = document.getElementById('info-modal-overlay');
    const closeInfoBtn = document.getElementById('closeInfoModalBtn');

    if (infoBtn && infoModalOverlay) {
        infoBtn.onclick = () => {
            infoModalOverlay.classList.add('active');
            infoModalOverlay.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')?.focus();
        };
    }
    if (closeInfoBtn && infoModalOverlay) {
        closeInfoBtn.onclick = () => {
            infoModalOverlay.classList.remove('active');
            infoBtn.focus();
        };
    }
    if (infoModalOverlay) {
        infoModalOverlay.onclick = (e) => {
            if (e.target === infoModalOverlay) {
                infoModalOverlay.classList.remove('active');
                infoBtn.focus();
            }
        };
    }

    // Modal Escape Key & Focus Trap setup
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (modalOverlay?.classList.contains('active')) {
                modalOverlay.classList.remove('active');
                document.querySelector('.more-tools-btn')?.focus();
            }
            if (infoModalOverlay?.classList.contains('active')) {
                infoModalOverlay.classList.remove('active');
                infoBtn?.focus();
            }
        }
    });

    const trapFocus = (modal) => {
        if (!modal) return;
        modal.addEventListener('keydown', (e) => {
            if (e.key !== 'Tab') return;
            const focusable = Array.from(modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'))
                .filter(el => !el.hasAttribute('disabled') && el.offsetParent !== null);
            if (focusable.length === 0) return;

            const first = focusable[0];
            const last = focusable[focusable.length - 1];

            if (e.shiftKey) {
                if (document.activeElement === first || document.activeElement === modal) {
                    last.focus();
                    e.preventDefault();
                }
            } else {
                if (document.activeElement === last) {
                    first.focus();
                    e.preventDefault();
                }
            }
        });
    };

    trapFocus(modalOverlay);
    trapFocus(infoModalOverlay);

    // Setup global exception catchers for resiliency
    setupGlobalExceptionCatchers();

    // Load initial tool (Chladni)
    loadTool('chladni');

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

    document.getElementById('exportSvgBtn').addEventListener('click', async () => {
        if (currentTool && currentTool._visualizer && currentTool._visualizer.exportToSVG) {
            const svgString = await currentTool._visualizer.exportToSVG();
            if (svgString === null) {
                // Export was canceled by user or handled internally by the visualizer
                return;
            }
            if (!svgString) {
                alert('No media content available to export as SVG. Please load an image or video first.');
                return;
            }

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
            // Fallback: capture the first canvas inside the tool container
            const canvas = document.getElementById('tool-main-container')?.querySelector('canvas');
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
