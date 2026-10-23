/**
 * Admin password gate for Morning Star Cricket.
 *
 * NOTE: This is a client-side deterrent, not real security. The actual
 * protection against unauthorized data changes is the GitHub token
 * (configured in Settings) - without it, no writes to the repo are possible.
 *
 * Two roles:
 *   - admin      (password: morningstar2026) - restricted: may only mark/edit
 *                 attendance for the CURRENT date, not past dates.
 *   - superuser  (password: superstar2026)   - full privileges, any date.
 *
 * To change a password: compute the SHA-256 of your new password and replace
 * the matching hash below.
 */

const ADMIN_PASSWORD_HASH =
    '6a8636b89b32a0abdab9ee1fa180de8975e1fd524bd40f4fbb2d0aae133d5456';
const SUPERUSER_PASSWORD_HASH =
    '933270daac7111102fd480d84b1fe3bb7eab0b1526b36ecfea68c51f825df2e5';

// Session flags so the user doesn't re-enter the password on every action
const ADMIN_SESSION_KEY = 'ms_admin_unlocked';
const ADMIN_ROLE_KEY = 'ms_admin_role'; // 'admin' | 'superuser'

// Current role for this session ('admin' | 'superuser' | null).
function getAdminRole() {
    return sessionStorage.getItem(ADMIN_ROLE_KEY);
}

// True when the unlocked user has full (superuser) privileges.
function isSuperuser() {
    return getAdminRole() === 'superuser';
}

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
    if (hash === SUPERUSER_PASSWORD_HASH) {
        sessionStorage.setItem(ADMIN_SESSION_KEY, 'true');
        sessionStorage.setItem(ADMIN_ROLE_KEY, 'superuser');
        showAdminContent();
    } else if (hash === ADMIN_PASSWORD_HASH) {
        sessionStorage.setItem(ADMIN_SESSION_KEY, 'true');
        sessionStorage.setItem(ADMIN_ROLE_KEY, 'admin');
        showAdminContent();
    } else {
        errorEl.textContent = 'Incorrect password.';
        errorEl.style.display = 'block';
        input.value = '';
    }
}

function lockAdmin() {
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    sessionStorage.removeItem(ADMIN_ROLE_KEY);
    document.getElementById('adminContent').style.display = 'none';
    document.getElementById('adminLock').style.display = 'block';
    const input = document.getElementById('adminPassword');
    if (input) input.value = '';
}

function showAdminContent() {
    document.getElementById('adminLock').style.display = 'none';
    document.getElementById('adminContent').style.display = 'block';
    document.getElementById('adminLockError').style.display = 'none';
    // Let the page apply role-based restrictions (defined in admin.js).
    if (typeof applyRoleRestrictions === 'function') {
        applyRoleRestrictions();
    }
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
