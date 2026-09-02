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
