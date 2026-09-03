/**
 * Admin password gate for Morning Star Cricket.
 *
 * NOTE: This is a client-side deterrent, not real security. The actual
 * protection against unauthorized data changes is the GitHub token
 * (configured in Settings) - without it, no writes to the repo are possible.
 *
 * Default password: morningstar2026
 * To change it: compute the SHA-256 of your new password and replace
 * ADMIN_PASSWORD_HASH below.
 */

const ADMIN_PASSWORD_HASH =
    '6a8636b89b32a0abdab9ee1fa180de8975e1fd524bd40f4fbb2d0aae133d5456';

// Session flag so the user doesn't re-enter the password on every action
const ADMIN_SESSION_KEY = 'ms_admin_unlocked';

async function sha256Hex(text) {
    const data = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(digest))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

async function unlockAdmin() {
    const input = document.getElementById('adminPassword');
    const errorEl = document.getElementById('adminLockError');
    const entered = input.value;

    if (!entered) {
        errorEl.textContent = 'Please enter the password.';
        errorEl.style.display = 'block';
        return;
    }

    const hash = await sha256Hex(entered);
    if (hash === ADMIN_PASSWORD_HASH) {
        sessionStorage.setItem(ADMIN_SESSION_KEY, 'true');
        showAdminContent();
    } else {
        errorEl.textContent = 'Incorrect password.';
        errorEl.style.display = 'block';
        input.value = '';
    }
}

function lockAdmin() {
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    document.getElementById('adminContent').style.display = 'none';
    document.getElementById('adminLock').style.display = 'block';
    const input = document.getElementById('adminPassword');
    if (input) input.value = '';
}

function showAdminContent() {
    document.getElementById('adminLock').style.display = 'none';
    document.getElementById('adminContent').style.display = 'block';
    document.getElementById('adminLockError').style.display = 'none';
}

// On load, if already unlocked this session, skip the gate
window.addEventListener('dataReady', () => {
    if (sessionStorage.getItem(ADMIN_SESSION_KEY) === 'true') {
        showAdminContent();
    } else {
        document.getElementById('adminContent').style.display = 'none';
        document.getElementById('adminLock').style.display = 'block';
    }
});
