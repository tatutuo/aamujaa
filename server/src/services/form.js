import { stats, web } from '../lib/nhlApi.js';
import { getOrFetch } from '../lib/cache.js';
import { getSeasonId, getPreviousSeasonId } from '../lib/season.js';
import { toDateString, addDays } from '../lib/dates.js';
import { abbrevFromName } from '../lib/teams.js';
import { getStatsTable } from './stats.js';
import { getInjuries } from './injuries.js';

/**
 * Kunto: pelaajien ja joukkueiden viime aikojen taso verrattuna kauteen.
 *
 * Jakso (7, 14 tai 30 päivää) haetaan NHL:n tilastorajapinnasta
 * päivämäärärajauksella, joten kaikkien pelaajien jaksoluvut tulevat yhdellä
 * pyynnöllä raporttia kohden.
 *
 * Kuntoindeksi mittaa muutosta, ei tasoa: jokaisen mittarin ero kauden
 * keskiarvoon jaetaan saman pelipaikan pelaajien hajonnalla (z-luku), ja
 * pelipaikan mukaan painotetut z-luvut lasketaan yhteen. Lyhyt jakso on
 * kohinaa, joten indeksi kutistetaan jakson otteluiden määrän mukaan.
 *
 * Kauden alussa (alle MIN_TEAM_GAMES ottelua) näytetään edellisen kauden
 * viimeinen jakso: kolmen ottelun kunnosta ei voi sanoa mitään.
 */

export const FORM_WINDOWS = [7, 14, 30];

const MIN_TEAM_GAMES = 6;
const TTL_FORM = 30 * 60_000;

/** Pelipaikkojen mittarit ja painot kuntoindeksissä. */
const WEIGHTS = {
    F: { ppg: 0.4, spg: 0.25, toi: 0.15, pmpg: 0.1, cf: 0.1 },
    D: { ppg: 0.25, pmpg: 0.2, toi: 0.2, cf: 0.2, physpg: 0.15 },
};

/** Kuinka monen ottelun verran "ei muutosta" -oletus painaa indeksissä. */
const SHRINK_GAMES = 3;

const round = (v, d = 3) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 10 ** d) / 10 ** d);
const isForward = (pos) => pos === 'C' || pos === 'L' || pos === 'R';
const lastTeam = (abbrevs) => (abbrevs ? String(abbrevs).split(',').pop().trim() : null);

function sd(values) {
    const list = values.filter((v) => v != null && Number.isFinite(v));
    if (list.length < 2) return null;
    const mean = list.reduce((s, v) => s + v, 0) / list.length;
    const variance = list.reduce((s, v) => s + (v - mean) ** 2, 0) / (list.length - 1);
    return Math.sqrt(variance) || null;
}

const expression = (season, from, to) => {
    let exp = `seasonId=${season} and gameTypeId=2`;
    if (from) exp += ` and gameDate>="${from}"`;
    if (to) exp += ` and gameDate<="${to}"`;
    return exp;
};

async function report(resource, season, from, to) {
    const res = await stats(resource, { limit: -1, cayenneExp: expression(season, from, to) }).catch(() => null);
    return res?.data ?? [];
}

const byId = (rows, key = 'playerId') => new Map(rows.map((r) => [r[key], r]));

/** Pyöristää rivin luvut: vastaus pienenee noin puoleen ilman näkyvää eroa. */
function tidy(line) {
    if (!line) return line;
    const out = {};
    for (const [k, v] of Object.entries(line)) {
        out[k] = typeof v === 'number' ? (k === 'toi' ? Math.round(v) : round(v, 4)) : v;
    }
    return out;
}

/** Vähimmäisottelut nousija- ja hiipujalistoille jakson pituuden mukaan. */
const MIN_WINDOW_GAMES = { 7: 2, 14: 4, 30: 8 };

/** Mikä kausi ja mikä päivä on jakson loppu. */
async function resolvePeriod() {
    const season = getSeasonId();
    const teams = await report('team/summary', season);
    const maxGames = teams.reduce((m, t) => Math.max(m, t.gamesPlayed ?? 0), 0);

    if (maxGames >= MIN_TEAM_GAMES) {
        // Tämän päivän otteluita ei oteta mukaan: ne voivat olla kesken.
        return { season, end: addDays(toDateString(), -1), isPreviousSeason: false };
    }

    const previous = getPreviousSeasonId();
    const endYear = previous.slice(4);
    const schedule = await web(`/schedule/${endYear}-04-01`).catch(() => null);
    return {
        season: previous,
        end: schedule?.regularSeasonEndDate ?? `${endYear}-04-16`,
        isPreviousSeason: true,
    };
}

/** Kenttäpelaajan jakso- tai kausiluvut yhteen muotoon. */
function skaterLine(summary, realtime, possession) {
    const gp = summary?.gamesPlayed ?? 0;
    if (!gp) return null;
    const hits = realtime?.hits ?? 0;
    const blocks = realtime?.blockedShots ?? 0;
    return {
        gp,
        goals: summary.goals ?? 0,
        points: summary.points ?? 0,
        ppg: (summary.points ?? 0) / gp,
        gpg: (summary.goals ?? 0) / gp,
        spg: (summary.shots ?? 0) / gp,
        shPct: summary.shots ? (summary.goals ?? 0) / summary.shots : null,
        pm: summary.plusMinus ?? 0,
        pmpg: (summary.plusMinus ?? 0) / gp,
        toi: summary.timeOnIcePerGame ?? null,
        ppp: summary.ppPoints ?? 0,
        foPct: summary.faceoffWinPct ?? null,
        hitspg: hits / gp,
        blockspg: blocks / gp,
        physpg: (hits + blocks) / gp,
        cf: possession?.satPct ?? null,
    };
}

function goalieLine(summary, advanced) {
    const gp = summary?.gamesPlayed ?? 0;
    if (!gp) return null;
    return {
        gp,
        starts: summary.gamesStarted ?? gp,
        wins: summary.wins ?? 0,
        svPct: summary.savePct ?? null,
        gaa: summary.goalsAgainstAverage ?? null,
        shotsAgainst: summary.shotsAgainst ?? 0,
        qsPct: advanced?.qualityStartsPct ?? null,
    };
}

function teamLine(summary, percentages) {
    const gp = summary?.gamesPlayed ?? 0;
    if (!gp) return null;
    return {
        gp,
        wins: summary.wins ?? 0,
        losses: summary.losses ?? 0,
        otLosses: summary.otLosses ?? 0,
        ptsPct: summary.pointPct ?? null,
        gfpg: summary.goalsForPerGame ?? null,
        gapg: summary.goalsAgainstPerGame ?? null,
        gdpg: (summary.goalsForPerGame ?? 0) - (summary.goalsAgainstPerGame ?? 0),
        sfpg: summary.shotsForPerGame ?? null,
        sapg: summary.shotsAgainstPerGame ?? null,
        pp: summary.powerPlayPct ?? null,
        pk: summary.penaltyKillPct ?? null,
        cf: percentages?.satPct ?? null,
        // PDO: laukaisu-% + torjunta-% tasakentin. Noin 1,000 on keskitaso;
        // selvästi yli kertoo yleensä onnesta, joka tasaantuu.
        pdo: percentages?.shootingPlusSavePct5v5 ?? null,
    };
}

/**
 * Kuntoindeksi: painotettu summa z-luvuista (jakso − kausi) / hajonta,
 * kutistettuna jakson otteluiden määrällä.
 */
function formIndex(window, season, weights, spreads) {
    let score = 0;
    let used = 0;
    for (const [key, weight] of Object.entries(weights)) {
        const w = window[key];
        const s = season[key];
        const spread = spreads[key];
        if (w == null || s == null || !spread) continue;
        score += weight * ((w - s) / spread);
        used += weight;
    }
    if (used === 0) return null;
    const shrink = window.gp / (window.gp + SHRINK_GAMES);
    return (score / used) * shrink;
}

/**
 * Tuuri- ja epäonnimerkintä maalinteolle.
 *   luck: laukaisuprosentti selvästi kauden yläpuolella ilman laukausmäärän
 *         nousua — maalitahti todennäköisesti hidastuu.
 *   due:  laukauksia entistä enemmän mutta maaleja ei tule — tahti todennäköisesti nousee.
 */
function scoringSignal(window, season) {
    if (window.gp < 3 || window.spg < 1 || season.shPct == null || window.shPct == null) return null;
    const shotsUp = window.spg >= season.spg * 1.1;
    const shotsFlatOrDown = window.spg <= season.spg * 1.05;
    if (window.shPct >= season.shPct + 0.08 && shotsFlatOrDown && window.goals >= 2) return 'luck';
    if (window.shPct <= season.shPct - 0.06 && shotsUp) return 'due';
    return null;
}

// ---------------------------------------------------------------------------
// Poissaolojen vaikutus joukkueeseen
// ---------------------------------------------------------------------------

/**
 * Loukkaantuneiden painoarvo joukkueelle kauden luvuista.
 * Kenttäpelaaja: osuus joukkueen pisteistä ja peliajasta.
 * Maalivahti: osuus aloituksista (ykkösvahdin poissaolo on suurin yksittäinen menetys).
 */
function injuryImpact(injuries, seasonSkaters, seasonGoalies) {
    const byTeam = new Map();

    const teamTotals = new Map();
    for (const p of seasonSkaters) {
        const t = teamTotals.get(p.team) ?? { points: 0, toi: 0 };
        t.points += p.points ?? 0;
        t.toi += (p.toi ?? 0) * (p.gp ?? 0);
        teamTotals.set(p.team, t);
    }
    const goalieStarts = new Map();
    for (const g of seasonGoalies) goalieStarts.set(g.team, (goalieStarts.get(g.team) ?? 0) + (g.gs ?? g.gp ?? 0));

    const skaterById = new Map(seasonSkaters.map((p) => [p.id, p]));
    const goalieById = new Map(seasonGoalies.map((g) => [g.id, g]));

    for (const inj of injuries) {
        if (!inj.team) continue;
        const entry = byTeam.get(inj.team) ?? { count: 0, impact: 0, significant: [], goalieOut: false };
        entry.count += 1;

        const skater = inj.id ? skaterById.get(inj.id) : null;
        const goalie = inj.id ? goalieById.get(inj.id) : null;
        let share = 0;
        let toiShare = 0;
        let startShare = 0;

        if (goalie) {
            const starts = goalieStarts.get(goalie.team) ?? 0;
            startShare = starts ? (goalie.gs ?? goalie.gp ?? 0) / starts : 0;
            if (startShare >= 0.45) entry.goalieOut = true;
        } else if (skater) {
            const totals = teamTotals.get(skater.team) ?? { points: 0, toi: 0 };
            share = totals.points ? (skater.points ?? 0) / totals.points : 0;
            toiShare = totals.toi ? ((skater.toi ?? 0) * (skater.gp ?? 0)) / totals.toi : 0;
        }

        // Merkittävä: yli 7 % joukkueen pisteistä, yli 6 % peliajasta tai ykkösvahti.
        const significant = share >= 0.07 || toiShare >= 0.06 || startShare >= 0.45;
        entry.impact += share;
        if (significant) {
            entry.significant.push({
                id: inj.id,
                name: inj.name,
                pos: inj.pos,
                status: inj.status,
                statusCode: inj.statusCode,
                returnDate: inj.returnDate,
                pointsShare: round(share, 3),
                toiShare: round(toiShare, 3),
                startShare: round(startShare, 3),
                points: skater?.points ?? null,
                gp: skater?.gp ?? goalie?.gp ?? null,
            });
        }
        byTeam.set(inj.team, entry);
    }

    for (const entry of byTeam.values()) {
        entry.impact = round(entry.impact, 3);
        entry.significant.sort((a, b) => (b.startShare + b.pointsShare) - (a.startShare + a.pointsShare));
    }
    return byTeam;
}

// ---------------------------------------------------------------------------

export async function getForm({ days = 14 } = {}) {
    const windowDays = FORM_WINDOWS.includes(days) ? days : 14;

    return getOrFetch(`form:${windowDays}`, TTL_FORM, async () => {
        const period = await resolvePeriod();
        const { season, end } = period;
        const from = addDays(end, -(windowDays - 1));

        const [
            wSummary, wRealtime, wPossession, sPossession,
            wGoalies, wGoalieAdv,
            wTeams, sTeams, wTeamPct, sTeamPct,
            seasonSkaters, seasonGoalies, injuries,
        ] = await Promise.all([
            report('skater/summary', season, from, end),
            report('skater/realtime', season, from, end),
            report('skater/puckPossessions', season, from, end),
            report('skater/puckPossessions', season, null, end),
            report('goalie/summary', season, from, end),
            report('goalie/advanced', season, from, end),
            report('team/summary', season, from, end),
            report('team/summary', season, null, end),
            report('team/percentages', season, from, end),
            report('team/percentages', season, null, end),
            getStatsTable('skaters', { season }).catch(() => ({ rows: [] })),
            getStatsTable('goalies', { season }).catch(() => ({ rows: [] })),
            // Poissaolot ovat aina tämän hetken tieto, myös kun kunto on edelliseltä kaudelta.
            getInjuries().catch(() => ({ rows: [] })),
        ]);

        const wRealtimeById = byId(wRealtime);
        const wPossessionById = byId(wPossession);
        const sPossessionById = byId(sPossession);
        const seasonById = new Map(seasonSkaters.rows.map((r) => [r.id, r]));

        // --- Kenttäpelaajat ---
        const skaters = [];
        for (const w of wSummary) {
            const s = seasonById.get(w.playerId);
            if (!s || (s.gp ?? 0) < 8) continue;

            const windowLine = skaterLine(w, wRealtimeById.get(w.playerId), wPossessionById.get(w.playerId));
            const seasonLine = skaterLine(
                {
                    gamesPlayed: s.gp, goals: s.goals, points: s.points, shots: s.shots,
                    plusMinus: s.plusMinus, timeOnIcePerGame: s.toi, ppPoints: s.ppPoints, faceoffWinPct: s.faceoffPct,
                },
                { hits: s.hits, blockedShots: s.blocks },
                sPossessionById.get(w.playerId),
            );
            if (!windowLine || !seasonLine) continue;

            skaters.push({
                id: w.playerId,
                name: s.name ?? w.skaterFullName,
                team: lastTeam(w.teamAbbrevs) ?? s.team,
                pos: w.positionCode ?? s.pos,
                nat: s.nat ?? null,
                rookie: s.rookie ?? false,
                window: tidy(windowLine),
                season: tidy(seasonLine),
            });
        }

        // Hajonnat pelipaikoittain kauden luvuista: z-lukujen mittakaava.
        const spreadsFor = (group) => {
            const list = skaters.filter((p) => (group === 'F' ? isForward(p.pos) : p.pos === 'D'));
            const keys = Object.keys(WEIGHTS[group]);
            return Object.fromEntries(keys.map((k) => [k, sd(list.map((p) => p.season[k]))]));
        };
        const spreads = { F: spreadsFor('F'), D: spreadsFor('D') };

        for (const p of skaters) {
            const group = p.pos === 'D' ? 'D' : 'F';
            p.formIndex = round(formIndex(p.window, p.season, WEIGHTS[group], spreads[group]), 3);
            p.signal = scoringSignal(p.window, p.season);
        }

        // --- Maalivahdit ---
        const seasonGoalieById = new Map(seasonGoalies.rows.map((g) => [g.id, g]));
        const wGoalieAdvById = byId(wGoalieAdv);
        const goalies = [];
        for (const w of wGoalies) {
            const s = seasonGoalieById.get(w.playerId);
            if (!s || (s.gp ?? 0) < 5) continue;
            const windowLine = goalieLine(w, wGoalieAdvById.get(w.playerId));
            const seasonLine = goalieLine({
                gamesPlayed: s.gp, gamesStarted: s.gs, wins: s.wins, savePct: s.savePct,
                goalsAgainstAverage: s.gaa, shotsAgainst: s.shotsAgainst,
            }, null);
            if (!windowLine || !seasonLine) continue;

            // Torjunta-%:n ero kutistettuna kohdattujen laukausten mukaan
            // (300 laukausta ≈ kymmenen ottelua). Asteikko: 0,010 = yksi yksikkö.
            const diff = (windowLine.svPct ?? 0) - (seasonLine.svPct ?? 0);
            const shrink = windowLine.shotsAgainst / (windowLine.shotsAgainst + 300);
            goalies.push({
                id: w.playerId,
                name: s.name ?? w.goalieFullName,
                team: lastTeam(w.teamAbbrevs) ?? s.team,
                pos: 'G',
                nat: s.nat ?? null,
                rookie: s.rookie ?? false,
                window: tidy(windowLine),
                season: tidy(seasonLine),
                formIndex: round((diff / 0.01) * shrink, 3),
            });
        }

        // --- Joukkueet ---
        const sTeamsByName = new Map(sTeams.map((t) => [t.teamFullName, t]));
        const wPctByName = new Map(wTeamPct.map((t) => [t.teamFullName, t]));
        const sPctByName = new Map(sTeamPct.map((t) => [t.teamFullName, t]));
        const impacts = injuryImpact(injuries.rows ?? [], seasonSkaters.rows, seasonGoalies.rows);

        const teams = wTeams.map((w) => {
            const abbrev = abbrevFromName(w.teamFullName);
            const windowLine = teamLine(w, wPctByName.get(w.teamFullName));
            const seasonLine = teamLine(sTeamsByName.get(w.teamFullName), sPctByName.get(w.teamFullName));
            if (!abbrev || !windowLine || !seasonLine) return null;

            // Joukkueen kuntoindeksi: pisteprosentin, maalieron ja kiekonhallinnan muutos.
            const shrink = windowLine.gp / (windowLine.gp + SHRINK_GAMES);
            const index = (
                0.45 * (((windowLine.ptsPct ?? 0) - (seasonLine.ptsPct ?? 0)) / 0.15)
                + 0.35 * ((windowLine.gdpg - seasonLine.gdpg) / 0.8)
                + 0.2 * (((windowLine.cf ?? 0.5) - (seasonLine.cf ?? 0.5)) / 0.03)
            ) * shrink;

            const injury = impacts.get(abbrev) ?? { count: 0, impact: 0, significant: [], goalieOut: false };
            return {
                id: abbrev,
                team: abbrev,
                window: tidy(windowLine),
                season: tidy(seasonLine),
                formIndex: round(index, 3),
                injuries: injury,
            };
        }).filter(Boolean);

        // Joukkueen kunto pelaajariveille: näkee, nouseeko pelaaja joukkueensa mukana.
        const teamIndex = new Map(teams.map((t) => [t.team, t.formIndex]));
        for (const p of [...skaters, ...goalies]) p.teamFormIndex = teamIndex.get(p.team) ?? null;

        return {
            season,
            isPreviousSeason: period.isPreviousSeason,
            from,
            to: end,
            days: windowDays,
            minGames: MIN_WINDOW_GAMES[windowDays],
            skaters,
            goalies,
            teams,
        };
    });
}
