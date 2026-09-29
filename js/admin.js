/**
 * Admin page logic - manage players, mark attendance, view history
 * Uses GitHub-backed async store.
 */

let selectedPlayers = new Set();
let editingPlayerId = null;

window.addEventListener('dataReady', () => {
    document.getElementById('sessionDate').value = Utils.today();
    const clearBefore = document.getElementById('clearBeforeDate');
    if (clearBefore) clearBefore.value = Utils.today();
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
    document.getElementById('sectionStats').style.display = tab === 'stats' ? 'block' : 'none';

    document.getElementById('tabAttendance').className = `btn ${tab === 'attendance' ? 'btn-primary' : 'btn-danger'}`;
    document.getElementById('tabPlayers').className = `btn ${tab === 'players' ? 'btn-primary' : 'btn-danger'}`;
    document.getElementById('tabHistory').className = `btn ${tab === 'history' ? 'btn-primary' : 'btn-danger'}`;
    document.getElementById('tabStats').className = `btn ${tab === 'stats' ? 'btn-primary' : 'btn-danger'}`;

    if (tab === 'stats') {
        populateStatDropdowns();
        renderStatsTable();
    }
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
function renderAttendanceGrid(reloadFromSession = true) {
    const players = Store.getPlayers().filter(p => p.status === 'active');
    const grid = document.getElementById('attendanceGrid');

    // Only reload the saved session into selection on a fresh render
    // (date change / initial load / edit). NOT on every toggle re-render,
    // otherwise user's clicks would be immediately overwritten.
    if (reloadFromSession) {
        const date = document.getElementById('sessionDate').value;
        const existingSession = Store.getSessionByDate(date);
        selectedPlayers = new Set(existingSession ? (existingSession.present || []) : []);
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
    renderAttendanceGrid(false);
}

function selectAll() {
    const players = Store.getPlayers().filter(p => p.status === 'active');
    selectedPlayers = new Set(players.map(p => p.id));
    renderAttendanceGrid(false);
}

function deselectAll() {
    selectedPlayers.clear();
    renderAttendanceGrid(false);
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

    if (!playerData.name) {
        Utils.showToast('Please enter the player name', 'error');
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
        document.getElementById('playersPagination').innerHTML = '';
        return;
    }

    Utils.paginate({
        items: players,
        containerId: 'playersPagination',
        stateKey: 'players',
        renderPageFn: (pageItems) => {
            tbody.innerHTML = pageItems.map(player => {
                const att = Store.getPlayerAttendance(player.id);
                return `
                    <tr>
                        <td>${player.name}</td>
                        <td>${player.phone || '-'}</td>
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
    });
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
        document.getElementById('historyPagination').innerHTML = '';
        return;
    }

    Utils.paginate({
        items: sessions,
        containerId: 'historyPagination',
        stateKey: 'history',
        renderPageFn: (pageItems) => {
            tbody.innerHTML = pageItems.map(session => `
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
    });
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

// Clear attendance sessions dated before the chosen cutoff (players kept).
async function clearPreviousAttendance() {
    const cutoff = document.getElementById('clearBeforeDate').value;
    if (!cutoff) {
        Utils.showToast('Please pick a cutoff date first', 'error');
        return;
    }

    const toRemove = Store.getSessions().filter(s => s.date && s.date < cutoff).length;
    if (toRemove === 0) {
        Utils.showToast('No sessions before ' + Utils.formatDate(cutoff), 'error');
        return;
    }
    if (!confirm(`Clear ${toRemove} attendance session(s) before ${Utils.formatDate(cutoff)}? This cannot be undone.`)) {
        return;
    }

    Utils.showLoading();
    const removed = await Store.clearSessionsBefore(cutoff);
    Utils.hideLoading();
    Utils.showToast(`Cleared ${removed} previous session(s)`);
    renderHistory();
    renderPlayers();
    updateStats();
}

// Clear ALL attendance sessions (players kept).
async function clearAllAttendance() {
    const total = Store.getSessions().length;
    if (total === 0) {
        Utils.showToast('No attendance sessions to clear', 'error');
        return;
    }
    if (!confirm(`Clear ALL ${total} attendance session(s)? Players are kept. This cannot be undone.`)) {
        return;
    }

    Utils.showLoading();
    const removed = await Store.clearSessions();
    Utils.hideLoading();
    Utils.showToast(`Cleared all ${removed} session(s)`);
    renderHistory();
    renderPlayers();
    updateStats();
}

// =============================================================================
// PLAYER STATS (per tournament)
// =============================================================================
let editingStatId = null;

const STAT_FIELDS = [
    ['matches', 'statMatches'], ['runs', 'statRuns'], ['ballsFaced', 'statBalls'],
    ['fours', 'statFours'], ['sixes', 'statSixes'], ['notOuts', 'statNotOuts'],
    ['highScore', 'statHighScore'], ['oversBowled', 'statOvers'],
    ['runsConceded', 'statRunsConceded'], ['wickets', 'statWickets'],
    ['maidens', 'statMaidens'], ['catches', 'statCatches'],
    ['stumpings', 'statStumpings'], ['runOuts', 'statRunOuts'],
];

function populateStatDropdowns() {
    // Tournaments
    const tSel = document.getElementById('statTournament');
    const tournaments = Store.getTournaments();
    const prevT = tSel.value;
    tSel.innerHTML = tournaments.length
        ? tournaments.map(t => `<option value="${t.id}">${t.name}${t.year ? ' (' + t.year + ')' : ''}</option>`).join('')
        : '<option value="">No tournaments yet</option>';
    if (prevT && tournaments.some(t => t.id === prevT)) tSel.value = prevT;

    // Players (active only)
    const pSel = document.getElementById('statPlayer');
    const players = Store.getPlayers().filter(p => p.status === 'active');
    pSel.innerHTML = players.length
        ? players.map(p => `<option value="${p.id}">${p.name}</option>`).join('')
        : '<option value="">No players</option>';
}

async function addTournament() {
    const name = document.getElementById('tournamentName').value.trim();
    const year = document.getElementById('tournamentYear').value.trim();
    if (!name) {
        Utils.showToast('Enter a tournament name', 'error');
        return;
    }
    Utils.showLoading();
    const t = await Store.addTournament({ name, year });
    Utils.hideLoading();
    Utils.showToast('Tournament added');
    document.getElementById('tournamentName').value = '';
    document.getElementById('tournamentYear').value = '';
    populateStatDropdowns();
    document.getElementById('statTournament').value = t.id;
    onStatTournamentChange();
}

async function deleteCurrentTournament() {
    const tId = document.getElementById('statTournament').value;
    if (!tId) {
        Utils.showToast('No tournament selected', 'error');
        return;
    }
    const t = Store.getTournamentById(tId);
    const count = Store.getStatsByTournament(tId).length;
    if (!confirm(`Delete tournament "${t ? t.name : ''}" and its ${count} stat record(s)? This cannot be undone.`)) {
        return;
    }
    Utils.showLoading();
    await Store.deleteTournament(tId);
    Utils.hideLoading();
    Utils.showToast('Tournament deleted');
    cancelStatEdit();
    populateStatDropdowns();
    onStatTournamentChange();
}

function onStatTournamentChange() {
    cancelStatEdit();
    renderStatsTable();
}

function readStatForm() {
    const stat = {
        tournamentId: document.getElementById('statTournament').value,
        playerId: document.getElementById('statPlayer').value,
    };
    STAT_FIELDS.forEach(([key, elId]) => {
        const raw = document.getElementById(elId).value;
        const n = Number(raw);
        stat[key] = isNaN(n) ? 0 : n;
    });
    return stat;
}

function resetStatForm() {
    document.getElementById('statMatches').value = '0';
    STAT_FIELDS.forEach(([, elId]) => {
        document.getElementById(elId).value = '0';
    });
    updateDerivedStats();
}

// Live-compute the read-only batting Avg/SR and bowling Avg/Econ fields
// from the raw numbers the admin enters.
function updateDerivedStats() {
    const num = id => {
        const n = Number(document.getElementById(id).value);
        return isNaN(n) ? 0 : n;
    };
    const matches = num('statMatches');
    const runs = num('statRuns');
    const balls = num('statBalls');
    const notOuts = num('statNotOuts');
    const overs = num('statOvers');
    const runsConceded = num('statRunsConceded');
    const wickets = num('statWickets');

    const dismissals = matches - notOuts;
    const batAvg = dismissals > 0
        ? (runs / dismissals).toFixed(2)
        : (runs > 0 ? runs.toFixed(2) : '-');
    const strikeRate = balls > 0 ? ((runs / balls) * 100).toFixed(1) : '-';
    const bowlAvg = wickets > 0 ? (runsConceded / wickets).toFixed(2) : '-';
    const economy = overs > 0 ? (runsConceded / overs).toFixed(2) : '-';

    document.getElementById('statBatAvg').value = batAvg;
    document.getElementById('statStrikeRate').value = strikeRate;
    document.getElementById('statBowlAvg').value = bowlAvg;
    document.getElementById('statEconomy').value = economy;
}

async function saveStat() {
    const stat = readStatForm();
    if (!stat.tournamentId) {
        Utils.showToast('Select or create a tournament first', 'error');
        return;
    }
    if (!stat.playerId) {
        Utils.showToast('Select a player', 'error');
        return;
    }

    Utils.showLoading();
    if (editingStatId) {
        await Store.updateStat(editingStatId, stat);
        Utils.showToast('Stats updated');
    } else {
        // Upsert: if this player already has a record in this tournament, update it.
        const existing = Store.getStatForPlayerInTournament(stat.playerId, stat.tournamentId);
        if (existing) {
            await Store.updateStat(existing.id, stat);
            Utils.showToast('Existing stats updated for ' + Utils.getPlayerName(stat.playerId));
        } else {
            await Store.addStat(stat);
            Utils.showToast('Stats saved for ' + Utils.getPlayerName(stat.playerId));
        }
    }
    Utils.hideLoading();
    cancelStatEdit();
    renderStatsTable();
}

function editStat(id) {
    const stat = Store.getStatById(id);
    if (!stat) return;
    editingStatId = id;
    document.getElementById('statFormTitle').textContent = 'Edit Player Stats';
    document.getElementById('statSubmitBtn').textContent = 'Update Stats';
    document.getElementById('statCancelBtn').style.display = 'inline-block';

    document.getElementById('statTournament').value = stat.tournamentId;
    document.getElementById('statPlayer').value = stat.playerId;
    STAT_FIELDS.forEach(([key, elId]) => {
        document.getElementById(elId).value = stat[key] != null ? stat[key] : 0;
    });
    updateDerivedStats();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelStatEdit() {
    editingStatId = null;
    document.getElementById('statFormTitle').textContent = 'Enter Player Stats';
    document.getElementById('statSubmitBtn').textContent = 'Save Stats';
    document.getElementById('statCancelBtn').style.display = 'none';
    resetStatForm();
}

async function deleteStat(id) {
    if (!confirm('Delete this stat record?')) return;
    Utils.showLoading();
    await Store.deleteStat(id);
    Utils.hideLoading();
    Utils.showToast('Stat record deleted');
    renderStatsTable();
}

function renderStatsTable() {
    const tId = document.getElementById('statTournament').value;
    const tbody = document.getElementById('statsTable');
    const label = document.getElementById('statTournamentLabel');
    const t = Store.getTournamentById(tId);
    label.textContent = t ? `— ${t.name}${t.year ? ' (' + t.year + ')' : ''}` : '';

    if (!tId) {
        tbody.innerHTML = '<tr><td colspan="11" style="text-align:center; color:#888;">Create a tournament to start entering stats</td></tr>';
        document.getElementById('statsPagination').innerHTML = '';
        return;
    }

    const records = Store.getStatsByTournament(tId);
    if (records.length === 0) {
        tbody.innerHTML = '<tr><td colspan="11" style="text-align:center; color:#888;">No stats entered for this tournament yet</td></tr>';
        document.getElementById('statsPagination').innerHTML = '';
        return;
    }

    const num = v => { const n = Number(v); return isNaN(n) ? 0 : n; };
    const rows = records.slice().sort((a, b) => num(b.runs) - num(a.runs));

    Utils.paginate({
        items: rows,
        containerId: 'statsPagination',
        stateKey: 'stats',
        renderPageFn: (pageItems) => {
            tbody.innerHTML = pageItems.map(s => {
                const dismissals = num(s.matches) - num(s.notOuts);
                const batAvg = dismissals > 0
                    ? (num(s.runs) / dismissals).toFixed(2)
                    : (num(s.runs) > 0 ? num(s.runs).toFixed(2) : '-');
                const sr = num(s.ballsFaced) > 0 ? ((num(s.runs) / num(s.ballsFaced)) * 100).toFixed(1) : '-';
                const bowlAvg = num(s.wickets) > 0 ? (num(s.runsConceded) / num(s.wickets)).toFixed(2) : '-';
                const econ = num(s.oversBowled) > 0 ? (num(s.runsConceded) / num(s.oversBowled)).toFixed(2) : '-';
                return `
                    <tr>
                        <td>${Utils.getPlayerName(s.playerId)}</td>
                        <td>${num(s.matches)}</td>
                        <td>${num(s.runs)}</td>
                        <td>${num(s.highScore)}</td>
                        <td>${batAvg}</td>
                        <td>${sr}</td>
                        <td>${num(s.wickets)}</td>
                        <td>${bowlAvg}</td>
                        <td>${econ}</td>
                        <td>${num(s.catches)}/${num(s.stumpings)}/${num(s.runOuts)}</td>
                        <td>
                            <button class="btn btn-sm btn-primary" onclick="editStat('${s.id}')">Edit</button>
                            <button class="btn btn-sm btn-danger" onclick="deleteStat('${s.id}')">Delete</button>
                        </td>
                    </tr>
                `;
            }).join('');
        }
    });
}
