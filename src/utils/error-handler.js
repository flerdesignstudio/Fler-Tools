/**
 * Global Error Handler & WebGL / GPU Guard Engine for Fler Tools.
 * Provides resilient error boundaries, hardware acceleration fault recovery, and user-facing fallback cards.
 */

/**
 * Diagnoses an error object or message to classify if it's related to WebGL / GPU acceleration or a runtime bug.
 * @param {Error|any} error 
 * @returns {{ type: string, description: string, technicalLog: string }}
 */
export function diagnoseError(error) {
    const message = error?.message || String(error || 'Unknown rendering error');
    const stack = error?.stack || 'No stack trace available.';
    const lowerMsg = message.toLowerCase();

    const isWebGL = lowerMsg.includes('webgl') || lowerMsg.includes('context') || 
                    lowerMsg.includes('glsl') || lowerMsg.includes('shader') || 
                    lowerMsg.includes('gpu') || lowerMsg.includes('vram');

    if (isWebGL) {
        return {
            type: 'WebGL / GPU Acceleration Error',
            description: 'The graphics pipeline or GPU context encountered a critical hardware acceleration error. This can happen if your browser temporarily lost WebGL context, failed to link a GLSL shader program, or ran out of video memory.',
            technicalLog: `${message}\n\nStack / Shader Trace:\n${stack}`
        };
    }

    return {
        type: 'Tool Runtime Exception',
        description: 'An unexpected runtime or initialization exception occurred while running this graphical tool.',
        technicalLog: `${message}\n\nStack Trace:\n${stack}`
    };
}

/**
 * Renders a fallback Error Boundary card inside the main tool container, protecting the application from freezing.
 * @param {HTMLElement} mainContainer 
 * @param {HTMLElement} sidebarContainer 
 * @param {string} toolName 
 * @param {Error|any} error 
 * @param {Function} onRecovery - Callback when user clicks "Return to Safety" (typically jumping back to Chladni)
 */
export function renderToolErrorUI(mainContainer, sidebarContainer, toolName, error, onRecovery) {
    const diagnosis = diagnoseError(error);

    // Clean up containers to remove broken or frozen canvas nodes
    if (sidebarContainer) {
        sidebarContainer.innerHTML = `
            <div class="info-group panel" style="padding: 16px;">
                <p style="color: var(--text-muted); font-size: 13px; line-height: 1.5;">
                    Tool parameters are currently suspended due to a rendering error. Please return to the default tool to continue.
                </p>
            </div>
        `;
    }

    if (mainContainer) {
        mainContainer.innerHTML = '';
        const wrapper = document.createElement('div');
        wrapper.className = 'error-boundary-wrapper';

        const card = document.createElement('div');
        card.className = 'error-boundary-card panel';

        const header = document.createElement('div');
        header.className = 'error-boundary-header';
        header.innerHTML = `
            <span class="material-symbols-outlined" style="color: #ff6b6b; font-size: 32px;">error_outline</span>
            <div class="error-boundary-title">Unable to Load Tool: ${toolName || 'Unknown Tool'}</div>
        `;

        const body = document.createElement('div');
        body.className = 'error-boundary-body';
        body.innerHTML = `
            <p style="margin-bottom: 8px;"><strong>Error Category:</strong> ${diagnosis.type}</p>
            <p>${diagnosis.description}</p>
        `;

        const actions = document.createElement('div');
        actions.className = 'error-boundary-actions';

        const recoveryBtn = document.createElement('button');
        recoveryBtn.className = 'notion-btn notion-btn-primary';
        recoveryBtn.innerHTML = `<span class="material-symbols-outlined" style="font-size: 16px; margin-right: 6px;">restart_alt</span> Return to Safety (Chladni)`;
        recoveryBtn.onclick = () => {
            if (typeof onRecovery === 'function') {
                onRecovery();
            }
        };

        const detailsBtn = document.createElement('button');
        detailsBtn.className = 'notion-btn notion-btn-secondary';
        detailsBtn.innerHTML = `<span class="material-symbols-outlined" style="font-size: 16px; margin-right: 6px;">code</span> Show Error Details / Stack Trace`;

        const stackBlock = document.createElement('div');
        stackBlock.className = 'error-stacktrace-block';
        stackBlock.style.display = 'none';
        stackBlock.textContent = diagnosis.technicalLog;

        let isExpanded = false;
        detailsBtn.onclick = () => {
            isExpanded = !isExpanded;
            stackBlock.style.display = isExpanded ? 'block' : 'none';
            detailsBtn.innerHTML = `<span class="material-symbols-outlined" style="font-size: 16px; margin-right: 6px;">${isExpanded ? 'unfold_less' : 'code'}</span> ${isExpanded ? 'Hide Error Details' : 'Show Error Details / Stack Trace'}`;
        };

        actions.appendChild(recoveryBtn);
        actions.appendChild(detailsBtn);
        card.appendChild(header);
        card.appendChild(body);
        card.appendChild(actions);
        card.appendChild(stackBlock);
        wrapper.appendChild(card);
        mainContainer.appendChild(wrapper);

        // Focus recovery button for keyboard navigation accessibility
        setTimeout(() => recoveryBtn.focus(), 50);
    }
}

/**
 * Sets up window-level global event catchers to prevent unhandled background or worker crashes from freezing the page.
 */
export function setupGlobalExceptionCatchers() {
    window.addEventListener('error', (event) => {
        console.error('[Fler Tools - Global Guard] Uncaught runtime exception observed:', event.error || event.message);
    });

    window.addEventListener('unhandledrejection', (event) => {
        console.error('[Fler Tools - Global Guard] Unhandled promise rejection observed:', event.reason);
    });
}

/**
 * Predictive helper for future WebGL / GLSL shaders.
 * Wraps a canvas element to safely catch GPU VRAM suspension (webglcontextlost) and restore seamlessly.
 * 
 * @param {HTMLCanvasElement} canvas 
 * @param {Function} onRestored - Callback invoked when the browser recovers GPU context (to reinitialize GLSL shaders & buffers)
 */
export function bindWebGLContextGuard(canvas, onRestored) {
    if (!canvas || !(canvas instanceof HTMLCanvasElement)) return;

    canvas.addEventListener('webglcontextlost', (e) => {
        // Prevent default browser behavior so context can be restored automatically when VRAM frees up
        e.preventDefault();
        console.warn('[Fler Tools - WebGL Guard] GPU context was temporarily lost on canvas:', canvas);
    }, false);

    canvas.addEventListener('webglcontextrestored', () => {
        console.info('[Fler Tools - WebGL Guard] GPU context restored. Rebuilding shaders and buffer data...');
        if (typeof onRestored === 'function') {
            try {
                onRestored();
            } catch (error) {
                console.error('[Fler Tools - WebGL Guard] Failed to rebuild shader pipeline upon context restore:', error);
            }
        }
    }, false);
}
