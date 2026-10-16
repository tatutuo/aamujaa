import { web, stats, mapWithConcurrency } from '../lib/nhlApi.js';
import { getOrFetch, TTL } from '../lib/cache.js';
import { abbrevFromName } from '../lib/teams.js';
import { getStandings } from './standings.js';

/**
 * Juuri päättyneet ottelut tilastotaulukoihin.
 *
 * NHL:n tilastorajapinta (pistepörssi, maalivahdit, joukkueet) päivittyy
 * vasta noin kaksi tuntia ottelun jälkeen, mutta sarjataulukko ja
 * ottelupöytäkirjat heti. Aamulla pistepörssi näytti siksi edellisen illan
 * otteluita vailla, vaikka sarjataulukossa ne jo näkyivät.
 *
 * Viive tunnistetaan joukkueittain: sarjataulukon ottelumäärä vs.
 * tilastorajapinnan ottelumäärä. Puuttuvat ottelut haetaan joukkueen
 * otteluohjelmasta ja niiden pöytäkirjat lisätään riveihin. Kun NHL:n
 * tilastot ehtivät perään, viivettä ei enää ole eikä mitään lisätä.
 *
 * Pöytäkirjassa ei ole kaikkia tilastorajapinnan lukuja (esim. ylivoima-
 * pisteet, voittomaalit), joten ne jäävät hetkeksi vajaiksi. Pääluvut
 * (ottelut, maalit, syötöt, pisteet, +/-, laukaukset, peliaika, torjunnat)
 * ovat kunnossa.
 */

/** Tätä useampaa puuttuvaa ottelua ei paikata: silloin vika on muualla. */
const MAX_MISSING = 3;
const TTL_FINAL_BOX = 6 * 60 * 60_000;

const toSeconds = (mmss) => {
    const [m, s] = String(mmss ?? '').split(':').map(Number);
    return Number.isFinite(m) && Number.isFinite(s) ? m * 60 + s : 0;
};
const add = (a, b) => (a ?? 0) + (b ?? 0);
const isFinal = (state) => state === 'FINAL' || state === 'OFF';

/**
 * Joukkueiden ottelumäärät tilastorajapinnan mukaan. Haetaan samalla kertaa
 * kuin varsinaiset rivit ja tallennetaan niiden kanssa: vertailu tehdään
 * aina samasta hetkestä otettuun dataan, joten ottelua ei voi lisätä
 * kahdesti, vaikka NHL päivittyisi välimuistin voimassaoloaikana.
 */
export async function teamGamesPlayed(season) {
    const summary = await stats('team/summary', { limit: -1, cayenneExp: `seasonId=${season} and gameTypeId=2` });
    return Object.fromEntries((summary?.data ?? []).map((t) => [abbrevFromName(t.teamFullName), t.gamesPlayed ?? 0]));
}

/** Joukkueet, joiden tilastoista puuttuu otteluita: abbrev -> puuttuvien määrä. */
async function laggingTeams(teamGp, season) {
    const standings = await getStandings();
    if (standings.season !== season || standings.isPreviousSeason) return new Map();

    const lagging = new Map();
    for (const t of standings.teams) {
        const missing = (t.gp ?? 0) - (teamGp[t.team] ?? 0);
        if (missing > 0 && missing <= MAX_MISSING) lagging.set(t.team, missing);
    }
    return lagging;
}

/** Puuttuvat ottelut: gameId -> joukkueet, joiden pelaajat siitä lisätään. */
async function missingGames(lagging, season) {
    const games = new Map();
    await mapWithConcurrency([...lagging.entries()], 4, async ([team, missing]) => {
        const schedule = await getOrFetch(`clubschedule:${team}:${season}`, TTL.schedule, () =>
            web(`/club-schedule-season/${team}/${season}`)).catch(() => null);
        const played = (schedule?.games ?? [])
            .filter((g) => g.gameType === 2 && isFinal(g.gameState))
            .sort((a, b) => b.startTimeUTC.localeCompare(a.startTimeUTC))
            .slice(0, missing);
        for (const g of played) {
            if (!games.has(g.id)) games.set(g.id, new Set());
            games.get(g.id).add(team);
        }
    });
    return games;
}

function patchSkaters(rows, boxes) {
    const byId = new Map(rows.map((r) => [r.id, r]));
    for (const { box, teams } of boxes) {
        for (const side of ['awayTeam', 'homeTeam']) {
            const team = box[side]?.abbrev;
            if (!teams.has(team)) continue;
            const stats = box.playerByGameStats?.[side] ?? {};
            for (const p of [...(stats.forwards ?? []), ...(stats.defense ?? [])]) {
                const toi = toSeconds(p.toi);
                if (toi === 0) continue;
                const old = byId.get(p.playerId) ?? {
                    id: p.playerId, name: p.name?.default, team, pos: p.position, gp: 0, toi: 0,
                };
                const gp = add(old.gp, 1);
                const goals = add(old.goals, p.goals);
                const points = add(old.points, p.points ?? add(p.goals, p.assists));
                const shots = add(old.shots, p.sog);
                byId.set(p.playerId, {
                    ...old,
                    gp,
                    goals,
                    assists: add(old.assists, p.assists),
                    points,
                    pointsPerGame: points / gp,
                    plusMinus: add(old.plusMinus, p.plusMinus),
                    pim: add(old.pim, p.pim),
                    ppGoals: add(old.ppGoals, p.powerPlayGoals),
                    shots,
                    shootingPct: shots > 0 ? goals / shots : null,
                    toi: ((old.toi ?? 0) * (gp - 1) + toi) / gp,
                    hits: add(old.hits, p.hits),
                    blocks: add(old.blocks, p.blockedShots),
                    takeaways: add(old.takeaways, p.takeaways),
                    giveaways: add(old.giveaways, p.giveaways),
                    provisional: true,
                });
            }
        }
    }
    return [...byId.values()];
}

function patchGoalies(rows, boxes) {
    const byId = new Map(rows.map((r) => [r.id, r]));
    for (const { box, teams } of boxes) {
        const extra = ['OT', 'SO'].includes(box.gameOutcome?.lastPeriodType);
        for (const side of ['awayTeam', 'homeTeam']) {
            const team = box[side]?.abbrev;
            if (!teams.has(team)) continue;
            const played = (box.playerByGameStats?.[side]?.goalies ?? []).filter((g) => toSeconds(g.toi) > 0);
            for (const g of played) {
                const old = byId.get(g.playerId) ?? { id: g.playerId, name: g.name?.default, team, pos: 'G', gp: 0 };
                const saves = add(old.saves, g.saves);
                const shotsAgainst = add(old.shotsAgainst, g.shotsAgainst);
                const goalsAgainst = add(old.goalsAgainst, g.goalsAgainst);
                const toiTotal = add(old.toiTotal, toSeconds(g.toi));
                const won = g.decision === 'W';
                const lost = g.decision === 'L';
                byId.set(g.playerId, {
                    ...old,
                    gp: add(old.gp, 1),
                    gs: add(old.gs, g.starter ? 1 : 0),
                    wins: add(old.wins, won ? 1 : 0),
                    losses: add(old.losses, lost && !extra ? 1 : 0),
                    otLosses: add(old.otLosses, lost && extra ? 1 : 0),
                    shutouts: add(old.shutouts, won && g.goalsAgainst === 0 && played.length === 1 ? 1 : 0),
                    saves,
                    shotsAgainst,
                    goalsAgainst,
                    savePct: shotsAgainst > 0 ? saves / shotsAgainst : null,
                    gaa: toiTotal > 0 ? (goalsAgainst * 3600) / toiTotal : null,
                    toiTotal,
                    pim: add(old.pim, g.pim),
                    provisional: true,
                });
            }
        }
    }
    return [...byId.values()];
}

/** Joukkueille sarjataulukon luvut suoraan: ne ovat ajan tasalla. */
async function patchTeams(rows, lagging) {
    const standings = await getStandings();
    const byTeam = new Map(standings.teams.map((t) => [t.team, t]));
    return rows.map((r) => {
        const s = lagging.has(r.team) ? byTeam.get(r.team) : null;
        if (!s) return r;
        return {
            ...r,
            gp: s.gp,
            wins: s.wins,
            losses: s.losses,
            otLosses: s.otLosses,
            points: s.points,
            pointPct: s.pointPct,
            regWins: s.regWins,
            rowWins: s.rowWins,
            goalsFor: s.goalsFor,
            goalsAgainst: s.goalsAgainst,
            goalDiff: s.goalDiff,
            gfPerGame: s.gp ? s.goalsFor / s.gp : r.gfPerGame,
            gaPerGame: s.gp ? s.goalsAgainst / s.gp : r.gaPerGame,
            provisional: true,
        };
    });
}

/**
 * `teamGp` = teamGamesPlayed()-tulos samalta hetkeltä kuin `rows`.
 * Palauttaa { rows, provisionalGames }: provisionalGames = montako ottelua
 * lisättiin pöytäkirjoista (0 = tilastorajapinta oli ajan tasalla).
 * Virhetilanteessa palautetaan rivit sellaisinaan: paikkaus on lisä, ei ehto.
 */
export async function patchRecentGames(category, rows, season, teamGp) {
    try {
        const lagging = await laggingTeams(teamGp, season);
        if (lagging.size === 0) return { rows, provisionalGames: 0 };

        const games = await missingGames(lagging, season);
        if (category === 'teams') return { rows: await patchTeams(rows, lagging), provisionalGames: games.size };

        const boxes = (await mapWithConcurrency([...games.entries()], 4, async ([id, teams]) => {
            const box = await getOrFetch(`boxscore-final:${id}`, TTL_FINAL_BOX, () => web(`/gamecenter/${id}/boxscore`)).catch(() => null);
            return box && isFinal(box.gameState) ? { box, teams } : null;
        })).filter(Boolean);
        if (boxes.length === 0) return { rows, provisionalGames: 0 };

        const patched = category === 'goalies' ? patchGoalies(rows, boxes) : patchSkaters(rows, boxes);
        return { rows: patched, provisionalGames: boxes.length };
    } catch (err) {
        console.warn(`[stats] tuoreiden otteluiden lisäys epäonnistui (${category}):`, err.message);
        return { rows, provisionalGames: 0 };
    }
}
