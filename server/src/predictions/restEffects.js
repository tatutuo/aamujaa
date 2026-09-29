import { stats } from '../lib/nhlApi.js';
import { getOrFetch, TTL } from '../lib/cache.js';
import { shrinkRate } from './math.js';

/**
 * Lepopäivien vaikutus mitattuna, ei arvattuna.
 *
 * Malli käytti aiemmin käsin valittuja kertoimia: peräkkäisinä päivinä
 * hyökkäys × 0,96 ja puolustus × 1,05. Luvut olivat valistuneita arvauksia.
 *
 * NHL:n `team/daysbetweengames` kertoo toteutuneet maaliluvut lepopäivien
 * mukaan, joten kertoimet voi laskea datasta. Kolmelta kaudelta (2023–26)
 * mitattuna ja kutistettuna:
 *
 *   lepopäiviä | otteluita | hyökkäys | puolustus
 *       0      |   1187    |  0,947   |  1,028
 *       1      |   4589    |  1,010   |  1,003
 *       2      |   1463    |  1,004   |  0,972
 *       3      |    326    |  1,029   |  1,006
 *       4+     |    307    |  1,012   |  0,978
 *
 * Peräkkäisten päivien hyökkäysvaikutus (0,947) osui lähelle arvausta, mutta
 * puolustusvaikutus (1,028) on selvästi pienempi kuin oletettu 1,05 — malli
 * siis yliarvioi väsymyksen merkitystä puolustuspäässä.
 *
 * Harvinaiset luokat perustuvat muutamaan sataan otteluun, joten kaikki
 * kertoimet kutistetaan kohti neutraalia otoskoon mukaan — samalla
 * periaatteella kuin joukkueiden voimaluvut.
 */

/**
 * Kuinka monen ottelun verran "ei vaikutusta" -oletus painaa.
 *
 * 200 valittu niin, että suuret luokat säilyvät lähes ennallaan (peräkkäisiä
 * otteluita on kolmelta kaudelta yli 1200, jolloin havainto saa yli 85 %:n
 * painon) mutta harvinaiset luokat vetäytyvät neutraaliin. Ilman kutistusta
 * kolmen lepopäivän luokka — muutama sata ottelua — antaisi epäuskottavan
 * suuren hyökkäysbonuksen.
 */
const PRIOR_GAMES = 200;

/** Yli tämän menevät lepopäivät niputetaan yhteen, kuten rajapinnassakin. */
const MAX_REST_DAYS = 4;

const NEUTRAL = { attack: 1, defence: 1, games: 0, measured: false };

/**
 * @returns {Promise<Map<number, {attack:number, defence:number, games:number}>>}
 */
export async function getRestEffects(season) {
    return getOrFetch(`resteffects:${season}`, TTL.stats, async () => {
        // Kolme kautta yhdessä: yhden kauden otos jää harvinaisissa
        // lepopäiväluokissa muutamaan kymmeneen otteluun. Lepovaikutus ei
        // muutu kaudesta toiseen, joten historian käyttäminen on perusteltua.
        const startSeason = String(Number(season) - 20002);

        const response = await stats('team/daysbetweengames', {
            limit: -1,
            cayenneExp: `seasonId>=${startSeason} and seasonId<=${season} and gameTypeId=2`,
        }).catch(() => null);

        const rows = response?.data ?? [];
        if (rows.length === 0) return new Map();

        // Kootaan koko liigan luvut lepopäivien mukaan.
        const buckets = new Map();
        let leagueGames = 0;
        let leagueGoalsFor = 0;
        let leagueGoalsAgainst = 0;

        for (const row of rows) {
            const days = Math.min(row.daysRest ?? 1, MAX_REST_DAYS);
            const games = row.gamesPlayed ?? 0;
            if (games === 0) continue;

            const goalsFor = (row.goalsForPerGame ?? 0) * games;
            const goalsAgainst = (row.goalsAgainstPerGame ?? 0) * games;

            const bucket = buckets.get(days) ?? { games: 0, goalsFor: 0, goalsAgainst: 0 };
            bucket.games += games;
            bucket.goalsFor += goalsFor;
            bucket.goalsAgainst += goalsAgainst;
            buckets.set(days, bucket);

            leagueGames += games;
            leagueGoalsFor += goalsFor;
            leagueGoalsAgainst += goalsAgainst;
        }

        if (leagueGames === 0) return new Map();

        const leagueAttack = leagueGoalsFor / leagueGames;
        const leagueDefence = leagueGoalsAgainst / leagueGames;

        const effects = new Map();

        for (const [days, bucket] of buckets) {
            // Kutistus kohti liigan keskiarvoa: pieni otos ei saa heilauttaa
            // kerrointa. 78 ottelun "kolme lepopäivää" vetäytyy lähelle ykköstä.
            const attackRate = shrinkRate(bucket.goalsFor, bucket.games, leagueAttack, PRIOR_GAMES);
            const defenceRate = shrinkRate(bucket.goalsAgainst, bucket.games, leagueDefence, PRIOR_GAMES);

            effects.set(days, {
                attack: attackRate / leagueAttack,
                defence: defenceRate / leagueDefence,
                games: bucket.games,
                measured: true,
            });
        }

        return effects;
    });
}

/**
 * Kertoimet yhdelle joukkueelle. Palauttaa neutraalin, jos lepopäiviä ei
 * tiedetä tai mittausdataa ei saatu.
 */
export function restMultipliers(effects, daysRest) {
    if (!effects || daysRest === null || daysRest === undefined) return NEUTRAL;
    return effects.get(Math.min(daysRest, MAX_REST_DAYS)) ?? NEUTRAL;
}

export const REST_MODEL = { PRIOR_GAMES, MAX_REST_DAYS };
