/**
 * Player Stats dashboard - overall career totals aggregated across tournaments.
 * Uses the GitHub-backed async Store.
 */

window.addEventListener('dataReady', () => {
    renderOverview();
    renderLeaders();
    renderStatsDashboard();
});

function renderOverview() {
    const careers = Store.getAllPlayersCareerStats();
    const totalRuns = careers.reduce((sum, c) => sum + c.runs, 0);
    const totalWickets = careers.reduce((sum, c) => sum + c.wickets, 0);

    document.getElementById('ovTournaments').textContent = Store.getTournaments().length;
    document.getElementById('ovPlayers').textContent = careers.length;
    document.getElementById('ovRuns').textContent = totalRuns;
    document.getElementById('ovWickets').textContent = totalWickets;
}

function renderLeaders() {
    const careers = Store.getAllPlayersCareerStats();
    if (careers.length === 0) return;

    const named = careers.map(c => ({ ...c, name: Utils.getPlayerName(c.playerId) }));

    const topRuns = [...named].sort((a, b) => b.runs - a.runs)[0];
    const topWickets = [...named].sort((a, b) => b.wickets - a.wickets)[0];
    // Best batting average needs a minimum sample to be meaningful (>= 3 matches).
    const avgEligible = named.filter(c => c.matches >= 3);
    const topAvg = (avgEligible.length ? avgEligible : named)
        .sort((a, b) => b.battingAverage - a.battingAverage)[0];
    const topField = [...named].sort((a, b) => b.dismissals - a.dismissals)[0];

    setLeader('leaderRuns', 'leaderRunsVal', topRuns, topRuns.runs + ' runs');
    setLeader('leaderWickets', 'leaderWicketsVal', topWickets, topWickets.wickets + ' wickets');
    setLeader('leaderAvg', 'leaderAvgVal', topAvg, 'avg ' + topAvg.battingAverage);
    setLeader('leaderField', 'leaderFieldVal', topField, topField.dismissals + ' dismissals');
}

function setLeader(nameElId, valElId, entry, valText) {
    if (!entry) return;
    document.getElementById(nameElId).textContent = entry.name;
    document.getElementById(valElId).textContent = valText;
}

function renderStatsDashboard() {
    const grid = document.getElementById('statsDashboardGrid');
    let careers = Store.getAllPlayersCareerStats()
        .map(c => ({ ...c, name: Utils.getPlayerName(c.playerId) }));

    const emptyMsg = (msg) => {
        grid.innerHTML = `<p style="text-align:center; color:#888; grid-column:1/-1;">${msg}</p>`;
        document.getElementById('statsDashboardPagination').innerHTML = '';
    };

    if (careers.length === 0) {
        emptyMsg('No player stats recorded yet. Add them from the Admin &rarr; Player Stats tab.');
        return;
    }

    // Search filter
    const search = (document.getElementById('playerSearch').value || '').trim().toLowerCase();
    if (search) {
        careers = careers.filter(c => c.name.toLowerCase().includes(search));
    }

    // Sort
    const sortBy = document.getElementById('sortBy').value;
    careers.sort((a, b) => {
        if (sortBy === 'economy') {
            // lower economy is better; players with 0 overs go last
            const ax = a.oversBowled > 0 ? a.economy : Infinity;
            const bx = b.oversBowled > 0 ? b.economy : Infinity;
            return ax - bx;
        }
        return (b[sortBy] || 0) - (a[sortBy] || 0);
    });

    if (careers.length === 0) {
        emptyMsg('No players match your search');
        return;
    }

    const cell = (label, value) =>
        `<div class="ps-cell"><span class="ps-label">${label}</span><span class="ps-value">${value}</span></div>`;

    Utils.paginate({
        items: careers,
        containerId: 'statsDashboardPagination',
        stateKey: 'statsDashboard',
        renderPageFn: (pageItems) => {
            const pag = Utils._pagState && Utils._pagState.statsDashboard;
            const startRank = pag ? (pag.currentPage - 1) * pag.pageSize : 0;
            grid.innerHTML = pageItems.map((c, i) => `
                <div class="player-stat-card">
                    <div class="ps-head">
                        <span class="ps-rank">#${startRank + i + 1}</span>
                        <span class="ps-name">${c.name}</span>
                        <span class="ps-sub">${c.tournaments} tnmt &middot; ${c.matches} M</span>
                    </div>
                    <div class="ps-section-label">Batting</div>
                    <div class="ps-stats">
                        ${cell('Runs', '<strong>' + c.runs + '</strong>')}
                        ${cell('HS', c.highScore)}
                        ${cell('Avg', c.battingAverage)}
                        ${cell('SR', c.strikeRate)}
                        ${cell('4s', c.fours)}
                        ${cell('6s', c.sixes)}
                    </div>
                    <div class="ps-section-label">Bowling</div>
                    <div class="ps-stats">
                        ${cell('Wkts', '<strong>' + c.wickets + '</strong>')}
                        ${cell('Econ', c.oversBowled > 0 ? c.economy : '-')}
                        ${cell('Avg', c.wickets > 0 ? c.bowlingAverage : '-')}
                    </div>
                    <div class="ps-section-label">Fielding</div>
                    <div class="ps-stats">
                        ${cell('Ct', c.catches)}
                        ${cell('St', c.stumpings)}
                        ${cell('RO', c.runOuts)}
                    </div>
                </div>
            `).join('');
        }
    });
}
