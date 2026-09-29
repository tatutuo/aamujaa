import { web } from '../lib/nhlApi.js';
import { getOrFetch, TTL } from '../lib/cache.js';
import { getSeasonId } from '../lib/season.js';

/**
 * Pudotuspelikaavio ja sarjojen ottelut.
 *
 * Kaavio haetaan päättymisvuodella (kausi 2025–26 -> 2026). Ennen uuden kauden
 * pudotuspelejä näytetään edellinen kaavio, jolloin näkymä ei ole tyhjä
 * syksyllä.
 */

const TTL_PAST = 24 * 60 * 60_000;

const endYear = (seasonId) => Number(String(seasonId).slice(4));

function team(t, rank, rankAbbrev, wins) {
    if (!t?.abbrev) return null;
    return { abbrev: t.abbrev, rank: rank ?? null, seed: rankAbbrev ?? null, wins: wins ?? 0 };
}

async function fetchBracket(year) {
    const data = await web(`/playoff-bracket/${year}`).catch(() => null);
    const series = (data?.series ?? []).map((s) => {
        const top = team(s.topSeedTeam, s.topSeedRank, s.topSeedRankAbbrev, s.topSeedWins);
        const bottom = team(s.bottomSeedTeam, s.bottomSeedRank, s.bottomSeedRankAbbrev, s.bottomSeedWins);
        let winner = null;
        if (s.winningTeamId) {
            winner = s.winningTeamId === s.topSeedTeam?.id ? top?.abbrev : bottom?.abbrev;
        }
        return {
            letter: s.seriesLetter,
            round: s.playoffRound,
            title: s.seriesTitle,
            top,
            bottom,
            winner,
        };
    });
    return series;
}

export async function getBracket({ year } = {}) {
    const requested = year ?? endYear(getSeasonId());
    const isCurrent = requested === endYear(getSeasonId());

    return getOrFetch(`bracket:${requested}:${year ? 'fixed' : 'auto'}`, isCurrent ? TTL.standings : TTL_PAST, async () => {
        let series = await fetchBracket(requested);
        let used = requested;
        let isPrevious = false;
        if (series.length === 0 && !year) {
            series = await fetchBracket(requested - 1);
            used = requested - 1;
            isPrevious = true;
        }
        const final = series.find((s) => s.round === 4);
        return { year: used, isPrevious, champion: final?.winner ?? null, series };
    });
}

export async function getSeriesGames(season, letter) {
    return getOrFetch(`series:${season}:${letter}`, TTL.schedule, async () => {
        const data = await web(`/schedule/playoff-series/${season}/${letter.toLowerCase()}`);
        return {
            letter: data.seriesLetter,
            round: data.round,
            neededToWin: data.neededToWin,
            games: (data.games ?? []).map((g) => ({
                id: g.id,
                gameNumber: g.gameNumber,
                ifNecessary: g.ifNecessary,
                startTimeUTC: g.startTimeUTC,
                gameState: g.gameState,
                gameType: 3,
                awayTeam: { abbrev: g.awayTeam?.abbrev, score: g.awayTeam?.score },
                homeTeam: { abbrev: g.homeTeam?.abbrev, score: g.homeTeam?.score },
                gameOutcome: g.gameOutcome ?? null,
                seriesStatus: g.seriesStatus ?? null,
            })),
        };
    });
}
