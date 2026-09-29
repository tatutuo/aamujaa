import { getOrFetch } from '../lib/cache.js';
import { getSeasonId, getPreviousSeasonId } from '../lib/season.js';
import { getStatsTable } from './stats.js';

/**
 * Odotetut maalit (xG) MoneyPuckista.
 *
 * NHL ei julkaise xG-lukuja, mutta MoneyPuck.com jakaa ne ilmaiseksi
 * ei-kaupalliseen käyttöön, kunhan lähde mainitaan (näkymässä lukee
 * "Data: MoneyPuck.com"). Tiedostot päivittyvät kerran vuorokaudessa, joten
 * ne haetaan korkeintaan kuuden tunnin välein.
 *
 * xG kertoo, montako maalia laukauksista olisi keskimäärin syntynyt niiden
 * paikan, kulman, tyypin ja pelitilanteen perusteella. Maalit miinus xG
 * mittaa viimeistelyä (tai maalivahdilla torjuntaa odotettuun nähden).
 *
 * Kansallisuus, tulokkuus ja ikä otetaan NHL:n omasta tilastotaulukosta
 * pelaaja-ID:n perusteella, jotta samat suodattimet toimivat kuin pistepörssissä.
 */

const BASE = 'https://moneypuck.com/moneypuck/playerData/seasonSummary';
const TTL_CURRENT = 6 * 60 * 60_000;
const TTL_PAST = 24 * 60 * 60_000;
const TIMEOUT_MS = 20_000;

export const XG_CATEGORIES = ['xg-skaters', 'xg-goalies', 'xg-teams'];

/** Pieni CSV-jäsennin: lainausmerkit ja niiden sisäiset pilkut tuetaan. */
export function parseCsv(text) {
    const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
    if (lines.length === 0) return [];

    const split = (line) => {
        const out = [];
        let field = '';
        let quoted = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (quoted) {
                if (ch === '"' && line[i + 1] === '"') { field += '"'; i++; } else if (ch === '"') quoted = false;
                else field += ch;
            } else if (ch === '"') quoted = true;
            else if (ch === ',') { out.push(field); field = ''; } else field += ch;
        }
        out.push(field);
        return out;
    };

    const header = split(lines[0]);
    return lines.slice(1).map((line) => {
        const values = split(line);
        const row = {};
        header.forEach((key, i) => {
            // Samanniminen sarake voi esiintyä kahdesti (joukkuetiedoston "team"); ensimmäinen voittaa.
            if (key in row) return;
            const raw = values[i];
            const num = Number(raw);
            row[key] = raw === '' || raw === undefined ? null : Number.isFinite(num) && raw.trim() !== '' ? num : raw;
        });
        return row;
    });
}

async function fetchCsv(year, kind, gameType) {
    const url = `${BASE}/${year}/${gameType === 3 ? 'playoffs' : 'regular'}/${kind}.csv`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
        const res = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'pucknower (+https://d4nyyy.fi/hockey)' } });
        if (res.status === 404) return [];
        if (!res.ok) {
            const err = new Error(`MoneyPuck ${res.status}`);
            err.status = 502;
            throw err;
        }
        return parseCsv(await res.text());
    } finally {
        clearTimeout(timer);
    }
}

const per60 = (value, seconds) => (seconds > 0 && value != null ? (value / seconds) * 3600 : null);
const share = (a, b) => (a != null && b != null && a + b > 0 ? a / (a + b) : null);
const round = (v, d = 2) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 10 ** d) / 10 ** d);

/** Ryhmittele pelitilanteittain: { [playerId]: { all, '5on5', ... } }. */
function bySituation(rows, idKey) {
    const map = new Map();
    for (const r of rows) {
        const id = r[idKey];
        if (!map.has(id)) map.set(id, {});
        map.get(id)[r.situation] = r;
    }
    return map;
}

async function nhlLookup(seasonId, gameType, category) {
    try {
        const table = await getStatsTable(category, { season: seasonId, gameType });
        return new Map(table.rows.map((r) => [r.id, r]));
    } catch {
        return new Map();
    }
}

async function buildSkaters(year, seasonId, gameType) {
    const raw = await fetchCsv(year, 'skaters', gameType);
    if (raw.length === 0) return [];
    const nhl = await nhlLookup(seasonId, gameType, 'skaters');

    return [...bySituation(raw, 'playerId').entries()].flatMap(([id, s]) => {
        const all = s.all;
        if (!all) return [];
        const ev = s['5on5'] ?? {};
        const n = nhl.get(id) ?? {};
        const xg = all.I_F_xGoals;
        const onIceXg = share(ev.OnIce_F_xGoals, ev.OnIce_A_xGoals);
        const offIceXg = share(ev.OffIce_F_xGoals, ev.OffIce_A_xGoals);
        return [{
            id,
            name: n.name ?? all.name,
            team: all.team,
            pos: all.position,
            nat: n.nat ?? null,
            rookie: n.rookie ?? false,
            age: n.age ?? null,
            gp: all.games_played,
            toi: all.games_played ? all.icetime / all.games_played : null,
            goals: all.I_F_goals,
            points: all.I_F_points,
            xg: round(xg),
            gax: round(all.I_F_goals - xg),
            xg60: round(per60(xg, all.icetime)),
            g60: round(per60(all.I_F_goals, all.icetime)),
            hdShots: all.I_F_highDangerShots,
            hdGoals: all.I_F_highDangerGoals,
            hdxg: round(all.I_F_highDangerxGoals),
            shotAttempts: all.I_F_shotAttempts,
            gameScore: all.games_played ? round(all.gameScore / all.games_played) : null,
            // 5v5 jäällä ollessa: joukkueen osuus odotetuista maaleista ja laukaisuyrityksistä.
            // Valmiit osuudet on pyöristetty kahteen desimaaliin, joten lasketaan raakaluvuista.
            xgPct: onIceXg,
            cfPct: share(ev.OnIce_F_shotAttempts, ev.OnIce_A_shotAttempts),
            ffPct: share(ev.OnIce_F_unblockedShotAttempts, ev.OnIce_A_unblockedShotAttempts),
            xgPctRel: onIceXg != null && offIceXg != null ? round(onIceXg - offIceXg, 4) : null,
        }];
    });
}

async function buildGoalies(year, seasonId, gameType) {
    const raw = await fetchCsv(year, 'goalies', gameType);
    if (raw.length === 0) return [];
    const nhl = await nhlLookup(seasonId, gameType, 'goalies');

    return [...bySituation(raw, 'playerId').entries()].flatMap(([id, s]) => {
        const all = s.all;
        if (!all) return [];
        const n = nhl.get(id) ?? {};
        const gsax = all.xGoals - all.goals;
        return [{
            id,
            name: n.name ?? all.name,
            team: all.team,
            pos: 'G',
            nat: n.nat ?? null,
            rookie: n.rookie ?? false,
            gp: all.games_played,
            toiTotal: all.icetime,
            xga: round(all.xGoals),
            ga: all.goals,
            gsax: round(gsax),
            gsax60: round(per60(gsax, all.icetime)),
            savePct: all.ongoal ? round(1 - all.goals / all.ongoal, 4) : null,
            hdShots: all.highDangerShots,
            hdGoals: all.highDangerGoals,
            hdGsax: round(all.highDangerxGoals - all.highDangerGoals),
            hdSavePct: all.highDangerShots ? round(1 - all.highDangerGoals / all.highDangerShots, 4) : null,
        }];
    });
}

async function buildTeams(year, _seasonId, gameType) {
    const raw = await fetchCsv(year, 'teams', gameType);
    if (raw.length === 0) return [];

    return [...bySituation(raw, 'team').entries()].flatMap(([team, s]) => {
        const all = s.all;
        if (!all) return [];
        const ev = s['5on5'] ?? {};
        const gp = all.games_played || 1;
        return [{
            id: team,
            team,
            gp: all.games_played,
            xgf: round(all.xGoalsFor / gp),
            xga: round(all.xGoalsAgainst / gp),
            gf: round(all.goalsFor / gp),
            ga: round(all.goalsAgainst / gp),
            // Viimeistely: tehdyt maalit odotettuun nähden. Torjunta: odotetut vastaan miinus päästetyt.
            finishing: round(all.goalsFor - all.xGoalsFor, 1),
            goaltending: round(all.xGoalsAgainst - all.goalsAgainst, 1),
            // Tiedoston valmiit osuudet on pyöristetty kahteen desimaaliin (0.57), joten lasketaan itse.
            xgPct: share(ev.xGoalsFor, ev.xGoalsAgainst) ?? all.xGoalsPercentage,
            cfPct: share(ev.shotAttemptsFor, ev.shotAttemptsAgainst) ?? all.corsiPercentage,
            ffPct: share(ev.unblockedShotAttemptsFor, ev.unblockedShotAttemptsAgainst) ?? all.fenwickPercentage,
            hdfPerGame: round(all.highDangerShotsFor / gp, 1),
            hdaPerGame: round(all.highDangerShotsAgainst / gp, 1),
        }];
    });
}

const BUILDERS = { 'xg-skaters': buildSkaters, 'xg-goalies': buildGoalies, 'xg-teams': buildTeams };

/** Sama vastausmuoto kuin getStatsTable, jotta taulukkonäkymä toimii sellaisenaan. */
export async function getXgTable(category, { season, gameType = 2 } = {}) {
    const build = BUILDERS[category];
    if (!build) {
        const err = new Error('Tuntematon tilastoluokka');
        err.status = 400;
        throw err;
    }

    const requested = season ?? getSeasonId();
    const ttl = requested === getSeasonId() ? TTL_CURRENT : TTL_PAST;
    const yearOf = (seasonId) => Number(String(seasonId).slice(0, 4));

    return getOrFetch(`xg:${category}:${requested}:${gameType}:${season ? 'fixed' : 'auto'}`, ttl, async () => {
        let rows = await build(yearOf(requested), requested, gameType);
        let used = requested;
        let isPreviousSeason = false;

        if (rows.length === 0 && !season) {
            const previous = getPreviousSeasonId();
            const fallback = await build(yearOf(previous), previous, gameType);
            if (fallback.length > 0) {
                rows = fallback;
                used = previous;
                isPreviousSeason = true;
            }
        }

        return { category, season: used, gameType, isPreviousSeason, source: 'MoneyPuck.com', rows };
    });
}
