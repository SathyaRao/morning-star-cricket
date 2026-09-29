/**
 * GitHub-backed data store for Morning Star Cricket Attendance Tracker.
 * Reads/writes directly to data/data.json in the repo via the GitHub API.
 * Falls back to an in-memory cache for the current session.
 */
const Store = {
    // GitHub config - update OWNER and REPO to match your repository
    OWNER: 'SathyaRao',
    REPO: 'morning-star-cricket',
    FILE_PATH: 'data/data.json',
    BRANCH: 'main',

    // Internal cache
    _data: null,
    _sha: null,
    _loading: false,

    // --- Token management ---
    getToken() {
        return localStorage.getItem('ms_github_token') || '';
    },

    setToken(token) {
        localStorage.setItem('ms_github_token', token);
    },

    isConfigured() {
        return this.getToken().length > 0;
    },

    // --- Load data from GitHub ---
    async load() {
        if (this._loading) return this._data;
        this._loading = true;

        try {
            const url = `https://api.github.com/repos/${this.OWNER}/${this.REPO}/contents/${this.FILE_PATH}?ref=${this.BRANCH}&_=${Date.now()}`;
            const headers = { 'Accept': 'application/vnd.github.v3+json' };
            const token = this.getToken();
            if (token) headers['Authorization'] = `token ${token}`;

            const response = await fetch(url, { headers, cache: 'no-store' });

            if (!response.ok) {
                console.warn('GitHub load failed, using empty data:', response.status);
                this._data = this._default();
                return this._data;
            }

            const json = await response.json();
            this._sha = json.sha;
            const content = atob(json.content.replace(/\n/g, ''));
            this._data = JSON.parse(content);
        } catch (error) {
            console.error('Error loading from GitHub:', error);
            this._data = this._data || this._default();
        } finally {
            this._loading = false;
        }

        return this._data;
    },

    // --- Save data to GitHub ---
    async save() {
        if (!this.isConfigured()) {
            console.warn('No GitHub token configured, cannot save.');
            return false;
        }

        try {
            const url = `https://api.github.com/repos/${this.OWNER}/${this.REPO}/contents/${this.FILE_PATH}`;
            const token = this.getToken();

            // Get latest SHA to avoid conflicts
            const getResp = await fetch(`${url}?ref=${this.BRANCH}`, {
                headers: { 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github.v3+json' },
                cache: 'no-store',
            });
            if (getResp.ok) {
                const existing = await getResp.json();
                this._sha = existing.sha;
            }

            const content = btoa(unescape(encodeURIComponent(JSON.stringify(this._data, null, 2))));

            const body = {
                message: `Data update - ${new Date().toLocaleString()}`,
                content: content,
                branch: this.BRANCH,
            };
            if (this._sha) body.sha = this._sha;

            const putResp = await fetch(url, {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${token}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/vnd.github.v3+json',
                },
                body: JSON.stringify(body),
            });

            if (!putResp.ok) {
                const err = await putResp.json();
                console.error('GitHub save failed:', err);
                return false;
            }

            const result = await putResp.json();
            this._sha = result.content.sha;
            return true;
        } catch (error) {
            console.error('Error saving to GitHub:', error);
            return false;
        }
    },

    _default() {
        return { players: [], sessions: [], tournaments: [], playerStats: [] };
    },

    async _ensure() {
        if (!this._data) await this.load();
        return this._data;
    },

    // =========================================================================
    // PLAYERS
    // =========================================================================
    getPlayers() {
        return (this._data && this._data.players) || [];
    },

    async addPlayer(player) {
        await this._ensure();
        player.id = player.id || Date.now().toString();
        player.createdAt = new Date().toISOString();
        player.status = player.status || 'active';
        this._data.players.push(player);
        await this.save();
        return player;
    },

    async updatePlayer(id, updates) {
        await this._ensure();
        const index = this._data.players.findIndex(p => p.id === id);
        if (index !== -1) {
            this._data.players[index] = { ...this._data.players[index], ...updates };
            await this.save();
            return this._data.players[index];
        }
        return null;
    },

    async deletePlayer(id) {
        await this._ensure();
        this._data.players = this._data.players.filter(p => p.id !== id);
        // Also remove from sessions
        this._data.sessions = (this._data.sessions || []).map(s => {
            s.present = (s.present || []).filter(pid => pid !== id);
            return s;
        });
        await this.save();
    },

    getPlayerById(id) {
        return this.getPlayers().find(p => p.id === id) || null;
    },

    // =========================================================================
    // SESSIONS
    // =========================================================================
    getSessions() {
        return (this._data && this._data.sessions) || [];
    },

    async addSession(session) {
        await this._ensure();
        session.id = session.id || Date.now().toString();
        session.createdAt = new Date().toISOString();
        this._data.sessions.push(session);
        await this.save();
        return session;
    },

    async updateSession(id, updates) {
        await this._ensure();
        const index = this._data.sessions.findIndex(s => s.id === id);
        if (index !== -1) {
            this._data.sessions[index] = { ...this._data.sessions[index], ...updates };
            await this.save();
            return this._data.sessions[index];
        }
        return null;
    },

    async deleteSession(id) {
        await this._ensure();
        this._data.sessions = this._data.sessions.filter(s => s.id !== id);
        await this.save();
    },

    getSessionByDate(date) {
        return this.getSessions().find(s => s.date === date) || null;
    },

    // Remove ALL attendance sessions (players are kept). Returns count removed.
    async clearSessions() {
        await this._ensure();
        const removed = (this._data.sessions || []).length;
        this._data.sessions = [];
        await this.save();
        return removed;
    },

    // Remove attendance sessions dated strictly before the given cutoff (YYYY-MM-DD).
    // Players are kept. Returns count removed.
    async clearSessionsBefore(cutoffDate) {
        await this._ensure();
        const before = (this._data.sessions || []).length;
        this._data.sessions = (this._data.sessions || []).filter(
            s => !s.date || s.date >= cutoffDate
        );
        const removed = before - this._data.sessions.length;
        await this.save();
        return removed;
    },

    // =========================================================================
    // STATS (sync - uses cached data)
    // =========================================================================
    getPlayerAttendance(playerId) {
        const sessions = this.getSessions();
        let present = 0;
        const total = sessions.length;
        sessions.forEach(s => {
            if ((s.present || []).includes(playerId)) present++;
        });
        return { present, total, percentage: total > 0 ? Math.round((present / total) * 100) : 0 };
    },

    getOverallStats() {
        const players = this.getPlayers().filter(p => p.status === 'active');
        const sessions = this.getSessions();
        const currentMonth = new Date().toISOString().substring(0, 7);
        const monthSessions = sessions.filter(s => s.date && s.date.startsWith(currentMonth));

        return {
            totalPlayers: players.length,
            totalSessions: sessions.length,
            monthSessions: monthSessions.length,
            avgAttendance: sessions.length > 0
                ? Math.round(sessions.reduce((sum, s) => sum + (s.present || []).length, 0) / sessions.length)
                : 0,
        };
    },

    // =========================================================================
    // TOURNAMENTS
    // =========================================================================
    getTournaments() {
        return (this._data && this._data.tournaments) || [];
    },

    async addTournament(tournament) {
        await this._ensure();
        if (!this._data.tournaments) this._data.tournaments = [];
        tournament.id = tournament.id || Date.now().toString();
        tournament.createdAt = new Date().toISOString();
        this._data.tournaments.push(tournament);
        await this.save();
        return tournament;
    },

    async deleteTournament(id) {
        await this._ensure();
        this._data.tournaments = (this._data.tournaments || []).filter(t => t.id !== id);
        // Remove any player stats tied to this tournament
        this._data.playerStats = (this._data.playerStats || []).filter(s => s.tournamentId !== id);
        await this.save();
    },

    getTournamentById(id) {
        return this.getTournaments().find(t => t.id === id) || null;
    },

    // =========================================================================
    // PLAYER STATS (per player, per tournament)
    // =========================================================================
    // A stat record shape:
    // { id, tournamentId, playerId, matches, runs, ballsFaced, fours, sixes,
    //   notOuts, highScore, oversBowled, runsConceded, wickets, maidens,
    //   catches, stumpings, runOuts, createdAt }
    getStats() {
        return (this._data && this._data.playerStats) || [];
    },

    getStatsByTournament(tournamentId) {
        return this.getStats().filter(s => s.tournamentId === tournamentId);
    },

    getStatById(id) {
        return this.getStats().find(s => s.id === id) || null;
    },

    // A player can have at most one stat record per tournament.
    getStatForPlayerInTournament(playerId, tournamentId) {
        return this.getStats().find(
            s => s.playerId === playerId && s.tournamentId === tournamentId
        ) || null;
    },

    async addStat(stat) {
        await this._ensure();
        if (!this._data.playerStats) this._data.playerStats = [];
        stat.id = stat.id || Date.now().toString();
        stat.createdAt = new Date().toISOString();
        this._data.playerStats.push(stat);
        await this.save();
        return stat;
    },

    async updateStat(id, updates) {
        await this._ensure();
        const index = (this._data.playerStats || []).findIndex(s => s.id === id);
        if (index !== -1) {
            this._data.playerStats[index] = { ...this._data.playerStats[index], ...updates };
            await this.save();
            return this._data.playerStats[index];
        }
        return null;
    },

    async deleteStat(id) {
        await this._ensure();
        this._data.playerStats = (this._data.playerStats || []).filter(s => s.id !== id);
        await this.save();
    },

    // Aggregate a single player's stats across all tournaments (career totals + derived).
    getPlayerCareerStats(playerId) {
        const records = this.getStats().filter(s => s.playerId === playerId);
        const totals = {
            playerId,
            tournaments: records.length,
            matches: 0, runs: 0, ballsFaced: 0, fours: 0, sixes: 0, notOuts: 0,
            highScore: 0, oversBowled: 0, runsConceded: 0, wickets: 0, maidens: 0,
            catches: 0, stumpings: 0, runOuts: 0,
        };
        const num = v => {
            const n = Number(v);
            return isNaN(n) ? 0 : n;
        };
        records.forEach(r => {
            totals.matches += num(r.matches);
            totals.runs += num(r.runs);
            totals.ballsFaced += num(r.ballsFaced);
            totals.fours += num(r.fours);
            totals.sixes += num(r.sixes);
            totals.notOuts += num(r.notOuts);
            totals.highScore = Math.max(totals.highScore, num(r.highScore));
            totals.oversBowled += num(r.oversBowled);
            totals.runsConceded += num(r.runsConceded);
            totals.wickets += num(r.wickets);
            totals.maidens += num(r.maidens);
            totals.catches += num(r.catches);
            totals.stumpings += num(r.stumpings);
            totals.runOuts += num(r.runOuts);
        });

        // Derived metrics
        const dismissals = totals.matches - totals.notOuts;
        totals.battingAverage = dismissals > 0 ? +(totals.runs / dismissals).toFixed(2) : totals.runs;
        totals.strikeRate = totals.ballsFaced > 0 ? +((totals.runs / totals.ballsFaced) * 100).toFixed(2) : 0;
        totals.bowlingAverage = totals.wickets > 0 ? +(totals.runsConceded / totals.wickets).toFixed(2) : 0;
        totals.economy = totals.oversBowled > 0 ? +(totals.runsConceded / totals.oversBowled).toFixed(2) : 0;
        totals.dismissals = totals.catches + totals.stumpings + totals.runOuts;
        return totals;
    },

    // Career stats for every player that has at least one stat record.
    getAllPlayersCareerStats() {
        const playerIds = [...new Set(this.getStats().map(s => s.playerId))];
        return playerIds.map(pid => this.getPlayerCareerStats(pid));
    },

    // =========================================================================
    // UTILITY
    // =========================================================================
    async clearAll() {
        this._data = this._default();
        await this.save();
    },
};
