/**
 * Shared pan/zoom utility for tool preview containers.
 *
 * Provides consistent scroll-to-zoom and drag-to-pan behaviour across all tools
 * that render into a wrapper element inside a preview container.
 *
 * Usage:
 *   import { createPanZoom, addListenerTracked } from '../../utils/pan-zoom.js';
 *
 *   const { resetView, view } = createPanZoom({
 *       containerId: 'thermalPreview',
 *       wrapperId:   'thermalCanvasWrapper',
 *       listeners:   this._listeners,
 *   });
 *   // later: resetView();  // resets pan, zoom, dragging state
 */

/**
 * Register an event listener on `el` and push a cleanup record into `store`.
 * Skips silently when `el` is null/undefined.
 */
export function addListenerTracked(el, eventName, handler, store) {
    if (!el) return;
    el.addEventListener(eventName, handler);
    store.push({ el, eventName, handler });
}

/**
 * Bind pan (pointer-drag) and zoom (wheel) behaviour to a container/wrapper pair.
 *
 * @param {Object}   opts
 * @param {string}   opts.containerId  — ID of the outer overflow container (receives events)
 * @param {string}   opts.wrapperId    — ID of the inner wrapper whose `transform` is updated
 * @param {Array}    opts.listeners    — Mutable array where cleanup records are pushed
 * @param {Object}  [opts.view]        — Optional pre-existing view state to reuse
 * @returns {{ view: Object, resetView: Function }}
 */
export function createPanZoom({ containerId, wrapperId, listeners, view: externalView }) {
    const view = externalView || { isDragging: false, startX: 0, startY: 0, panX: 0, panY: 0, zoom: 1 };

    const container = document.getElementById(containerId);
    const wrapper   = document.getElementById(wrapperId);
    if (!container || !wrapper) {
        return { view, resetView() {} };
    }

    const applyTransforms = () => {
        wrapper.style.transform = `translate(${view.panX}px, ${view.panY}px) scale(${view.zoom})`;
    };

    // — Scroll-to-zoom (additive, deltaY * -0.002, clamped [0.1, 10]) —
    addListenerTracked(container, 'wheel', (e) => {
        e.preventDefault();
        view.zoom = Math.min(10, Math.max(0.1, view.zoom + e.deltaY * -0.002));
        applyTransforms();
    }, listeners);

    // — Pointer-drag to pan —
    addListenerTracked(container, 'pointerdown', (e) => {
        if (e.button !== 0) return; // left click only
        // Skip interactive elements so selects/buttons still work
        if (['INPUT', 'SELECT', 'BUTTON', 'LABEL'].includes(e.target.tagName)) return;
        view.isDragging = true;
        view.startX = e.clientX - view.panX;
        view.startY = e.clientY - view.panY;
        container.setPointerCapture(e.pointerId);
    }, listeners);

    addListenerTracked(container, 'pointermove', (e) => {
        if (!view.isDragging) return;
        view.panX = e.clientX - view.startX;
        view.panY = e.clientY - view.startY;
        applyTransforms();
    }, listeners);

    const stopDrag = (e) => {
        if (!view.isDragging) return;
        view.isDragging = false;
        if (container.hasPointerCapture(e.pointerId)) {
            container.releasePointerCapture(e.pointerId);
        }
    };

    addListenerTracked(container, 'pointerup', stopDrag, listeners);
    addListenerTracked(container, 'pointercancel', stopDrag, listeners);

    /** Reset all view state to defaults and apply. */
    const resetView = () => {
        Object.assign(view, { isDragging: false, startX: 0, startY: 0, panX: 0, panY: 0, zoom: 1 });
        applyTransforms();
    };

    return { view, resetView };
}
