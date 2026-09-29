import { web, mapWithConcurrency } from '../lib/nhlApi.js';
import { getSeasonId, REGULAR_SEASON_GAMES } from '../lib/season.js';

/**
 * Joukkueiden loppusijoitusennuste.
 *
 * Voimaluku ("true talent") on painotettu keskiarvo kolmesta mittarista:
 *   - Pythagoraan odotusvoittoprosentti (maalit tehty / päästetty)
 *   - toteutunut pisteprosentti
 *   - viimeisen 10 ottelun pisteprosentti
 *
 * Pythagoras saa suurimman painon, koska maaliero ennustaa tulevaa paremmin kuin
 * pistesaldo — pistesaldossa on paljon jatkoaikaonnea.
 *
 * Suorituskyky: vanha versio haki 32 joukkueen ohjelmat peräkkäin ja nukkui
 * sekunnin jokaisen välissä, eli ajo kesti yli 30 sekuntia. Nyt haut menevät
 * kuuden rinnakkaisuudella, mikä vie muutaman sekunnin ilman rate-limitiä.
 */

const MODEL = {
    pythagoreanExponent: 2.0,
    weights: { pythagorean: 0.5, pointPct: 0.3, last10: 0.2 },
    homeAdvantage: 1.06,
    roadPenalty: 0.94,
    backToBackPenalty: 0.88,
    restBonus: 1.03,
    restDaysForBonus: 3,
    maxPointsPerGame: 2,
};

function trueTalent(team) {
    const gf = team.goalFor ?? 0;
    const ga = team.goalAgainst ?? 0;
    const e = MODEL.pythagoreanExponent;

    let pythagorean = Math.pow(gf, e) / (Math.pow(gf, e) + Math.pow(ga, e));
    if (!Number.isFinite(pythagorean)) pythagorean = 0.5;

    const last10 = ((team.l10Wins ?? 0) * 2 + (team.l10OtLosses ?? 0)) / 20;
    const w = MODEL.weights;

    return pythagorean * w.pythagorean + (team.pointPctg ?? 0.5) * w.pointPct + last10 * w.last10;
}

export async function generateTeamPredictions() {
    const data = await web('/standings/now');
    const standings = data.standings ?? [];
    if (standings.length === 0) return [];

    // Kausi luetaan sarjataulukosta, ei kalenterista. Kesällä /standings/now
    // palauttaa yhä päättyneen kauden, ja jos hakisimme ohjelmat "kuluvalle"
    // kaudelle, malli laskisi tulevan kauden 82 ottelua päättyneen kauden
    // pisteiden päälle — tuloksena 245 pistettä.
    const season = standings[0].seasonId ? String(standings[0].seasonId) : getSeasonId();
    const seasonComplete = standings.every((t) => t.gamesPlayed >= REGULAR_SEASON_GAMES);

    if (seasonComplete) {
        // Runkosarja on pelattu — ei ennustettavaa. Palautetaan lopullinen
        // taulukko, jotta käyttöliittymä voi näyttää sen ennusteen sijaan.
        return standings
            .map((team) => ({
                teamName: team.teamName.default,
                teamAbbrev: team.teamAbbrev.default,
                conference: team.conferenceName,
                division: team.divisionName,
                gamesPlayed: team.gamesPlayed,
                currentPoints: team.points,
                projectedPoints: team.points,
                ptsPct: Number(((team.pointPctg ?? 0) * 100).toFixed(1)),
                strength: Number(trueTalent(team).toFixed(3)),
                seasonComplete: true,
                season,
            }))
            .sort((a, b) => b.projectedPoints - a.projectedPoints);
    }

    const strength = new Map(standings.map((t) => [t.teamAbbrev.default, trueTalent(t)]));

    const schedules = await mapWithConcurrency(standings, 6, (t) =>
        web(`/club-schedule-season/${t.teamAbbrev.default}/${season}`),
    );

    const projected = standings.map((team, i) => {
        const abbrev = team.teamAbbrev.default;
        const myStrength = strength.get(abbrev) ?? 0.5;
        const schedule = schedules[i];

        let futurePoints = 0;

        if (schedule?.games) {
            let previousDate = null;

            for (const game of schedule.games) {
                if (game.gameState !== 'FUT' && game.gameState !== 'PRE') continue;

                const isHome = game.homeTeam.abbrev === abbrev;
                const opponent = isHome ? game.awayTeam.abbrev : game.homeTeam.abbrev;
                const oppStrength = strength.get(opponent) ?? 0.5;

                let multiplier = isHome ? MODEL.homeAdvantage : MODEL.roadPenalty;
                multiplier *= 1 + (0.5 - oppStrength);

                const gameDate = new Date(game.startTimeUTC);
                if (previousDate) {
                    const daysOff = Math.floor((gameDate - previousDate) / (1000 * 60 * 60 * 24));
                    if (daysOff < 1) multiplier *= MODEL.backToBackPenalty;
                    else if (daysOff >= MODEL.restDaysForBonus) multiplier *= MODEL.restBonus;
                }
                previousDate = gameDate;

                futurePoints += Math.min(2 * myStrength * multiplier, MODEL.maxPointsPerGame);
            }
        } else {
            // Varasuunnitelma jos ohjelmaa ei saatu: pelkkä pisteprosentin jatke.
            const gamesRemaining = REGULAR_SEASON_GAMES - team.gamesPlayed;
            futurePoints = gamesRemaining * 2 * (team.pointPctg ?? 0.5);
        }

        return {
            teamName: team.teamName.default,
            teamAbbrev: abbrev,
            conference: team.conferenceName,
            division: team.divisionName,
            gamesPlayed: team.gamesPlayed,
            currentPoints: team.points,
            projectedPoints: Math.round(team.points + futurePoints),
            ptsPct: Number(((team.pointPctg ?? 0) * 100).toFixed(1)),
            strength: Number(myStrength.toFixed(3)),
            seasonComplete: false,
            season,
        };
    });

    return projected.sort((a, b) => b.projectedPoints - a.projectedPoints);
}
