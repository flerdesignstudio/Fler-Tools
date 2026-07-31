/**
 * Shared utility for warning users about large SVG exports that may hang their browser or design software.
 * 
 * @param {number} elementCount - The estimated number of elements (paths, circles, rects, text)
 * @param {string} entityName - e.g. "shapes", "particles", "points", "text nodes"
 * @returns {Promise<boolean>} - Resolves to true if user clicks Proceed, false if Cancel
 */
export async function showLargeExportWarning(elementCount, entityName = 'elements') {
    const formattedCount = new Intl.NumberFormat().format(elementCount);
    const message = `This export will generate an SVG with approximately ${formattedCount} ${entityName}. The file may be very heavy and could take a while to render or open in design software. Do you want to proceed?`;

    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'tools-modal-overlay active';
        overlay.style.zIndex = '10000';

        const modalContent = document.createElement('div');
        modalContent.className = 'tools-modal-content panel';
        modalContent.style.maxWidth = '400px';
        modalContent.style.padding = '24px';

        const header = document.createElement('div');
        header.className = 'tools-modal-header';
        header.style.marginBottom = '16px';

        const title = document.createElement('h2');
        title.textContent = 'Large export warning';

        header.appendChild(title);

        const body = document.createElement('div');
        body.className = 'info-modal-body';
        body.style.fontSize = '14px';
        body.style.color = 'var(--text-secondary)';
        body.style.lineHeight = '1.6';
        body.style.marginBottom = '24px';
        body.textContent = message;

        const buttonRow = document.createElement('div');
        buttonRow.style.display = 'flex';
        buttonRow.style.gap = '12px';
        buttonRow.style.justifyContent = 'flex-end';

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'notion-btn notion-btn-tertiary';
        cancelBtn.textContent = 'Cancel';

        const proceedBtn = document.createElement('button');
        proceedBtn.className = 'notion-btn notion-btn-primary';
        proceedBtn.textContent = 'Proceed';

        buttonRow.appendChild(cancelBtn);
        buttonRow.appendChild(proceedBtn);

        modalContent.appendChild(header);
        modalContent.appendChild(body);
        modalContent.appendChild(buttonRow);
        overlay.appendChild(modalContent);
        document.body.appendChild(overlay);

        const cleanup = () => {
            document.body.removeChild(overlay);
        };

        const cancel = () => { cleanup(); resolve(false); };
        const proceed = () => { cleanup(); resolve(true); };

        cancelBtn.onclick = cancel;
        overlay.onclick = (e) => { if (e.target === overlay) cancel(); };
        proceedBtn.onclick = proceed;
        
        // Basic focus trap/keyboard nav for the modal
        cancelBtn.focus();
        
        overlay.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                cancel();
            } else if (e.key === 'Tab') {
                if (e.shiftKey) {
                    if (document.activeElement === cancelBtn) {
                        e.preventDefault();
                        proceedBtn.focus();
                    }
                } else {
                    if (document.activeElement === proceedBtn) {
                        e.preventDefault();
                        cancelBtn.focus();
                    }
                }
            }
        });
    });
}
