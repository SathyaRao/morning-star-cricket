/**
 * Member page - read-only attendance view for players
 */

let currentPlayerId = null;

function lookupPlayer() {
    const phone = document.getElementById('lookupPhone').value.trim();
    const errorEl = document.getElementById('lookupError');

    if (!phone) {
        errorEl.textContent = 'Please enter your phone number.';
        errorEl.style.display = 'block';
        return;
    }

    const players = Store.getPlayers();
    const player = players.find(p => p.phone === phone);

    if (!player) {
        errorEl.textContent = 'No player found with this phone number.';
        errorEl.style.display = 'block';
        return;
    }

    errorEl.style.display = 'none';
    currentPlayerId = player.id;
    renderProfile(player);
}

function renderProfile(player) {
    document.getElementById('lookupSection').style.display = 'none';
    document.getElementById('profileSection').style.display = 'block';

    // Basic info
    document.getElementById('profileName').textContent = player.name;
    document.getElementById('profileRole').textContent = capitalize(player.role);

    // Overall attendance
    const att = Store.getPlayerAttendance(player.id);
    document.getElementById('profilePresent').textContent = att.present;
    document.getElementById('profileTotal').textContent = `out of ${att.total} sessions`;
    document.getElementById('profilePercentage').textContent = att.percentage + '%';

    // This month
    const currentMonth = new Date().toISOString().substring(0, 7);
    const sessions = Store.getSessions();
    const monthSessions = sessions.filter(s => s.date && s.date.startsWith(currentMonth));
    const monthPresent = monthSessions.filter(s => (s.present || []).includes(player.id)).length;
    document.getElementById('profileMonthCount').textContent = monthPresent;

    // Attendance history
    renderHistory(player.id);
}

function renderHistory(playerId) {
    const sessions = Store.getSessions().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const tbody = document.getElementById('profileHistory');

    if (sessions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:#888;">No sessions recorded yet</td></tr>';
        return;
    }

    tbody.innerHTML = sessions.map(session => {
        const wasPresent = (session.present || []).includes(playerId);
        return `
            <tr>
                <td>${Utils.formatDate(session.date)}</td>
                <td style="text-transform:capitalize;">${session.type || '-'}</td>
                <td><span class="badge badge-${wasPresent ? 'present' : 'absent'}">${wasPresent ? 'Present' : 'Absent'}</span></td>
            </tr>
        `;
    }).join('');
}

function showLookup() {
    currentPlayerId = null;
    document.getElementById('profileSection').style.display = 'none';
    document.getElementById('lookupSection').style.display = 'block';
    document.getElementById('lookupPhone').value = '';
}

function capitalize(str) {
    if (!str) return '-';
    return str.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

// Allow Enter key
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('lookupPhone').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') lookupPlayer();
    });
});
