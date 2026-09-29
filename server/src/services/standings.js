import { web } from '../lib/nhlApi.js';
import { getOrFetch, TTL } from '../lib/cache.js';
import { getSeasonId, getPreviousSeasonId } from '../lib/season.js';

/**
 * Sarjataulukko valitulta kaudelta.
 *
 * NHL:n /standings/{päivä} palauttaa tilanteen annettuna päivänä, joten
 * päättyneen kauden lopputilanne haetaan runkosarjan viimeiseltä päivältä
 * (`standingsEnd`, /standings-season). Ennen kauden avausta kuluvan kauden
 * taulukko on pelkkiä nollia; silloin näytetään edellisen kauden lopputilanne.
 */

const TTL_PAST_SEASON = 24 * 60 * 60_000;

async function seasonEndDate(seasonId) {
    const seasons = await getOrFetch('standings-season', TTL_PAST_SEASON, () => web('/standings-season'));
    return seasons.seasons?.find((s) => String(s.id) === String(seasonId))?.standingsEnd ?? null;
}

const record = (w, l, otl) => `${w ?? 0}-${l ?? 0}-${otl ?? 0}`;

/** NHL:n raakarivi -> taulukon rivi. Nimet lyhyitä, koska niitä on 32 × monta. */
function normalise(t) {
    return {
        team: t.teamAbbrev?.default,
        name: t.teamCommonName?.default ?? t.teamName?.default,
        placeName: t.placeName?.default ?? null,
        conference: t.conferenceName,
        division: t.divisionName,
        leagueSeq: t.leagueSequence,
        confSeq: t.conferenceSequence,
        divSeq: t.divisionSequence,
        wcSeq: t.wildcardSequence,
        // x = pudotuspelipaikka varma, y = divisioonan voitto, z = konferenssin
        // kärki, p = runkosarjan voitto, e = putosi.
        clinch: t.clinchIndicator ?? null,

        gp: t.gamesPlayed,
        wins: t.wins,
        losses: t.losses,
        otLosses: t.otLosses,
        points: t.points,
        pointPct: t.pointPctg,
        regWins: t.regulationWins,
        rowWins: t.regulationPlusOtWins,
        goalsFor: t.goalFor,
        goalsAgainst: t.goalAgainst,
        goalDiff: t.goalDifferential,
        home: record(t.homeWins, t.homeLosses, t.homeOtLosses),
        homePoints: t.homePoints,
        road: record(t.roadWins, t.roadLosses, t.roadOtLosses),
        roadPoints: t.roadPoints,
        l10: record(t.l10Wins, t.l10Losses, t.l10OtLosses),
        l10Points: t.l10Points,
        streak: t.streakCode ? `${t.streakCode}${t.streakCount}` : null,
    };
}

async function fetchStandings(seasonId, isCurrent) {
    const date = isCurrent ? 'now' : await seasonEndDate(seasonId);
    if (!date) return null;
    const raw = await web(`/standings/${date}`);
    const rows = raw.standings ?? [];
    return { date: rows[0]?.date ?? date, rows };
}

export async function getStandings({ season } = {}) {
    const current = getSeasonId();
    const requested = season ?? current;
    const isCurrent = requested === current;

    return getOrFetch(`standings:${requested}:${season ? 'fixed' : 'auto'}`, isCurrent ? TTL.standings : TTL_PAST_SEASON, async () => {
        let result = await fetchStandings(requested, isCurrent);
        let used = requested;
        let isPreviousSeason = false;

        const noGamesYet = !result || result.rows.every((t) => (t.gamesPlayed ?? 0) === 0);
        if (noGamesYet && !season) {
            const previous = getPreviousSeasonId();
            const fallback = await fetchStandings(previous, false);
            if (fallback?.rows.length) {
                result = fallback;
                used = previous;
                isPreviousSeason = true;
            }
        }

        const sorted = [...(result?.rows ?? [])].sort(
            (a, b) => b.points - a.points || b.pointPctg - a.pointPctg,
        );

        return {
            season: used,
            isPreviousSeason,
            date: result?.date ?? null,
            teams: sorted.map(normalise),
            // Vanhat kentät, joita muut näkymät vielä lukevat.
            eastern: sorted.filter((t) => t.conferenceName === 'Eastern'),
            western: sorted.filter((t) => t.conferenceName === 'Western'),
            league: sorted,
        };
    });
}
