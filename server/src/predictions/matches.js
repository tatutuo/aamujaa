import { web, stats, mapWithConcurrency } from '../lib/nhlApi.js';
import { getOrFetch } from '../lib/cache.js';
import { getSeasonId, getPreviousSeasonId } from '../lib/season.js';
import { toDateString, addDays } from '../lib/dates.js';
import { abbrevFromName } from '../lib/teams.js';
import { outcomeProbabilities } from './math.js';
import { getRestEffects, restMultipliers } from './restEffects.js';
import {
    computeLeagueBaseline,
    computeTeamStrength,
    regressedSavePct,
    fetchTeamStats,
    fetchTeamCorsi,
} from './teamStrength.js';

/**
 * Otteluennusteet.
 *
 * Malli lyhyesti:
 *   1. Lähtötaso: liigan keskimääräinen maalimäärä
 *   2. Odotetut laukaukset: oma laukausvoima vs. vastustajan laukausten esto
 *   3. Maalit per laukaus: oma viimeistely ja vastustajan todennäköinen maalivahti
 *   4. Pienet, toisistaan riippumattomat korjaukset: kotietu, lepo,
 *      erikoistilanteet, muoto
 *   5. Lopputulosjakauma analyyttisesti (ei arvontaa), tasatilanteet korotettuna
 *
 * Kaikki joukkueiden luvut kutistetaan kohti ennakko-oletusta otosmäärän
 * mukaan. Ennakko-oletus on liigan keskiarvo siirrettynä osittain kohti
 * joukkueen viime kauden tasoa, jotta lokakuun ennusteet eivät ole lähes
 * kolikonheittoja.
 *
 * Rakenne: `fetchMatchInputs` hakee datan ja `computeMatchPredictions`
 * laskee siitä ennusteet puhtaana funktiona. Erottelu mahdollistaa
 * kalibroinnin: takautuva testaus hakee datan kerran ja ajaa laskennan
 * sadoilla eri parametreilla (scripts/tune-predictions.js).
 *
 * Jokaiselle joukkueelle tallennetaan laskennan vaiheet (`steps`), joten
 * ottelukortti näyttää täsmälleen ne luvut, joista ennuste syntyi.
 */

/**
 * Mallin parametrit, kalibroitu 27.10.2026 kausilla 2024–25 ja 2025–26
 * (2 504 ottelua, ks. scripts/tune-predictions.js).
 *
 * Ristiintarkistus (sovitus yhdellä kaudella, tarkistus toisella) osoitti:
 *   - muoto (viimeiset 10), erikoistilanteet ja Corsi eivät tuo ennustearvoa
 *     laukausten ja maalivahtien päälle, joten niiden paino on 0
 *   - viimeistely ja maalivahdit kannattaa kutistaa voimakkaasti
 *   - edellisen kauden taso parantaa kauden alun ennusteita
 * Muoto ja erikoistilanteet ovat koodissa yhä mukana, jos myöhempi kalibrointi
 * löytää niille painon.
 */
export const DEFAULT_PARAMS = Object.freeze({
    /** Kotietu odotettuihin maaleihin (koti × k, vieras ÷ k). */
    homeAdvantage: 1.05,
    /** Erikoistilanteiden enimmäisvaikutus ja skaalaus (0 = ei käytössä). */
    specialTeamsMax: 0.06,
    specialScale: 0,
    /** Muodon (viimeiset 10) enimmäisvaikutus (0 = ei käytössä). */
    formMax: 0,
    /** Odotettujen maalien järkevät rajat. */
    minExpectedGoals: 1.4,
    maxExpectedGoals: 5.5,
    /** Tasatilanteiden korotus varsinaisen peliajan lopussa (ks. math.js). */
    tieInflation: 0.55,
    /** Kutistus: kuinka monen keskiverto-ottelun verran ennakko painaa. */
    priorGames: 6,
    shootingPriorShots: 1500,
    goaliePriorShots: 3000,
    corsiWeight: 0,
    corsiPriorGames: 15,
    /** Kuinka suuri osa viime kauden tasoerosta siirtyy ennakko-oletukseen. */
    carryOver: 0.65,
    /** Peräkkäisinä päivinä ykkösmaalivahdin todennäköisyydestä siirtyy vaihtovahdille. */
    b2bGoalieShift: 0.6,
});

/**
 * Mallin versio ja takautuvan testin tulokset; näytetään ottelukortissa.
 * Parametrit on sovitettu näillä kausilla, joten luvut ovat hieman
 * optimistisia: aidon tarkkuuden kertoo kuluvan kauden toteuma.
 */
export const MODEL_INFO = {
    version: '2026.10',
    backtests: [
        { season: '2024–25', games: 1212, accuracy: 60.8, brier: 0.2321, homeAccuracy: 56.3, homeBrier: 0.2461 },
        { season: '2025–26', games: 1292, accuracy: 54.6, brier: 0.2451, homeAccuracy: 52.2, homeBrier: 0.2495 },
    ],
};

// ---------------------------------------------------------------------------
// Datan haku
// ---------------------------------------------------------------------------

async function fetchGamesForDate(date) {
    const data = await web(`/schedule/${date}`);
    return (data.gameWeek ?? []).find((d) => d.date === date)?.games ?? [];
}

/** Maalivahdit joukkueittain, järjestettynä peliajan mukaan. */
async function fetchGoalies(season, beforeDate) {
    let cayenneExp = `seasonId=${season} and gameTypeId=2`;
    if (beforeDate) cayenneExp += ` and gameDate<"${beforeDate}"`;

    const data = await stats('goalie/summary', { limit: -1, cayenneExp }).catch(() => null);

    const byTeam = {};
    for (const goalie of data?.data ?? []) {
        const abbrev = goalie.teamAbbrevs ? goalie.teamAbbrevs.split(',').pop().trim() : null;
        if (!abbrev) continue;
        (byTeam[abbrev] ??= []).push({
            id: goalie.playerId,
            name: goalie.goalieFullName,
            timeOnIce: goalie.timeOnIce ?? 0,
            savePct: goalie.savePct ?? null,
            saves: goalie.saves ?? 0,
            shotsAgainst: goalie.shotsAgainst ?? 0,
        });
    }
    for (const list of Object.values(byTeam)) list.sort((a, b) => b.timeOnIce - a.timeOnIce);
    return byTeam;
}

/** Päiviä edellisestä pelatusta ottelusta. */
function daysSinceLastGame(schedule, date) {
    if (!schedule?.games) return null;
    const target = new Date(`${date}T00:00:00Z`).getTime();
    let latest = null;
    for (const game of schedule.games) {
        const gameTime = new Date(game.startTimeUTC).getTime();
        if (gameTime >= target) continue;
        if (latest === null || gameTime > latest) latest = gameTime;
    }
    if (latest === null) return null;
    return Math.floor((target - latest) / (1000 * 60 * 60 * 24));
}

/**
 * Kaikki yhden päivän ennusteisiin tarvittava data JSON-muodossa.
 *
 * Kaikki tilastot rajataan ennustepäivää edeltäviin otteluihin: aamulla
 * laskettava ennuste ei saa nähdä saman illan tuloksia, ja takautuvassa
 * testauksessa sama rajaus estää tulevan datan vuotamisen. Sarjataulukko
 * (muoto) haetaan siksi edelliseltä päivältä.
 *
 * @param {string} date YYYY-MM-DD
 * @param {object} [cache] { schedules: Map, previous: Map, rest: Map } kalibrointia varten
 */
export async function fetchMatchInputs(date, cache = null) {
    const season = getSeasonId(new Date(`${date}T12:00:00Z`));
    const previousSeason = getPreviousSeasonId(new Date(`${date}T12:00:00Z`));

    const allGames = await fetchGamesForDate(date);
    // Harjoitusotteluita ei ennusteta: kokoonpanot ovat kokeiluja.
    const games = allGames.filter((g) => g.gameType === 2 || g.gameType === 3);
    if (games.length === 0) return { date, season, games: [] };

    const cached = (map, key, fn) => {
        if (!map) return fn();
        if (!map.has(key)) map.set(key, fn());
        return map.get(key);
    };

    const [teamStatsRaw, previousRaw, goalies, standingsData, yesterdayGames, restEffects, corsi] = await Promise.all([
        fetchTeamStats(season, date),
        cached(cache?.previous, previousSeason, () =>
            getOrFetch(`pred-prev-teams:${previousSeason}`, 24 * 60 * 60_000, () => fetchTeamStats(previousSeason)))
            .catch(() => []),
        fetchGoalies(season, date),
        web(`/standings/${addDays(date, -1)}`).catch(() => null),
        fetchGamesForDate(addDays(date, -1)).catch(() => []),
        cached(cache?.rest, season, () => getRestEffects(season)).catch(() => new Map()),
        fetchTeamCorsi(season, date).catch(() => new Map()),
    ]);

    const involved = [...new Set(games.flatMap((g) => [g.homeTeam.abbrev, g.awayTeam.abbrev]))];
    const schedules = await mapWithConcurrency(involved, 4, (abbrev) =>
        cached(cache?.schedules, `${abbrev}:${season}`, () => web(`/club-schedule-season/${abbrev}/${season}`)),
    );

    // Vain mallin käyttämät kentät: kevyempi muisti ja kalibrointiaineisto.
    const withAbbrev = (rows) => rows
        .map((t) => ({
            abbrev: abbrevFromName(t.teamFullName),
            teamFullName: t.teamFullName,
            gamesPlayed: t.gamesPlayed,
            goalsFor: t.goalsFor,
            goalsAgainst: t.goalsAgainst,
            shotsForPerGame: t.shotsForPerGame,
            shotsAgainstPerGame: t.shotsAgainstPerGame,
            powerPlayPct: t.powerPlayPct,
            penaltyKillPct: t.penaltyKillPct,
        }))
        .filter((t) => t.abbrev);

    const standings = {};
    for (const t of standingsData?.standings ?? []) {
        standings[t.teamAbbrev.default] = { l10Wins: t.l10Wins, l10Losses: t.l10Losses, l10OtLosses: t.l10OtLosses };
    }

    const restDays = {};
    involved.forEach((abbrev, i) => { restDays[abbrev] = daysSinceLastGame(schedules[i], date); });

    return {
        date,
        season,
        games: games.map((g) => ({ id: g.id, startTimeUTC: g.startTimeUTC, gameType: g.gameType, home: g.homeTeam.abbrev, away: g.awayTeam.abbrev })),
        teamStats: withAbbrev(teamStatsRaw),
        previousTeamStats: withAbbrev(previousRaw ?? []),
        goalies,
        standings,
        backToBack: [...new Set(yesterdayGames.flatMap((g) => [g.homeTeam.abbrev, g.awayTeam.abbrev]))],
        restDays,
        restEffects: [...(restEffects ?? new Map()).entries()],
        corsi: Object.fromEntries(corsi ?? new Map()),
    };
}

// ---------------------------------------------------------------------------
// Laskenta
// ---------------------------------------------------------------------------

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const round = (value, digits = 3) => Number(value.toFixed(digits));

/**
 * Joukkueen todennäköinen maalivahtitaso. Aloittajaa ei julkisteta etukäteen,
 * joten lasketaan peliajalla painotettu odotusarvo. Peräkkäisinä päivinä
 * ykkösvahdin osuus pienenee, koska vaihtovahti pelaa tyypillisesti toisen illan.
 */
function goalieOutlook(goalies, leagueSavePct, isBackToBack, params) {
    if (!goalies?.length) return { savePct: leagueSavePct, goalies: [] };
    const top = goalies.slice(0, 3);
    const totalToi = top.reduce((sum, g) => sum + g.timeOnIce, 0);
    if (totalToi === 0) return { savePct: leagueSavePct, goalies: [] };

    const weights = top.map((g) => g.timeOnIce / totalToi);
    if (isBackToBack && top.length > 1) {
        const shift = weights[0] * params.b2bGoalieShift;
        weights[0] -= shift;
        weights[1] += shift;
    }

    const list = top.map((g, i) => ({
        id: g.id,
        name: g.name,
        weight: round(weights[i], 2),
        seasonSavePct: g.savePct,
        savePct: round(regressedSavePct(g, leagueSavePct, params.goaliePriorShots), 4),
    }));
    return {
        savePct: list.reduce((sum, g, i) => sum + weights[i] * g.savePct, 0),
        goalies: list.filter((g) => g.weight >= 0.05),
    };
}

/** Viimeisen kymmenen ottelun pisteosuus. */
function recentForm(row) {
    const games = (row?.l10Wins ?? 0) + (row?.l10Losses ?? 0) + (row?.l10OtLosses ?? 0);
    if (games === 0) return { share: 0.5, record: null };
    return {
        share: ((row.l10Wins ?? 0) * 2 + (row.l10OtLosses ?? 0)) / (games * 2),
        record: `${row.l10Wins}-${row.l10Losses}-${row.l10OtLosses}`,
    };
}

/**
 * Ennusteet päivän otteluille. Puhdas funktio: sama data ja parametrit
 * antavat aina saman tuloksen.
 */
export function computeMatchPredictions(inputs, overrides = {}) {
    const params = { ...DEFAULT_PARAMS, ...overrides };
    if (!inputs?.games?.length || !inputs.teamStats?.length) return [];

    const league = computeLeagueBaseline(inputs.teamStats);
    const previousLeague = inputs.previousTeamStats?.length ? computeLeagueBaseline(inputs.previousTeamStats) : null;
    const previousByTeam = new Map(
        (inputs.previousTeamStats ?? []).map((t) => [t.abbrev, computeTeamStrength(t, previousLeague, null, { ...params, priorGames: 0, shootingPriorShots: 0, corsiWeight: 0 })]),
    );
    const strength = new Map(
        inputs.teamStats.map((t) => [t.abbrev, {
            ...computeTeamStrength(t, league, inputs.corsi?.[t.teamFullName], params, previousByTeam.get(t.abbrev)),
            raw: t,
        }]),
    );
    const restEffects = new Map(inputs.restEffects ?? []);
    const backToBack = new Set(inputs.backToBack ?? []);
    const leagueGoals = league.shotsPerGame * league.shootingPct;

    const predictions = [];

    for (const game of inputs.games) {
        const home = strength.get(game.home);
        const away = strength.get(game.away);
        if (!home || !away) continue;

        const side = (own, opp, isHome) => {
            const ownB2B = backToBack.has(own.abbrev);
            const oppB2B = backToBack.has(opp.abbrev);
            const ownRestDays = ownB2B ? 0 : inputs.restDays?.[own.abbrev] ?? null;
            const oppRestDays = oppB2B ? 0 : inputs.restDays?.[opp.abbrev] ?? null;
            const oppGoalie = goalieOutlook(inputs.goalies?.[opp.abbrev], league.savePct, oppB2B, params);
            const ownGoalie = goalieOutlook(inputs.goalies?.[own.abbrev], league.savePct, ownB2B, params);
            return { own, opp, isHome, ownB2B, ownRestDays, oppRestDays, oppGoalie, ownGoalie };
        };
        const sides = { home: side(home, away, true), away: side(away, home, false) };

        // Erikoistilanteet ja muoto ovat joukkueiden välisiä eroja: lasketaan kerran.
        const homeSpecial = home.powerPlayPct - (1 - away.penaltyKillPct);
        const awaySpecial = away.powerPlayPct - (1 - home.penaltyKillPct);
        const specialEdge = clamp((homeSpecial - awaySpecial) * params.specialScale, -params.specialTeamsMax, params.specialTeamsMax);
        const homeForm = recentForm(inputs.standings?.[game.home]);
        const awayForm = recentForm(inputs.standings?.[game.away]);
        const formEdge = clamp((homeForm.share - awayForm.share) * params.formMax * 2, -params.formMax, params.formMax);

        const expected = {};
        const steps = {};
        const shots = {};
        for (const key of ['home', 'away']) {
            const s = sides[key];
            const sign = key === 'home' ? 1 : -1;
            const list = [{ key: 'base', value: round(leagueGoals) }];
            let lambda = leagueGoals;
            const apply = (stepKey, factor, detail) => {
                lambda *= factor;
                list.push({ key: stepKey, factor: round(factor, 4), value: round(lambda), ...(detail ? { detail } : {}) });
            };

            // 2. Laukaukset
            const expShots = league.shotsPerGame * s.own.shotGeneration / s.opp.shotSuppression;
            shots[key] = expShots;
            apply('shots', expShots / league.shotsPerGame, {
                expectedShots: round(expShots, 1),
                leagueShots: round(league.shotsPerGame, 1),
                shotsForPerGame: round(s.own.raw.shotsForPerGame ?? 0, 1),
                oppShotsAgainstPerGame: round(s.opp.raw.shotsAgainstPerGame ?? 0, 1),
                corsi: s.own.corsiPct,
            });

            // 3. Viimeistely ja vastustajan maalivahti (yhdessä: maali per laukaus)
            const finishingPct = league.shootingPct * s.own.finishing;
            const conversion = Math.max(0.03, finishingPct + (league.savePct - s.oppGoalie.savePct));
            apply('finishing', s.own.finishing, {
                shootingPct: round(finishingPct, 4),
                leagueShootingPct: round(league.shootingPct, 4),
                seasonShootingPct: s.own.raw.shotsForPerGame
                    ? round((s.own.raw.goalsFor ?? 0) / ((s.own.raw.shotsForPerGame ?? 1) * (s.own.raw.gamesPlayed || 1)), 4)
                    : null,
            });
            apply('goalie', conversion / finishingPct, {
                savePct: round(s.oppGoalie.savePct, 4),
                leagueSavePct: round(league.savePct, 4),
                goalies: s.oppGoalie.goalies,
            });

            // 4. Kotietu
            apply('home', s.isHome ? params.homeAdvantage : 1 / params.homeAdvantage);

            // 5. Lepo: oma hyökkäys ja vastustajan puolustus (väsynyt vastustaja päästää enemmän)
            const ownRest = restMultipliers(restEffects, s.ownRestDays);
            const oppRest = restMultipliers(restEffects, s.oppRestDays);
            apply('rest', ownRest.attack * oppRest.defence, {
                restDays: s.ownRestDays,
                oppRestDays: s.oppRestDays,
                backToBack: s.ownB2B,
            });

            // 6. Erikoistilanteet ja 7. muoto: vain jos kalibrointi antaa niille painon.
            if (params.specialScale > 0) {
                apply('special', 1 + sign * specialEdge, {
                    powerPlayPct: round(s.own.powerPlayPct, 3),
                    oppPenaltyKillPct: round(s.opp.penaltyKillPct, 3),
                });
            }
            if (params.formMax > 0) {
                apply('form', 1 + sign * formEdge, {
                    last10: (key === 'home' ? homeForm : awayForm).record,
                    oppLast10: (key === 'home' ? awayForm : homeForm).record,
                });
            }

            // 8. Rajaus
            const bounded = clamp(lambda, params.minExpectedGoals, params.maxExpectedGoals);
            if (bounded !== lambda) apply('limit', bounded / lambda);

            expected[key] = lambda;
            steps[key] = list;
        }

        const outcome = outcomeProbabilities(expected.home, expected.away, undefined, params.tieInflation);
        const pct = (value) => Math.round(value * 100);
        const summary = (s) => ({
            gamesPlayed: s.own.gamesPlayed,
            goalsForPerGame: s.own.raw.gamesPlayed ? round((s.own.raw.goalsFor ?? 0) / s.own.raw.gamesPlayed, 2) : null,
            goalsAgainstPerGame: s.own.raw.gamesPlayed ? round((s.own.raw.goalsAgainst ?? 0) / s.own.raw.gamesPlayed, 2) : null,
            shotGeneration: round(s.own.shotGeneration, 3),
            shotSuppression: round(s.own.shotSuppression, 3),
            finishing: round(s.own.finishing, 3),
            goalies: s.ownGoalie.goalies,
        });

        predictions.push({
            gameId: game.id,
            date: inputs.date,
            startTimeUTC: game.startTimeUTC,
            home: game.home,
            away: game.away,
            model: MODEL_INFO.version,

            expectedGoals: { home: round(expected.home, 2), away: round(expected.away, 2) },
            expectedShots: { home: Math.round(shots.home), away: Math.round(shots.away) },

            homeScore: outcome.mostLikelyScore.home,
            awayScore: outcome.mostLikelyScore.away,
            isOT: outcome.mostLikelyScore.isOvertime,

            homeWinProb: pct(outcome.homeWin),
            awayWinProb: pct(outcome.awayWin),
            homeRegProb: pct(outcome.homeRegulationWin),
            awayRegProb: pct(outcome.awayRegulationWin),
            otProb: pct(outcome.overtime),
            over55Prob: pct(outcome.overFiveHalfGoals),

            // Tarkat todennäköisyydet mallin arviointia varten.
            homeWinProbability: outcome.homeWin,
            overtimeProbability: outcome.overtime,
            topScores: outcome.topScores.map((t) => ({ ...t, probability: round(t.probability, 4) })),

            league: {
                goalsPerGame: round(leagueGoals, 2),
                shotsPerGame: round(league.shotsPerGame, 1),
                shootingPct: round(league.shootingPct, 4),
                savePct: round(league.savePct, 4),
            },
            steps,
            teams: { home: summary(sides.home), away: summary(sides.away) },
        });
    }

    return predictions;
}

/** Päivän ennusteet: haku ja laskenta. */
export async function generateMatchPredictions(date = toDateString()) {
    return computeMatchPredictions(await fetchMatchInputs(date));
}

export const MATCH_MODEL = DEFAULT_PARAMS;
