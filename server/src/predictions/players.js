import { web, stats } from '../lib/nhlApi.js';
import { getSeasonId, REGULAR_SEASON_GAMES } from '../lib/season.js';
import { toDateString } from '../lib/dates.js';
import { shrinkRate, pointsInterval } from './math.js';

/**
 * Pelaajien loppukauden pistemääräennuste.
 *
 * Malli:
 *   1. Syöttö- ja laukausvauhti per peli, kutistettuna kohti liigan keskiarvoa
 *   2. Painotus viimeisen 21 päivän vauhdilla (muotokorjaus)
 *   3. Kertoimet iästä, ylivoimavastuusta ja peliaikatrendistä
 *   4. Maalit laukauksista regressoidulla laukaisuprosentilla
 *   5. Arvio siitä, montako jäljellä olevaa ottelua pelaaja oikeasti pelaa
 *   6. Vaihteluväli, ei pelkkä piste-estimaatti
 *
 * Muutokset vanhaan:
 *
 *   - Kutistus lisätty. Vanha malli laski 10 ottelun pelaajan vauhdin
 *     sellaisenaan koko loppukaudelle. Kymmenen ottelun 1.2 pistettä per peli
 *     on suurelta osin onnea, ei tasoa.
 *
 *   - Loukkaantumiset huomioitu. Vanha malli oletti, että pelaaja pelaa jokaisen
 *     jäljellä olevan ottelun. Jos pelaaja on ollut sivussa neljäsosan kaudesta,
 *     hän tuskin pelaa kaikkia jäljellä olevia.
 *
 *   - Vaihteluväli lisätty. "87 pistettä" kuulostaa mittaustulokselta;
 *     "78–96" kertoo rehellisesti mitä tiedetään.
 */

const MODEL = {
    minGamesPlayed: 8,
    recentWindowDays: 21,
    recentWeight: 0.3,

    /** Kutistus: kuinka monen keskiverto-ottelun verran ennakko painaa. */
    priorGames: 12,

    /** Laukaisuprosentti kutistetaan laukausmäärän mukaan. */
    shootingPriorShots: 250,
    leagueShootingPct: 0.105,

    youngAge: 23,
    veteranAge: 33,
    youngBoost: 1.03,
    veteranDecline: 0.97,

    powerPlayThreshold: 0.3,
    powerPlayBoost: 1.02,

    toiTrendSeconds: 60,
    toiTrendBoost: 1.03,
    toiTrendDecline: 0.97,

    /** Terveinäkin pelaajat lepäävät; harva pelaa kaikki 82 ottelua. */
    maxAvailability: 0.97,
};

function ageFrom(birthDate, now = new Date()) {
    if (!birthDate) return 27;
    const born = new Date(birthDate);
    let age = now.getFullYear() - born.getFullYear();
    const month = now.getMonth() - born.getMonth();
    if (month < 0 || (month === 0 && now.getDate() < born.getDate())) age--;
    return age;
}

async function fetchRecentForm(season) {
    const from = new Date();
    from.setDate(from.getDate() - MODEL.recentWindowDays);

    const data = await stats('skater/summary', {
        limit: -1,
        factCayenneExp: 'gamesPlayed>=1',
        cayenneExp: `gameDate>="${toDateString(from)}" and gameTypeId=2 and seasonId=${season}`,
    }).catch(() => null);

    const map = new Map();
    for (const p of data?.data ?? []) {
        map.set(p.playerId, {
            gamesPlayed: p.gamesPlayed,
            assists: p.assists,
            shots: p.shots,
            timeOnIcePerGame: p.timeOnIcePerGame,
        });
    }
    return map;
}

/** Liigan keskimääräiset per-peli-vauhdit, joita kohti yksilöitä kutistetaan. */
function leagueAverages(players) {
    let games = 0;
    let assists = 0;
    let shots = 0;

    for (const p of players) {
        games += p.gamesPlayed ?? 0;
        assists += p.assists ?? 0;
        shots += p.shots ?? 0;
    }

    if (games === 0) return { assistsPerGame: 0.25, shotsPerGame: 1.8 };
    return { assistsPerGame: assists / games, shotsPerGame: shots / games };
}

export async function generatePlayerPredictions() {
    // Kausi luetaan sarjataulukosta, jotta kesällä käytetään päättyneen kauden
    // dataa eikä tyhjää tulevaa kautta.
    const standings = await web('/standings/now');
    const rows = standings.standings ?? [];
    const season = rows[0]?.seasonId ? String(rows[0].seasonId) : getSeasonId();

    const [summary, bios, recent] = await Promise.all([
        stats('skater/summary', { limit: -1, cayenneExp: `seasonId=${season} and gameTypeId=2` }),
        stats('skater/bios', { limit: -1, cayenneExp: `seasonId=${season}` }),
        fetchRecentForm(season),
    ]);

    const teamGamesPlayed = new Map(rows.map((t) => [t.teamAbbrev.default, t.gamesPlayed]));
    const birthDates = new Map((bios?.data ?? []).map((b) => [b.playerId, b.birthDate]));

    const allPlayers = summary?.data ?? [];
    const league = leagueAverages(allPlayers);

    const eligible = allPlayers.filter((p) => p.gamesPlayed >= MODEL.minGamesPlayed);

    const projected = eligible.map((p) => {
        // teamAbbrevs voi olla "COL,TOR" jos pelaaja on vaihtanut seuraa.
        const team = p.teamAbbrevs ? p.teamAbbrevs.split(',').pop().trim() : 'UNK';
        const teamGP = teamGamesPlayed.get(team) ?? p.gamesPlayed;
        const teamGamesLeft = Math.max(0, REGULAR_SEASON_GAMES - teamGP);

        // Kuinka suuren osan joukkueen otteluista pelaaja on pelannut?
        // Tämä ennustaa myös tulevaa käytettävyyttä.
        const availability = teamGP > 0
            ? Math.min(MODEL.maxAvailability, p.gamesPlayed / teamGP)
            : MODEL.maxAvailability;

        const expectedGamesLeft = teamGamesLeft * availability;

        // --- Kutistetut perusvauhdit ---
        let assistsPerGame = shrinkRate(
            p.assists ?? 0,
            p.gamesPlayed,
            league.assistsPerGame,
            MODEL.priorGames,
        );

        let shotsPerGame = shrinkRate(
            p.shots ?? 0,
            p.gamesPlayed,
            league.shotsPerGame,
            MODEL.priorGames,
        );

        // --- Muotokorjaus ---
        const form = recent.get(p.playerId);
        let trend = 1.0;
        const factors = [];

        if (form && form.gamesPlayed >= 3) {
            const w = MODEL.recentWeight;
            assistsPerGame = assistsPerGame * (1 - w) + (form.assists / form.gamesPlayed) * w;
            shotsPerGame = shotsPerGame * (1 - w) + (form.shots / form.gamesPlayed) * w;

            const toiDelta = form.timeOnIcePerGame - p.timeOnIcePerGame;
            if (toiDelta > MODEL.toiTrendSeconds) { trend *= MODEL.toiTrendBoost; factors.push('roleUp'); }
            else if (toiDelta < -MODEL.toiTrendSeconds) { trend *= MODEL.toiTrendDecline; factors.push('roleDown'); }
        }

        // --- Ikä ja rooli ---
        const age = ageFrom(birthDates.get(p.playerId));
        if (age <= MODEL.youngAge) { trend *= MODEL.youngBoost; factors.push('young'); }
        else if (age >= MODEL.veteranAge) { trend *= MODEL.veteranDecline; factors.push('veteran'); }

        if (p.gamesPlayed > 0 && (p.ppPoints ?? 0) / p.gamesPlayed > MODEL.powerPlayThreshold) {
            trend *= MODEL.powerPlayBoost;
            factors.push('powerplay');
        }

        // --- Maalit laukauksista ---
        // Yksittäisen kauden laukaisuprosentti on hyvin kohinaista, joten se
        // vedetään voimakkaasti kohti liigan keskiarvoa. Ilman tätä kuumana
        // käyvä pelaaja ennustettaisiin jatkamaan mahdottomalla vauhdilla.
        const regressedShootingPct = shrinkRate(
            p.goals ?? 0,
            p.shots ?? 0,
            MODEL.leagueShootingPct,
            MODEL.shootingPriorShots,
        );

        const expectedAssists = assistsPerGame * trend * expectedGamesLeft;
        const expectedShots = shotsPerGame * trend * expectedGamesLeft;
        const expectedGoals = expectedShots * regressedShootingPct;
        const expectedRemainingPoints = expectedAssists + expectedGoals;

        const goals = Math.round((p.goals ?? 0) + expectedGoals);
        const assists = Math.round((p.assists ?? 0) + expectedAssists);
        const points = goals + assists;

        const ownShootingPct = (p.shots ?? 0) > 0 ? (p.goals ?? 0) / p.shots : 0;

        return {
            id: p.playerId,
            name: p.skaterFullName,
            team,
            position: p.positionCode,

            gamesLeft: Math.round(expectedGamesLeft),
            availability: Number(availability.toFixed(2)),

            current: {
                gp: p.gamesPlayed,
                g: p.goals ?? 0,
                a: p.assists ?? 0,
                p: p.points ?? 0,
                shPct: Number((ownShootingPct * 100).toFixed(1)),
            },

            predicted: {
                g: goals,
                a: assists,
                p: points,
                // Vaihteluväli kertoo kuinka paljon epävarmuutta ennusteessa on.
                range: pointsInterval(p.points ?? 0, expectedRemainingPoints),
            },

            factors,
        };
    });

    return projected.sort((a, b) => b.predicted.p - a.predicted.p).slice(0, 100);
}

export const PLAYER_MODEL = MODEL;
