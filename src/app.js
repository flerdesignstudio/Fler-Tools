import chladniTool from './tools/chladni/chladni-ui.js';
import hydrogenTool from './tools/hydrogen/hydrogen-ui.js';

// --- Tool Registry ---
export const tools = {
    [chladniTool.id]: chladniTool,
    [hydrogenTool.id]: hydrogenTool
    // New tools will be imported and added here
};

let currentTool = null;

export const loadTool = (toolId) => {
    const tool = tools[toolId];
    if (!tool) return;
    if (currentTool === tool) return; // already loaded

    const sidebarContainer = document.getElementById('tool-sidebar-container');
    const mainContainer = document.getElementById('tool-main-container');

    // 1. Teardown active tool
    if (currentTool && currentTool.destroy) {
        currentTool.destroy();
    }

    // Update active state in nav
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.toolId === toolId);
    });

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
});
