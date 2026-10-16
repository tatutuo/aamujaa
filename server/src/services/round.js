import { web, mapWithConcurrency } from '../lib/nhlApi.js';
import { getOrFetch, TTL } from '../lib/cache.js';
import { getGameExtras, getGameShots } from './shots.js';

/**
 * Kierroksen data: yhden ottelupäivän kaikki ottelut yhtenä koosteena.
 *
 * Etusivun "Kierroksen data" -näkymä näyttää kierroksen kärjet, maalivirran,
 * otteluiden joukkuetilastot vierekkäin ja niistä piirretyt kaaviot.
 *
 * Lähteet:
 *   /score/{päivä}             ottelut, tilanne ja kaikki maalit syöttäjineen
 *   /gamecenter/{id}/boxscore  pelaajien ottelutilastot
 *   /gamecenter/{id}/right-rail joukkueiden tilastot ja laukaukset erittäin
 *
 * Välimuisti on kaikille käyttäjille yhteinen: NHL:lle lähtee sama määrä
 * pyyntöjä käyttäjämäärästä riippumatta. Päättyneiden otteluiden tiedot
 * eivät enää muutu, joten ne pidetään pitkään.
 */

const LIVE = new Set(['LIVE', 'CRIT']);
const FINAL = new Set(['FINAL', 'OFF']);
const NOT_STARTED = new Set(['FUT', 'PRE']);

const TTL_FINAL_GAME = 6 * 60 * 60_000;
const TTL_ROUND_LIVE = 30_000;
const TTL_ROUND_PENDING = 2 * 60_000;
const TTL_ROUND_DONE = 30 * 60_000;

const toSeconds = (mmss) => {
    const [m, s] = String(mmss ?? '').split(':').map(Number);
    return Number.isFinite(m) && Number.isFinite(s) ? m * 60 + s : 0;
};

/** Pelaajarivi kevyessä muodossa: kierroksen kärjet lasketaan selaimessa. */
function playerRows(box, game, xgByPlayer = {}) {
    const rows = [];
    for (const side of ['awayTeam', 'homeTeam']) {
        const team = box[side]?.abbrev;
        const stats = box.playerByGameStats?.[side] ?? {};
        for (const p of [...(stats.forwards ?? []), ...(stats.defense ?? [])]) {
            const toi = toSeconds(p.toi);
            if (toi === 0) continue;
            rows.push({
                id: p.playerId,
                name: p.name?.default,
                team,
                gameId: game.id,
                pos: p.position,
                g: p.goals ?? 0,
                a: p.assists ?? 0,
                p: p.points ?? 0,
                pm: p.plusMinus ?? 0,
                sog: p.sog ?? 0,
                hit: p.hits ?? 0,
                blk: p.blockedShots ?? 0,
                tk: p.takeaways ?? 0,
                ppg: p.powerPlayGoals ?? 0,
                xg: Number((xgByPlayer[p.playerId] ?? 0).toFixed(2)),
                toi,
            });
        }
        for (const g of stats.goalies ?? []) {
            const toi = toSeconds(g.toi);
            if (toi === 0) continue;
            rows.push({
                id: g.playerId,
                name: g.name?.default,
                team,
                gameId: game.id,
                pos: 'G',
                sv: g.saves ?? 0,
                sa: g.shotsAgainst ?? 0,
                ga: g.goalsAgainst ?? 0,
                dec: g.decision ?? null,
                toi,
            });
        }
    }
    return rows;
}

/** Joukkuetilastot muotoon { kategoria: { away, home } }. */
function teamStats(extras) {
    const out = {};
    for (const s of extras?.teamStats ?? []) out[s.category] = { away: s.away, home: s.home };
    return out;
}

/**
 * Maalin arvioitu hetki kellonaikana: ottelun alku + kuluneet erät väliaikoineen.
 * Rajapinta ei kerro maalin kellonaikaa, joten maalivirran järjestys eri
 * otteluiden välillä on arvio (erä kestää noin 35 min, väliaika 18 min).
 */
function estimatedAt(game, goal) {
    const start = Date.parse(game.startTimeUTC);
    const period = goal.period ?? 1;
    const minutes = 12 + (period - 1) * (35 + 18) + (toSeconds(goal.timeInPeriod) / 60) * 1.75;
    return start + minutes * 60_000;
}

function goalRows(game) {
    return (game.goals ?? []).map((g) => ({
        gameId: game.id,
        team: g.teamAbbrev,
        period: g.period,
        periodType: g.periodDescriptor?.periodType ?? 'REG',
        time: g.timeInPeriod,
        scorer: { id: g.playerId, name: g.name?.default, toDate: g.goalsToDate ?? null },
        assists: (g.assists ?? []).map((a) => ({ id: a.playerId, name: a.name?.default, toDate: a.assistsToDate ?? null })),
        strength: g.strength ?? 'ev',
        emptyNet: g.goalModifier === 'empty-net',
        awayScore: g.awayScore,
        homeScore: g.homeScore,
        video: g.highlightClipSharingUrl ?? null,
        at: estimatedAt(game, g),
    }));
}

/**
 * Odotetut maalit ottelusta: joukkueiden summat ja pelaajittain. Lasketaan
 * laukauskartan datasta (play-by-play + lib/xg.js), ja tallennetaan vain
 * tiivistelmä, ei koko tapahtumalistaa.
 */
async function xgSummary(gameId) {
    const data = await getGameShots(gameId);
    const byPlayer = {};
    for (const s of data.shots) {
        if (!s.xg || !s.shooterId) continue;
        byPlayer[s.shooterId] = (byPlayer[s.shooterId] ?? 0) + s.xg;
    }
    return { away: data.summary.away.xg, home: data.summary.home.xg, byPlayer };
}

async function gameDetail(game) {
    const final = FINAL.has(game.gameState);
    const ttl = final ? TTL_FINAL_GAME : TTL.boxscore;
    const cached = (key, fn) => (final ? getOrFetch(`${key}:${game.id}`, TTL_FINAL_GAME, fn) : fn());
    const [box, extras, xg] = await Promise.all([
        getOrFetch(`round-box:${game.id}`, ttl, () => web(`/gamecenter/${game.id}/boxscore`)).catch(() => null),
        cached('round-extras', () => getGameExtras(game.id)).catch(() => null),
        cached('round-xg', () => xgSummary(game.id)).catch(() => null),
    ]);
    return { box, extras, xg };
}

export async function getRound(date) {
    const score = await getOrFetch(`round-score:${date}`, TTL.scores, () => web(`/score/${date}`));
    const games = score?.games ?? [];
    const hasLive = games.some((g) => LIVE.has(g.gameState));
    const allDone = games.length > 0 && games.every((g) => FINAL.has(g.gameState));
    const ttl = hasLive ? TTL_ROUND_LIVE : allDone ? TTL_ROUND_DONE : TTL_ROUND_PENDING;

    return getOrFetch(`round:${date}`, ttl, async () => {
        const started = games.filter((g) => !NOT_STARTED.has(g.gameState));
        const details = await mapWithConcurrency(started, 4, gameDetail);
        const byId = new Map(started.map((g, i) => [g.id, details[i] ?? {}]));

        const players = [];
        const outGames = games.map((g) => {
            const { box, extras, xg } = byId.get(g.id) ?? {};
            if (box) players.push(...playerRows(box, g, xg?.byPlayer));
            return {
                id: g.id,
                state: g.gameState,
                startTimeUTC: g.startTimeUTC,
                period: g.periodDescriptor?.number ?? g.period ?? null,
                periodType: g.periodDescriptor?.periodType ?? null,
                clock: g.clock ? { time: g.clock.timeRemaining, intermission: Boolean(g.clock.inIntermission) } : null,
                lastPeriodType: g.gameOutcome?.lastPeriodType ?? null,
                away: { abbrev: g.awayTeam?.abbrev, score: g.awayTeam?.score ?? 0, sog: g.awayTeam?.sog ?? 0 },
                home: { abbrev: g.homeTeam?.abbrev, score: g.homeTeam?.score ?? 0, sog: g.homeTeam?.sog ?? 0 },
                stats: teamStats(extras),
                xg: xg ? { away: xg.away, home: xg.home } : null,
                shotsByPeriod: extras?.shotsByPeriod ?? [],
            };
        });

        const goals = games.flatMap(goalRows).sort((a, b) => b.at - a.at);

        return {
            date,
            hasLiveGames: hasLive,
            allFinished: allDone,
            updated: new Date().toISOString(),
            games: outGames,
            goals,
            players,
        };
    });
}
