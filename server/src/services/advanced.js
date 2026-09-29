import { stats } from '../lib/nhlApi.js';
import { abbrevFromName } from '../lib/teams.js';
import { getOrFetch, TTL } from '../lib/cache.js';
import { getSeasonId, getPreviousSeasonId } from '../lib/season.js';

/**
 * Edistyneet tilastot.
 *
 * NHL:n tilastorajapinnassa on 45 raporttia ja yli 600 mittaria. Tässä on
 * poimittu ne, jotka kertovat oikeasti jotain mitä perustilastot eivät kerro,
 * ja nimetty ne ymmärrettävästi.
 *
 * Keskeiset käsitteet:
 *
 *   Corsi (satPct) = kaikki laukausyritykset jäällä ollessa, myös blokatut ja
 *   ohi menneet. Mittaa kiekonhallintaa. Ennustaa tulevaa menestystä paremmin
 *   kuin maalit, koska maaleissa on paljon onnea.
 *
 *   Fenwick (usatPct) = sama ilman blokattuja. Osa pitää sitä parempana,
 *   koska blokkaaminen on taito eikä pelkkää sattumaa.
 *
 *   Aloitusvyöhyke kertoo missä pelaaja päästetään jäälle. Puolustusvyöhykkeeltä
 *   aloittava pelaaja saa vaikeamman tehtävän, mikä painaa hänen lukujaan.
 */

/** Raportit ja niistä poimittavat kentät. */
const SKATER_VIEWS = {
    possession: {
        report: 'puckPossessions',
        sort: 'satPct',
        fields: {
            satPct: 'corsiPct',
            usatPct: 'fenwickPct',
            offensiveZoneStartPct: 'offensiveZoneStartPct',
            defensiveZoneStartPct: 'defensiveZoneStartPct',
            onIceShootingPct: 'onIceShootingPct',
            timeOnIcePerGame5v5: 'toi5v5',
            individualShotsForPer60: 'shotsPer60',
        },
    },
    scoring: {
        report: 'scoringRates',
        sort: 'pointsPer605v5',
        fields: {
            pointsPer605v5: 'pointsPer60',
            goalsPer605v5: 'goalsPer60',
            assistsPer605v5: 'assistsPer60',
            primaryAssists5v5: 'primaryAssists',
            shootingPct5v5: 'shootingPct',
            onIceShootingPct5v5: 'onIceShootingPct',
            satRelative5v5: 'corsiRelative',
        },
    },
    physical: {
        report: 'realtime',
        sort: 'hits',
        fields: {
            hits: 'hits',
            hitsPer60: 'hitsPer60',
            blockedShots: 'blocks',
            blockedShotsPer60: 'blocksPer60',
            takeaways: 'takeaways',
            giveaways: 'giveaways',
            takeawaysPer60: 'takeawaysPer60',
            giveawaysPer60: 'giveawaysPer60',
        },
    },
    icetime: {
        report: 'timeonice',
        sort: 'timeOnIcePerGame',
        fields: {
            timeOnIcePerGame: 'toiPerGame',
            ppTimeOnIcePerGame: 'ppToiPerGame',
            shTimeOnIcePerGame: 'shToiPerGame',
            evTimeOnIcePerGame: 'evToiPerGame',
            shiftsPerGame: 'shiftsPerGame',
            timeOnIcePerShift: 'toiPerShift',
        },
    },
    shots: {
        report: 'shottype',
        sort: 'goals',
        fields: {
            goalsWrist: 'wrist',
            goalsSnap: 'snap',
            goalsSlap: 'slap',
            goalsBackhand: 'backhand',
            goalsTipIn: 'tipIn',
            goalsDeflected: 'deflected',
            goalsWrapAround: 'wrapAround',
            shootingPct: 'shootingPct',
        },
    },
    discipline: {
        report: 'penalties',
        sort: 'penaltiesDrawn',
        fields: {
            penalties: 'taken',
            penaltiesDrawn: 'drawn',
            netPenalties: 'net',
            penaltyMinutes: 'pim',
            majorPenalties: 'majors',
            minorPenalties: 'minors',
        },
    },
};

const GOALIE_VIEWS = {
    advanced: {
        report: 'advanced',
        sort: 'qualityStartsPct',
        fields: {
            qualityStart: 'qualityStarts',
            qualityStartsPct: 'qualityStartPct',
            completeGames: 'completeGames',
            goalsAgainstAverage: 'gaa',
            savePct: 'savePct',
            shotsAgainstPer60: 'shotsAgainstPer60',
            regulationWins: 'regulationWins',
        },
    },
    rest: {
        report: 'daysrest',
        // Lajitellaan kokonaistorjuntaprosentilla, ei peräkkäisten otteluiden
        // luvulla: yhden ottelun otos antaa helposti 1,000:n ja nostaisi
        // sattuman kärkeen.
        sort: 'savePct',
        fields: {
            savePctDaysRest0: 'savePctB2B',
            savePctDaysRest1: 'savePct1Day',
            savePctDaysRest2: 'savePct2Days',
            savePctDaysRest3: 'savePct3Days',
            gamesPlayedDaysRest0: 'gamesB2B',
        },
    },
    strength: {
        report: 'savesByStrength',
        sort: 'evSavePct',
        fields: {
            evSavePct: 'evenStrength',
            ppSavePct: 'shortHanded',
            shSavePct: 'powerPlay',
            evShotsAgainst: 'evenShots',
        },
    },
};

const TEAM_VIEWS = {
    possession: {
        report: 'percentages',
        sort: 'satPct',
        fields: {
            satPct: 'corsiPct',
            usatPct: 'fenwickPct',
            shootingPct5v5: 'shootingPct5v5',
            savePct5v5: 'savePct5v5',
            shootingPlusSavePct5v5: 'pdo',
            zoneStartPct5v5: 'offensiveZoneStartPct',
        },
    },
    situational: {
        report: 'scoretrailfirst',
        sort: 'winPctScoringFirst',
        fields: {
            winPctScoringFirst: 'winPctScoringFirst',
            winPctTrailingFirst: 'winPctTrailingFirst',
            winsScoringFirst: 'winsScoringFirst',
            lossesTrailingFirst: 'lossesTrailingFirst',
        },
    },
    periods: {
        report: 'goalsbyperiod',
        sort: 'goalsFor',
        fields: {
            period1GoalsFor: 'p1For',
            period1GoalsAgainst: 'p1Against',
            period2GoalsFor: 'p2For',
            period2GoalsAgainst: 'p2Against',
            period3GoalsFor: 'p3For',
            period3GoalsAgainst: 'p3Against',
        },
    },
    physical: {
        report: 'realtime',
        sort: 'hits',
        fields: {
            hits: 'hits',
            blockedShots: 'blocks',
            takeaways: 'takeaways',
            giveaways: 'giveaways',
            hitsPer60: 'hitsPer60',
        },
    },
};

const VIEWS = { skater: SKATER_VIEWS, goalie: GOALIE_VIEWS, team: TEAM_VIEWS };

export const AVAILABLE_VIEWS = Object.fromEntries(
    Object.entries(VIEWS).map(([category, views]) => [category, Object.keys(views)]),
);

/** Nimikentät vaihtelevat kategorian mukaan. */
function identity(row, category) {
    if (category === 'team') {
        // Joukkueraportit palauttavat vain koko nimen, joten lyhenne johdetaan
        // siitä. Ilman tätä joukkuenäkymissä ei näy lainkaan lyhennettä.
        return { name: row.teamFullName, team: abbrevFromName(row.teamFullName) };
    }
    return {
        id: row.playerId,
        name: row.skaterFullName ?? row.goalieFullName,
        team: row.teamAbbrevs ? row.teamAbbrevs.split(',').pop().trim() : null,
        position: row.positionCode ?? (category === 'goalie' ? 'G' : null),
    };
}

/**
 * @param {'skater'|'goalie'|'team'} category
 * @param {string} view  esim. 'possession'
 * @param {object} options
 */
export async function getAdvancedStats(category, view, { limit = 50, minGames, season } = {}) {
    const config = VIEWS[category]?.[view];
    if (!config) {
        const err = new Error(`Tuntematon näkymä: ${category}/${view}`);
        err.status = 400;
        throw err;
    }

    const requested = season ?? getSeasonId();
    const cacheKey = `advanced:${category}:${view}:${requested}:${limit}:${minGames ?? ''}`;

    return getOrFetch(cacheKey, TTL.stats, async () => {
        const fetchSeason = async (s) => {
            // Edistyneet mittarit ovat kohinaisia pienellä otoksella, joten
            // mukaan otetaan vain riittävästi pelanneet.
            const minimum = minGames ?? (category === 'goalie' ? 10 : 20);

            // Polku on muotoa 'skater/puckPossessions' — kategoria kuuluu mukaan.
            const response = await stats(`${category}/${config.report}`, {
                limit,
                sort: [{ property: config.sort, direction: 'DESC' }],
                cayenneExp: `seasonId=${s} and gameTypeId=2`,
                factCayenneExp: category === 'team' ? undefined : `gamesPlayed>=${minimum}`,
            }).catch(() => null);

            return response?.data ?? [];
        };

        let rows = await fetchSeason(requested);
        let usedSeason = requested;
        let isPreviousSeason = false;

        if (rows.length === 0 && !season) {
            const previous = getPreviousSeasonId();
            rows = await fetchSeason(previous);
            if (rows.length > 0) {
                usedSeason = previous;
                isPreviousSeason = true;
            }
        }

        const entries = rows.map((row) => {
            const values = {};
            for (const [source, target] of Object.entries(config.fields)) {
                values[target] = row[source] ?? null;
            }
            return { ...identity(row, category), gamesPlayed: row.gamesPlayed ?? null, ...values };
        });

        return {
            category,
            view,
            season: usedSeason,
            isPreviousSeason,
            metrics: Object.values(config.fields),
            entries,
        };
    });
}
