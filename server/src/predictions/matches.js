import { web, stats, mapWithConcurrency } from '../lib/nhlApi.js';
import { getSeasonId } from '../lib/season.js';
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
 *   1. Odotuslaukaukset joukkueiden laukausvoimista suhteessa liigan keskiarvoon
 *   2. Odotusmaalit = odotuslaukaukset × maalintekoprosentti, jossa sekä
 *      hyökkääjän viimeistely että vastustajan maalivahti on kutistettu
 *      kohti liigan keskiarvoa
 *   3. Pienet, toisistaan riippumattomat korjaukset: kotietu, lepo, erikoistilanteet
 *   4. Lopputulosjakauma analyyttisesti (ei arvontaa), tasatilanteet korotettuna
 *
 * Mitä vanhaan verrattuna muuttui ja miksi:
 *
 *   - Maalipohjaisuus → laukauspohjaisuus. Laukausmäärä vakiintuu nopeasti,
 *     maalimäärä ei. Vanha malli piti kymmenen ottelun kuumaa maalintekoa
 *     pysyvänä ominaisuutena.
 *
 *   - Kutistus kohti keskiarvoa. Vanha malli uskoi viiden ottelun lukuja
 *     sellaisenaan ja tuotti lokakuussa villejä ennusteita.
 *
 *   - Kertoimien kasautuminen poistui. Vanhassa mallissa "viimeiset 10",
 *     "voittoputki" ja "kotimenestys" kerrottiin peräkkäin, vaikka ne mittaavat
 *     suurelta osin samaa asiaa — hyvä joukkue sai edun kolmeen kertaan.
 *
 *   - Monte Carlo → analyyttinen ratkaisu. 10 000 arvontaa toi mukanaan noin
 *     puolen prosenttiyksikön satunnaisvirheen, ja sama ottelu antoi eri luvut
 *     joka ajolla. Nyt tulos on tarkka ja toistettava.
 */

const MODEL = {
    /**
     * Kotietu. NHL:ssä kotijoukkue voittaa noin 53 % otteluista.
     * Vaikutus jaetaan symmetrisesti: koti hieman ylös, vieras hieman alas.
     */
    homeAdvantage: 1.035,

    /*
     * Lepopäivien kertoimet eivät ole enää täällä: ne mitataan NHL:n
     * toteutuneesta datasta (ks. restEffects.js). Aiemmat arvatut arvot
     * (hyökkäys 0,96 ja puolustus 1,05 peräkkäisinä päivinä) yliarvioivat
     * erityisesti puolustusvaikutusta.
     */

    /** Erikoistilanteiden enimmäisvaikutus odotusmaaleihin. */
    specialTeamsMax: 0.06,

    /** Muodon (viimeiset 10) enimmäisvaikutus. Tarkoituksella pieni. */
    formMax: 0.05,

    /** Odotusmaalien järkevät rajat, ettei yksikään korjaus karkaa. */
    minExpectedGoals: 1.4,
    maxExpectedGoals: 5.5,
};

async function fetchGamesForDate(date) {
    const data = await web(`/schedule/${date}`);
    return (data.gameWeek ?? []).find((d) => d.date === date)?.games ?? [];
}

/** Maalivahdit joukkueittain, järjestettynä peliajan mukaan. */
async function fetchGoalies(season, beforeDate) {
    let cayenneExp = `seasonId=${season} and gameTypeId=2`;
    if (beforeDate) cayenneExp += ` and gameDate<"${beforeDate}"`;

    const data = await stats('goalie/summary', { limit: -1, cayenneExp }).catch(() => null);

    const byTeam = new Map();
    for (const goalie of data?.data ?? []) {
        const abbrev = goalie.teamAbbrevs ? goalie.teamAbbrevs.split(',').pop().trim() : null;
        if (!abbrev) continue;
        if (!byTeam.has(abbrev)) byTeam.set(abbrev, []);
        byTeam.get(abbrev).push({
            name: goalie.goalieFullName,
            timeOnIce: goalie.timeOnIce ?? 0,
            savePct: goalie.savePct ?? null,
            saves: goalie.saves ?? 0,
            shotsAgainst: goalie.shotsAgainst ?? 0,
        });
    }

    for (const list of byTeam.values()) list.sort((a, b) => b.timeOnIce - a.timeOnIce);
    return byTeam;
}

/**
 * Joukkueen odotettu maalivahtitaso ottelussa.
 *
 * Aloittajaa ei julkisteta etukäteen, joten lasketaan painotettu odotusarvo
 * peliajan perusteella. Peräkkäisinä päivinä pelattaessa ykkösvahdin
 * todennäköisyys laskee, koska vaihtovahti pelaa tyypillisesti toisen illan.
 */
function expectedGoaltending(goalies, leagueSavePct, isBackToBack) {
    if (!goalies?.length) return leagueSavePct;

    const totalToi = goalies.reduce((sum, g) => sum + g.timeOnIce, 0);
    if (totalToi === 0) return leagueSavePct;

    const weights = goalies.map((g) => g.timeOnIce / totalToi);

    if (isBackToBack && goalies.length > 1) {
        const shift = weights[0] * 0.4;
        weights[0] -= shift;
        weights[1] += shift;
    }

    return goalies.reduce(
        (sum, goalie, i) => sum + weights[i] * regressedSavePct(goalie, leagueSavePct),
        0,
    );
}

/** Viimeisen kymmenen ottelun pisteosuus sarjataulukosta. */
function recentForm(standingsRow) {
    const points = (standingsRow?.l10Wins ?? 0) * 2 + (standingsRow?.l10OtLosses ?? 0);
    const games = (standingsRow?.l10Wins ?? 0) + (standingsRow?.l10Losses ?? 0) + (standingsRow?.l10OtLosses ?? 0);
    if (games === 0) return 0.5;
    return points / (games * 2);
}

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

export async function generateMatchPredictions(date = toDateString()) {
    // Kausi johdetaan ennustettavasta päivästä, ei nykyhetkestä. Muuten
    // menneiden päivien ennusteet hakisivat tilastot väärältä kaudelta ja
    // palauttaisivat tyhjää.
    const season = getSeasonId(new Date(`${date}T12:00:00Z`));

    const games = await fetchGamesForDate(date);
    if (games.length === 0) return [];

    // Kaikki tilastot rajataan ennustepäivää edeltäviin otteluihin. Aamulla
    // laskettava ennuste ei saa nähdä saman illan tuloksia — ja takautuvassa
    // testauksessa sama rajaus estää tulevan datan vuotamisen.
    const [teamStatsRaw, goaliesByTeam, standingsData, yesterdayGames, restEffects, corsiByTeam] = await Promise.all([
        fetchTeamStats(season, date),
        fetchGoalies(season, date),
        web(`/standings/${date}`).catch(() => web('/standings/now')),
        fetchGamesForDate(addDays(date, -1)).catch(() => []),
        getRestEffects(season).catch(() => new Map()),
        fetchTeamCorsi(season, date).catch(() => new Map()),
    ]);

    // Kesällä ja kauden alussa joukkuetilastot voivat olla tyhjät.
    const teamStats = teamStatsRaw
        .map((t) => ({ ...t, abbrev: abbrevFromName(t.teamFullName) }))
        .filter((t) => t.abbrev);

    if (teamStats.length === 0) return [];

    const league = computeLeagueBaseline(teamStats);
    const strengthByTeam = new Map(
        teamStats.map((team) => [
            team.abbrev,
            computeTeamStrength(team, league, corsiByTeam.get(team.teamFullName)),
        ]),
    );

    const standings = new Map(
        (standingsData.standings ?? []).map((t) => [t.teamAbbrev.default, t]),
    );

    const backToBack = new Set();
    for (const g of yesterdayGames) {
        backToBack.add(g.homeTeam.abbrev);
        backToBack.add(g.awayTeam.abbrev);
    }

    // Lepopäivät edellisestä ottelusta — haetaan vain mukana olevien joukkueiden ohjelmat.
    const involved = [...new Set(games.flatMap((g) => [g.homeTeam.abbrev, g.awayTeam.abbrev]))];
    const schedules = await mapWithConcurrency(involved, 6, (abbrev) =>
        web(`/club-schedule-season/${abbrev}/${season}`),
    );
    const restDays = new Map();
    involved.forEach((abbrev, i) => {
        restDays.set(abbrev, daysSinceLastGame(schedules[i], date));
    });

    const predictions = [];

    for (const game of games) {
        const home = game.homeTeam.abbrev;
        const away = game.awayTeam.abbrev;

        const homeStrength = strengthByTeam.get(home);
        const awayStrength = strengthByTeam.get(away);
        if (!homeStrength || !awayStrength) continue;

        const homeReasons = [];
        const awayReasons = [];

        // --- 1. Odotuslaukaukset ---
        let homeShots = league.shotsPerGame * homeStrength.shotGeneration / awayStrength.shotSuppression;
        let awayShots = league.shotsPerGame * awayStrength.shotGeneration / homeStrength.shotSuppression;

        // --- 2. Maalintekotodennäköisyys laukausta kohti ---
        const homeB2B = backToBack.has(home);
        const awayB2B = backToBack.has(away);

        const homeGoalieSv = expectedGoaltending(goaliesByTeam.get(home), league.savePct, homeB2B);
        const awayGoalieSv = expectedGoaltending(goaliesByTeam.get(away), league.savePct, awayB2B);

        // Hyökkäävän joukkueen viimeistely ja puolustavan maalivahdin taso
        // vaikuttavat samaan lukuun: maalin todennäköisyyteen per laukaus.
        const homeConversion = league.shootingPct * homeStrength.finishing + (league.savePct - awayGoalieSv);
        const awayConversion = league.shootingPct * awayStrength.finishing + (league.savePct - homeGoalieSv);

        let lambdaHome = homeShots * Math.max(0.03, homeConversion);
        let lambdaAway = awayShots * Math.max(0.03, awayConversion);

        if (awayGoalieSv > league.savePct + 0.008) awayReasons.push({ key: 'reasonStrongGoalie', type: 'plus' });
        else if (awayGoalieSv < league.savePct - 0.008) awayReasons.push({ key: 'reasonWeakGoalie', type: 'minus' });
        if (homeGoalieSv > league.savePct + 0.008) homeReasons.push({ key: 'reasonStrongGoalie', type: 'plus' });
        else if (homeGoalieSv < league.savePct - 0.008) homeReasons.push({ key: 'reasonWeakGoalie', type: 'minus' });

        // --- 3. Kotietu ---
        lambdaHome *= MODEL.homeAdvantage;
        lambdaAway /= MODEL.homeAdvantage;

        // --- 4. Lepo ja väsymys, mitatuilla kertoimilla ---
        // Peräkkäisinä päivinä pelaaminen tunnistetaan eilisen ohjelmasta;
        // muuten käytetään laskettua lepopäivien määrää.
        const homeRest = homeB2B ? 0 : restDays.get(home);
        const awayRest = awayB2B ? 0 : restDays.get(away);

        const homeRestEffect = restMultipliers(restEffects, homeRest);
        const awayRestEffect = restMultipliers(restEffects, awayRest);

        // Hyökkäyskerroin koskee joukkueen omia maaleja, puolustuskerroin
        // vastustajan maaleja.
        lambdaHome *= homeRestEffect.attack * awayRestEffect.defence;
        lambdaAway *= awayRestEffect.attack * homeRestEffect.defence;

        if (homeB2B && !awayB2B) {
            homeReasons.push({ key: 'reasonB2BFatigue', type: 'minus' });
            awayReasons.push({ key: 'reasonRestAdvantage', type: 'plus' });
        } else if (awayB2B && !homeB2B) {
            awayReasons.push({ key: 'reasonB2BFatigue', type: 'minus' });
            homeReasons.push({ key: 'reasonRestAdvantage', type: 'plus' });
        }

        // --- 5. Erikoistilanteet ---
        // Ylivoima vastaan alivoima: mitataan miten paljon toisen ylivoima ylittää
        // toisen alivoiman keskitason. Vaikutus on rajattu, koska erikoistilanteita
        // on ottelussa vain muutama minuutti.
        const homeSpecial = homeStrength.powerPlayPct - (1 - awayStrength.penaltyKillPct);
        const awaySpecial = awayStrength.powerPlayPct - (1 - homeStrength.penaltyKillPct);
        const specialEdge = clamp((homeSpecial - awaySpecial) * 0.5, -MODEL.specialTeamsMax, MODEL.specialTeamsMax);

        lambdaHome *= 1 + specialEdge;
        lambdaAway *= 1 - specialEdge;

        if (specialEdge > 0.015) {
            homeReasons.push({ key: 'reasonPPvsPK', type: 'plus' });
            awayReasons.push({ key: 'reasonPKIssues', type: 'minus' });
        } else if (specialEdge < -0.015) {
            awayReasons.push({ key: 'reasonPPvsPK', type: 'plus' });
            homeReasons.push({ key: 'reasonPKIssues', type: 'minus' });
        }

        // --- 6. Muoto ---
        // Tarkoituksella pieni vaikutus: kymmenen ottelun tulokset ovat suurelta
        // osin satunnaisuutta, ja joukkueen taso näkyy jo laukausluvuissa.
        const formDiff = recentForm(standings.get(home)) - recentForm(standings.get(away));
        const formEdge = clamp(formDiff * MODEL.formMax * 2, -MODEL.formMax, MODEL.formMax);
        lambdaHome *= 1 + formEdge;
        lambdaAway *= 1 - formEdge;

        if (formEdge > 0.02) {
            homeReasons.push({ key: 'reasonFormAdvantage', type: 'plus' });
            awayReasons.push({ key: 'reasonWeakForm', type: 'minus' });
        } else if (formEdge < -0.02) {
            awayReasons.push({ key: 'reasonFormAdvantage', type: 'plus' });
            homeReasons.push({ key: 'reasonWeakForm', type: 'minus' });
        }

        // --- 7. Rajaus ja lopputulosjakauma ---
        lambdaHome = clamp(lambdaHome, MODEL.minExpectedGoals, MODEL.maxExpectedGoals);
        lambdaAway = clamp(lambdaAway, MODEL.minExpectedGoals, MODEL.maxExpectedGoals);

        const outcome = outcomeProbabilities(lambdaHome, lambdaAway);
        const pct = (value) => Math.round(value * 100);

        const byImportance = (a, b) => (a.type === b.type ? 0 : a.type === 'plus' ? -1 : 1);

        predictions.push({
            gameId: game.id,
            date,
            startTimeUTC: game.startTimeUTC,
            home,
            away,

            expectedGoals: {
                home: Number(lambdaHome.toFixed(2)),
                away: Number(lambdaAway.toFixed(2)),
            },
            expectedShots: {
                home: Math.round(homeShots),
                away: Math.round(awayShots),
            },

            homeScore: outcome.mostLikelyScore.home,
            awayScore: outcome.mostLikelyScore.away,
            isOT: outcome.mostLikelyScore.isOvertime,

            homeWinProb: pct(outcome.homeWin),
            awayWinProb: pct(outcome.awayWin),
            homeRegProb: pct(outcome.homeRegulationWin),
            awayRegProb: pct(outcome.awayRegulationWin),
            otProb: pct(outcome.overtime),
            over55Prob: pct(outcome.overFiveHalfGoals),

            // Tarkat todennäköisyydet talteen mallin arviointia varten.
            homeWinProbability: outcome.homeWin,

            homeReasons: homeReasons.sort(byImportance),
            awayReasons: awayReasons.sort(byImportance),
        });
    }

    return predictions;
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

export const MATCH_MODEL = MODEL;
