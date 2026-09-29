import { stats } from '../lib/nhlApi.js';
import { getOrFetch } from '../lib/cache.js';
import { getSeasonId } from '../lib/season.js';
import { abbrevFromName } from '../lib/teams.js';
import { getStatsTable } from './stats.js';

/**
 * Historia: kaikkien aikojen pelaajat maittain, Stanley Cup -mestarit ja
 * palkintojen voittajat.
 *
 * Uratilastot lasketaan NHL:n tilastorajapinnan koostekyselyllä
 * (isAggregate=true), joka summaa kaikki kaudet pelaajittain yhdellä
 * pyynnöllä. Palkinnot tulevat records.nhl.com-palvelusta.
 */

const RECORDS = 'https://records.nhl.com/site/api';
const TTL_DAY = 24 * 60 * 60_000;

/** Pelaajapalkinnot, jotka näkymä tarjoaa (records.nhl.com trophyId). */
export const TROPHIES = [
    { id: 8, key: 'hart', name: 'Hart Memorial Trophy', fi: 'Arvokkain pelaaja' },
    { id: 16, key: 'artross', name: 'Art Ross Trophy', fi: 'Pistepörssin voittaja' },
    { id: 15, key: 'richard', name: 'Maurice “Rocket” Richard Trophy', fi: 'Maalikuningas' },
    { id: 13, key: 'lindsay', name: 'Ted Lindsay Award', fi: 'Pelaajien valitsema paras' },
    { id: 18, key: 'vezina', name: 'Vezina Trophy', fi: 'Paras maalivahti' },
    { id: 11, key: 'norris', name: 'James Norris Memorial Trophy', fi: 'Paras puolustaja' },
    { id: 4, key: 'calder', name: 'Calder Memorial Trophy', fi: 'Paras tulokas' },
    { id: 7, key: 'connsmythe', name: 'Conn Smythe Trophy', fi: 'Pudotuspelien arvokkain' },
    { id: 17, key: 'selke', name: 'Frank J. Selke Trophy', fi: 'Paras puolustava hyökkääjä' },
    { id: 3, key: 'byng', name: 'Lady Byng Memorial Trophy', fi: 'Herrasmiespelaaja' },
    { id: 10, key: 'masterton', name: 'Bill Masterton Memorial Trophy', fi: 'Sinnikkyys ja omistautuminen' },
];

async function records(path) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    try {
        const res = await fetch(`${RECORDS}${path}`, { signal: controller.signal });
        if (!res.ok) {
            const err = new Error(`records.nhl.com ${res.status}`);
            err.status = 502;
            throw err;
        }
        return await res.json();
    } finally {
        clearTimeout(timer);
    }
}

// ---------------------------------------------------------------------------
// Kaikkien aikojen pelaajat maittain
// ---------------------------------------------------------------------------

const careerExpression = (code, gameType) =>
    `nationalityCode="${code}" and gameTypeId=${gameType} and seasonId<=${getSeasonId()} and seasonId>=19171918`;

/** Viime kaudella pelanneet: niistä näkee, kuka on yhä mukana. */
async function recentIds() {
    try {
        const table = await getStatsTable('skaters');
        const goalies = await getStatsTable('goalies');
        return new Set([...table.rows, ...goalies.rows].map((r) => r.id));
    } catch {
        return new Set();
    }
}

export async function getNationCareers(code, gameType = 2) {
    return getOrFetch(`nation:${code}:${gameType}`, TTL_DAY, async () => {
        const cayenneExp = careerExpression(code, gameType);
        const aggregate = { limit: -1, isAggregate: true };
        const [skaters, goalies, active] = await Promise.all([
            stats('skater/summary', { ...aggregate, cayenneExp }),
            stats('goalie/summary', { ...aggregate, cayenneExp }),
            recentIds(),
        ]);

        return {
            code,
            gameType,
            skaters: (skaters?.data ?? []).map((p) => ({
                id: p.playerId,
                name: p.skaterFullName,
                pos: p.positionCode,
                nat: code,
                active: active.has(p.playerId),
                gp: p.gamesPlayed,
                goals: p.goals,
                assists: p.assists,
                points: p.points,
                pointsPerGame: p.pointsPerGame,
                plusMinus: p.plusMinus,
                pim: p.penaltyMinutes,
                ppGoals: p.ppGoals,
                gwg: p.gameWinningGoals,
                shots: p.shots,
            })),
            goalies: (goalies?.data ?? []).map((g) => ({
                id: g.playerId,
                name: g.goalieFullName,
                pos: 'G',
                nat: code,
                active: active.has(g.playerId),
                gp: g.gamesPlayed,
                wins: g.wins,
                losses: g.losses,
                savePct: g.savePct,
                gaa: g.goalsAgainstAverage,
                shutouts: g.shutouts,
            })),
        };
    });
}

// ---------------------------------------------------------------------------
// Stanley Cup ja palkinnot
// ---------------------------------------------------------------------------

export async function getCupHistory() {
    return getOrFetch('history:cup', TTL_DAY, async () => {
        const data = await records('/award-details?cayenneExp=trophyId=1&limit=-1');
        // Joukkuerivillä ei ole pelaajaa; pelaajarivit ovat pokaaliin kaiverretut nimet.
        const bySeason = new Map();
        for (const row of data.data ?? []) {
            if (row.playerId != null) continue;
            if (!bySeason.has(row.seasonId)) bySeason.set(row.seasonId, { season: row.seasonId });
            const entry = bySeason.get(row.seasonId);
            const value = { name: row.fullName, abbrev: abbrevFromName(row.fullName) };
            if (row.status === 'WINNER') entry.winner = value;
            else if (row.status === 'RUNNER_UP') entry.runnerUp = value;
        }
        return [...bySeason.values()].filter((e) => e.winner).sort((a, b) => b.season - a.season);
    });
}

export async function getAwardWinners(trophyId) {
    return getOrFetch(`history:award:${trophyId}`, TTL_DAY, async () => {
        const exp = encodeURIComponent(`trophyId=${trophyId} and status="WINNER"`);
        const data = await records(`/award-details?cayenneExp=${exp}&limit=-1`);
        return (data.data ?? [])
            .filter((r) => r.playerId != null)
            .map((r) => ({ season: r.seasonId, id: r.playerId, name: r.fullName, rookie: r.isRookie }))
            .sort((a, b) => b.season - a.season);
    });
}

/** Maan pelaajien kaikki palkinnot, esim. suomalaisten Hartit ja Vezinat. */
export async function getNationAwards(code) {
    return getOrFetch(`history:nation-awards:${code}`, TTL_DAY, async () => {
        const careers = await getNationCareers(code, 2);
        const ids = new Set([...careers.skaters, ...careers.goalies].map((p) => p.id));
        const lists = await Promise.all(TROPHIES.map(async (t) => {
            const winners = await getAwardWinners(t.id).catch(() => []);
            return winners.filter((w) => ids.has(w.id)).map((w) => ({ ...w, trophy: t.key }));
        }));
        return lists.flat().sort((a, b) => b.season - a.season);
    });
}
