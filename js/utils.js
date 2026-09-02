/**
 * Utility functions
 */
const Utils = {
    showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    },

    formatDate(dateStr) {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    },

    today() {
        return new Date().toISOString().split('T')[0];
    },

    getPlayerName(playerId) {
        const player = Store.getPlayerById(playerId);
        return player ? player.name : 'Unknown';
    },

    setActiveNav() {
        const currentPage = window.location.pathname.split('/').pop() || 'index.html';
        document.querySelectorAll('.nav-links a').forEach(link => {
            if (link.getAttribute('href') === currentPage) {
                link.classList.add('active');
            }
        });
    },

    // Loading indicator (thin bar at top)
    showLoading() {
        let loader = document.getElementById('globalLoader');
        if (!loader) {
            loader = document.createElement('div');
            loader.id = 'globalLoader';
            loader.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:3px;background:#f0c040;z-index:9999;animation:msloading 1s infinite;';
            const style = document.createElement('style');
            style.textContent = '@keyframes msloading{0%{transform:translateX(-100%)}50%{transform:translateX(0)}100%{transform:translateX(100%)}}';
            document.head.appendChild(style);
            document.body.appendChild(loader);
        }
        loader.style.display = 'block';
    },

    hideLoading() {
        const loader = document.getElementById('globalLoader');
        if (loader) loader.style.display = 'none';
    },

    /**
     * Renders pagination controls into a container and calls renderPageFn(pageItems)
     * with the current page's slice of data.
     *
     * @param {Object} opts
     * @param {Array}  opts.items       - full array of records
     * @param {string} opts.containerId - id of the element to render pagination controls into
     * @param {Function} opts.renderPageFn - function(pageItems) that renders a page
     * @param {number} [opts.pageSize=10]  - rows per page
     * @param {string} [opts.stateKey]     - unique key to remember page size/current page
     */
    paginate(opts) {
        const { items, containerId, renderPageFn } = opts;
        const container = document.getElementById(containerId);
        if (!container) {
            renderPageFn(items);
            return;
        }

        const stateKey = opts.stateKey || containerId;
        this._pagState = this._pagState || {};
        const prev = this._pagState[stateKey] || {};
        let pageSize = opts.pageSize || prev.pageSize || 10;
        let currentPage = prev.currentPage || 1;

        const total = items.length;
        const totalPages = Math.max(1, Math.ceil(total / pageSize));
        if (currentPage > totalPages) currentPage = totalPages;

        const draw = () => {
            const start = (currentPage - 1) * pageSize;
            const pageItems = items.slice(start, start + pageSize);
            renderPageFn(pageItems);

            const from = total === 0 ? 0 : start + 1;
            const to = Math.min(start + pageSize, total);

            container.innerHTML = `
                <span class="page-info">${from}-${to} of ${total}</span>
                <label style="color:#aaa;font-size:0.85rem;">Rows:
                    <select data-role="size">
                        <option value="10" ${pageSize === 10 ? 'selected' : ''}>10</option>
                        <option value="20" ${pageSize === 20 ? 'selected' : ''}>20</option>
                        <option value="50" ${pageSize === 50 ? 'selected' : ''}>50</option>
                    </select>
                </label>
                <button data-role="first" ${currentPage === 1 ? 'disabled' : ''}>&laquo;</button>
                <button data-role="prev" ${currentPage === 1 ? 'disabled' : ''}>Prev</button>
                <span class="page-info" style="margin:0 0.3rem;">Page ${currentPage} / ${totalPages}</span>
                <button data-role="next" ${currentPage === totalPages ? 'disabled' : ''}>Next</button>
                <button data-role="last" ${currentPage === totalPages ? 'disabled' : ''}>&raquo;</button>
            `;

            container.querySelector('[data-role="size"]').onchange = (e) => {
                pageSize = parseInt(e.target.value, 10);
                currentPage = 1;
                this._pagState[stateKey] = { pageSize, currentPage };
                Utils.paginate({ ...opts, pageSize });
            };
            const go = (p) => {
                currentPage = p;
                this._pagState[stateKey] = { pageSize, currentPage };
                draw();
            };
            container.querySelector('[data-role="first"]').onclick = () => go(1);
            container.querySelector('[data-role="prev"]').onclick = () => go(Math.max(1, currentPage - 1));
            container.querySelector('[data-role="next"]').onclick = () => go(Math.min(totalPages, currentPage + 1));
            container.querySelector('[data-role="last"]').onclick = () => go(totalPages);

            this._pagState[stateKey] = { pageSize, currentPage };
        };

        draw();
    }
};

// Load data from GitHub, then signal pages that data is ready
document.addEventListener('DOMContentLoaded', async () => {
    Utils.setActiveNav();
    Utils.showLoading();
    await Store.load();
    Utils.hideLoading();
    window.dispatchEvent(new Event('dataReady'));
});
