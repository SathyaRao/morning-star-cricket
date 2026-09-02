/**
 * Admin page logic - manage players, mark attendance, view history
 * Uses GitHub-backed async store.
 */

let selectedPlayers = new Set();
let editingPlayerId = null;

window.addEventListener('dataReady', () => {
    document.getElementById('sessionDate').value = Utils.today();
    document.getElementById('playerForm').addEventListener('submit', handlePlayerSubmit);

    document.getElementById('sessionDate').addEventListener('change', () => {
        const date = document.getElementById('sessionDate').value;
        const session = Store.getSessionByDate(date);
        if (session) {
            selectedPlayers = new Set(session.present || []);
            document.getElementById('sessionType').value = session.type || 'practice';
            document.getElementById('sessionNotes').value = session.notes || '';
        } else {
            selectedPlayers.clear();
            document.getElementById('sessionNotes').value = '';
        }
        renderAttendanceGrid();
    });

    updateStats();
    renderAttendanceGrid();
    renderPlayers();
    renderHistory();
});

// --- Tabs ---
function showTab(tab) {
    document.getElementById('sectionAttendance').style.display = tab === 'attendance' ? 'block' : 'none';
    document.getElementById('sectionPlayers').style.display = tab === 'players' ? 'block' : 'none';
    document.getElementById('sectionHistory').style.display = tab === 'history' ? 'block' : 'none';

    document.getElementById('tabAttendance').className = `btn ${tab === 'attendance' ? 'btn-primary' : 'btn-danger'}`;
    document.getElementById('tabPlayers').className = `btn ${tab === 'players' ? 'btn-primary' : 'btn-danger'}`;
    document.getElementById('tabHistory').className = `btn ${tab === 'history' ? 'btn-primary' : 'btn-danger'}`;
}

// --- Stats ---
function updateStats() {
    const stats = Store.getOverallStats();
    document.getElementById('statPlayers').textContent = stats.totalPlayers;
    document.getElementById('statSessions').textContent = stats.totalSessions;
    document.getElementById('statMonth').textContent = stats.monthSessions;
    document.getElementById('statAvg').textContent = stats.avgAttendance;
}

// --- Attendance ---
function renderAttendanceGrid() {
    const players = Store.getPlayers().filter(p => p.status === 'active');
    const grid = document.getElementById('attendanceGrid');

    const date = document.getElementById('sessionDate').value;
    const existingSession = Store.getSessionByDate(date);
    if (existingSession) {
        selectedPlayers = new Set(existingSession.present || []);
    }

    grid.innerHTML = players.map(player => `
        <div class="attendance-item ${selectedPlayers.has(player.id) ? 'selected' : ''}" 
             onclick="togglePlayer('${player.id}')">
            <div class="checkbox"></div>
            <div class="player-name">${player.name}</div>
        </div>
    `).join('');

    if (players.length === 0) {
        grid.innerHTML = '<p style="color:#888;">No active players. Add players first.</p>';
    }
}

function togglePlayer(playerId) {
    if (selectedPlayers.has(playerId)) {
        selectedPlayers.delete(playerId);
    } else {
        selectedPlayers.add(playerId);
    }
    renderAttendanceGrid();
}

function selectAll() {
    const players = Store.getPlayers().filter(p => p.status === 'active');
    selectedPlayers = new Set(players.map(p => p.id));
    renderAttendanceGrid();
}

function deselectAll() {
    selectedPlayers.clear();
    renderAttendanceGrid();
}

async function saveAttendance() {
    const date = document.getElementById('sessionDate').value;
    const type = document.getElementById('sessionType').value;
    const notes = document.getElementById('sessionNotes').value.trim();

    if (!date) {
        Utils.showToast('Please select a date', 'error');
        return;
    }

    Utils.showLoading();
    const existingSession = Store.getSessionByDate(date);

    if (existingSession) {
        await Store.updateSession(existingSession.id, {
            present: Array.from(selectedPlayers),
            type,
            notes,
        });
        Utils.showToast('Attendance updated for ' + Utils.formatDate(date));
    } else {
        await Store.addSession({
            date,
            type,
            present: Array.from(selectedPlayers),
            notes,
        });
        Utils.showToast('Attendance saved for ' + Utils.formatDate(date));
    }
    Utils.hideLoading();

    updateStats();
    renderHistory();
    renderPlayers();
}

// --- Players ---
async function handlePlayerSubmit(e) {
    e.preventDefault();

    const playerData = {
        name: document.getElementById('playerName').value.trim(),
        phone: document.getElementById('playerPhone').value.trim(),
        role: document.getElementById('playerRole').value,
    };

    if (!playerData.name || !playerData.phone) {
        Utils.showToast('Please fill name and phone', 'error');
        return;
    }

    Utils.showLoading();
    if (editingPlayerId) {
        await Store.updatePlayer(editingPlayerId, playerData);
        Utils.showToast('Player updated');
        cancelPlayerEdit();
    } else {
        await Store.addPlayer(playerData);
        Utils.showToast('Player added');
    }
    Utils.hideLoading();

    document.getElementById('playerForm').reset();
    renderPlayers();
    renderAttendanceGrid();
    updateStats();
}

function renderPlayers() {
    const players = Store.getPlayers();
    const tbody = document.getElementById('playersTable');

    if (players.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#888;">No players added yet</td></tr>';
        return;
    }

    tbody.innerHTML = players.map(player => {
        const att = Store.getPlayerAttendance(player.id);
        return `
            <tr>
                <td>${player.name}</td>
                <td>${player.phone}</td>
                <td style="text-transform:capitalize;">${player.role || '-'}</td>
                <td>${att.present}/${att.total} (${att.percentage}%)</td>
                <td><span class="badge badge-${player.status}">${player.status}</span></td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="editPlayer('${player.id}')">Edit</button>
                    <button class="btn btn-sm btn-danger" onclick="togglePlayerStatus('${player.id}')">${player.status === 'active' ? 'Deactivate' : 'Activate'}</button>
                    <button class="btn btn-sm btn-danger" onclick="deletePlayer('${player.id}')">Delete</button>
                </td>
            </tr>
        `;
    }).join('');
}

function editPlayer(id) {
    const player = Store.getPlayerById(id);
    if (!player) return;

    editingPlayerId = id;
    document.getElementById('playerFormTitle').textContent = 'Edit Player';
    document.getElementById('playerSubmitBtn').textContent = 'Update Player';
    document.getElementById('playerCancelBtn').style.display = 'inline-block';

    document.getElementById('playerName').value = player.name;
    document.getElementById('playerPhone').value = player.phone;
    document.getElementById('playerRole').value = player.role || 'batsman';

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelPlayerEdit() {
    editingPlayerId = null;
    document.getElementById('playerFormTitle').textContent = 'Add Player';
    document.getElementById('playerSubmitBtn').textContent = 'Add Player';
    document.getElementById('playerCancelBtn').style.display = 'none';
    document.getElementById('playerForm').reset();
}

async function togglePlayerStatus(id) {
    const player = Store.getPlayerById(id);
    if (!player) return;
    Utils.showLoading();
    await Store.updatePlayer(id, { status: player.status === 'active' ? 'inactive' : 'active' });
    Utils.hideLoading();
    Utils.showToast(`Player ${player.status === 'active' ? 'deactivated' : 'activated'}`);
    renderPlayers();
    renderAttendanceGrid();
    updateStats();
}

async function deletePlayer(id) {
    if (!confirm('Delete this player and all their attendance records?')) return;
    Utils.showLoading();
    await Store.deletePlayer(id);
    Utils.hideLoading();
    Utils.showToast('Player deleted');
    renderPlayers();
    renderAttendanceGrid();
    renderHistory();
    updateStats();
}

// --- History ---
function renderHistory() {
    const sessions = Store.getSessions().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const activePlayers = Store.getPlayers().filter(p => p.status === 'active').length;
    const tbody = document.getElementById('historyTable');

    if (sessions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#888;">No sessions recorded yet</td></tr>';
        return;
    }

    tbody.innerHTML = sessions.map(session => `
        <tr>
            <td>${Utils.formatDate(session.date)}</td>
            <td style="text-transform:capitalize;">${session.type || '-'}</td>
            <td>${(session.present || []).length}</td>
            <td>${activePlayers}</td>
            <td>${session.notes || '-'}</td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="loadSession('${session.date}')">Edit</button>
                <button class="btn btn-sm btn-danger" onclick="deleteSession('${session.id}')">Delete</button>
            </td>
        </tr>
    `).join('');
}

function loadSession(date) {
    document.getElementById('sessionDate').value = date;
    const session = Store.getSessionByDate(date);
    if (session) {
        selectedPlayers = new Set(session.present || []);
        document.getElementById('sessionType').value = session.type || 'practice';
        document.getElementById('sessionNotes').value = session.notes || '';
    }
    showTab('attendance');
    renderAttendanceGrid();
    Utils.showToast('Session loaded for editing');
}

async function deleteSession(id) {
    if (!confirm('Delete this session record?')) return;
    Utils.showLoading();
    await Store.deleteSession(id);
    Utils.hideLoading();
    Utils.showToast('Session deleted');
    renderHistory();
    renderPlayers();
    updateStats();
}
