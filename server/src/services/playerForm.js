import { web } from '../lib/nhlApi.js';
import { getOrFetch, TTL } from '../lib/cache.js';
import { getSeasonId, getPreviousSeasonId } from '../lib/season.js';

/**
 * Pelaajan ottelukohtainen loki ja siitä johdetut tunnusluvut.
 *
 * `/player/{id}/game-log` palauttaa koko kauden ottelu otteluilta: pisteet,
 * laukaukset, peliajan, vuorot, vastustajan ja koti/vieras-tiedon. Tästä saa
 * suoraan muotokäyrän ja jakaumat, joita pelkkä kausisumma ei kerro.
 */

/** Pisimmän yhtäjaksoisen pisteputken pituus. */
function longestStreak(games) {
    let best = 0;
    let current = 0;
    // Loki on uusimmasta vanhimpaan, joten käydään käänteisessä järjestyksessä.
    for (let i = games.length - 1; i >= 0; i--) {
        if (games[i].points > 0) {
            current += 1;
            best = Math.max(best, current);
        } else {
            current = 0;
        }
    }
    return best;
}

/** Nykyinen käynnissä oleva pisteputki. */
function currentStreak(games) {
    let streak = 0;
    for (const game of games) {
        if (game.points > 0) streak += 1;
        else break;
    }
    return streak;
}

function summarise(games) {
    if (games.length === 0) return null;

    const sum = (list, key) => list.reduce((acc, g) => acc + (g[key] ?? 0), 0);

    const home = games.filter((g) => g.homeRoadFlag === 'H');
    const road = games.filter((g) => g.homeRoadFlag === 'R');

    const perGame = (list, key) => (list.length ? sum(list, key) / list.length : 0);

    /** "18:16" -> 18.27 minuuttia */
    const toiMinutes = (toi) => {
        if (!toi) return 0;
        const [m, s] = toi.split(':').map(Number);
        return m + (s ?? 0) / 60;
    };

    const avgToi = games.reduce((acc, g) => acc + toiMinutes(g.toi), 0) / games.length;

    return {
        games: games.length,
        goals: sum(games, 'goals'),
        assists: sum(games, 'assists'),
        points: sum(games, 'points'),
        shots: sum(games, 'shots'),
        pointsPerGame: Number(perGame(games, 'points').toFixed(2)),
        shotsPerGame: Number(perGame(games, 'shots').toFixed(1)),
        avgToi: Number(avgToi.toFixed(1)),
        // Kuinka moni ottelu tuotti pisteitä — kertoo tasaisuudesta enemmän
        // kuin keskiarvo, joka voi syntyä muutamasta suurmatsista.
        pointGames: games.filter((g) => g.points > 0).length,
        currentStreak: currentStreak(games),
        longestStreak: longestStreak(games),
        home: {
            games: home.length,
            points: sum(home, 'points'),
            pointsPerGame: Number(perGame(home, 'points').toFixed(2)),
        },
        road: {
            games: road.length,
            points: sum(road, 'points'),
            pointsPerGame: Number(perGame(road, 'points').toFixed(2)),
        },
    };
}

/**
 * @param {string|number} playerId
 * @param {string} [season] kauden tunniste; oletuksena kuluva
 */
export async function getPlayerForm(playerId, season) {
    const requested = season ?? getSeasonId();

    return getOrFetch(`form:${playerId}:${requested}`, TTL.player, async () => {
        const fetchSeason = async (s) => {
            const data = await web(`/player/${playerId}/game-log/${s}/2`).catch(() => null);
            return { season: s, games: data?.gameLog ?? [], available: data?.playerStatsSeasons ?? [] };
        };

        let result = await fetchSeason(requested);

        // Kesällä ja kauden alussa kuluvalla kaudella ei ole vielä otteluita.
        // Näytetään silloin edellinen kausi tyhjän käyrän sijaan.
        let isPreviousSeason = false;
        if (result.games.length === 0 && !season) {
            const previous = await fetchSeason(getPreviousSeasonId());
            if (previous.games.length > 0) {
                result = previous;
                isPreviousSeason = true;
            }
        }

        const games = result.games.map((g) => ({
            gameId: g.gameId,
            date: g.gameDate,
            opponent: g.opponentAbbrev,
            isHome: g.homeRoadFlag === 'H',
            goals: g.goals ?? 0,
            assists: g.assists ?? 0,
            points: g.points ?? 0,
            plusMinus: g.plusMinus ?? 0,
            shots: g.shots ?? 0,
            shifts: g.shifts ?? 0,
            pim: g.pim ?? 0,
            toi: g.toi,
        }));

        return {
            playerId: Number(playerId),
            season: result.season,
            isPreviousSeason,
            // Uusimmasta vanhimpaan, kuten rajapinta ne antaa.
            games,
            summary: summarise(result.games),
            // Rajapinta ilmoittaa kaudet muodossa { season, gameTypes: [2, 3] }.
            availableSeasons: (result.available ?? [])
                .filter((s) => s.gameTypes?.includes(2))
                .map((s) => String(s.season)),
        };
    });
}
