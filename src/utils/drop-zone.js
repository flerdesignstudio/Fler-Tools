/**
 * Shared drop-zone utility for tools that accept file uploads via drag-and-drop.
 *
 * Usage:
 *   import { bindDropZone } from '../../utils/drop-zone.js';
 *
 *   bindDropZone({
 *       dropZoneId:  'thermalDropZone',
 *       fileInputId: 'thermalMediaUpload',
 *       onFile:      (file) => this._visualizer.loadMedia(file),
 *       listeners:   this._listeners,
 *   });
 */

import { addListenerTracked } from './pan-zoom.js';

/**
 * Wire up a drop-zone element and its companion file input.
 *
 * @param {Object}   opts
 * @param {string}   opts.dropZoneId   — ID of the `.tool-drop-zone` container
 * @param {string}   opts.fileInputId  — ID of the hidden `<input type="file">`
 * @param {Function} opts.onFile       — Callback receiving the chosen `File`
 * @param {Array}    opts.listeners    — Mutable array where cleanup records are pushed
 */
export function bindDropZone({ dropZoneId, fileInputId, onFile, listeners }) {
    const dropZone  = document.getElementById(dropZoneId);
    const fileInput = document.getElementById(fileInputId);

    if (dropZone) {
        dropZone.tabIndex = 0;
        addListenerTracked(dropZone, 'keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                if (fileInput) fileInput.click();
            }
        }, listeners);

        ['dragenter', 'dragover'].forEach((eventName) => {
            addListenerTracked(dropZone, eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropZone.classList.add('dragover');
            }, listeners);
        });

        ['dragleave', 'drop'].forEach((eventName) => {
            addListenerTracked(dropZone, eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropZone.classList.remove('dragover');
                if (eventName === 'drop' && e.dataTransfer?.files?.[0]) {
                    onFile(e.dataTransfer.files[0]);
                }
            }, listeners);
        });
    }

    if (fileInput) {
        addListenerTracked(fileInput, 'change', (e) => {
            const file = e.target.files[0];
            if (file) onFile(file);
        }, listeners);
    }
}
