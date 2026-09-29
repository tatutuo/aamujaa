import { stats } from '../lib/nhlApi.js';
import { shrinkRate } from './math.js';

/**
 * Joukkueiden hyökkäys- ja puolustusvoima.
 *
 * Keskeinen ero vanhaan malliin: voima lasketaan **laukauksista ja maaleista
 * erikseen**, ei pelkistä maaleista.
 *
 * Miksi: laukausmäärä vakiintuu paljon nopeammin kuin maalimäärä. Joukkueen
 * maalintekoprosentti heittelee kauden mittaan rajusti, ja lyhyellä aikavälillä
 * suuri osa siitä on onnea. Kun ennuste rakennetaan laukausvolyymin päälle ja
 * maalintekoprosentti vedetään kohti liigan keskiarvoa, malli ei enää usko
 * kymmenen ottelun kuumaan kauteen.
 *
 * Kaikki suhdeluvut kutistetaan lisäksi kohti liigan keskiarvoa otteluiden
 * määrän mukaan, mikä tekee mallista käyttökelpoisen heti kauden alusta.
 */

const MODEL = {
    /** Kuinka monen "keskiverto-ottelun" verran ennakko-oletus painaa. */
    priorGames: 14,
    /** Maalintekoprosentti kutistetaan voimakkaasti: se on kohinaisin osa. */
    shootingPriorShots: 450,
    /** Maalivahdin torjuntaprosentin kutistus laukausmäärän mukaan. */
    goaliePriorShots: 900,
};

/**
 * @typedef {object} LeagueBaseline
 * @property {number} goalsPerGame       maalia per joukkue per ottelu
 * @property {number} shotsPerGame       laukausta per joukkue per ottelu
 * @property {number} shootingPct        maalintekoprosentti
 * @property {number} savePct            torjuntaprosentti
 */

/** Laskee liigan keskitason annetusta joukkueaineistosta. */
export function computeLeagueBaseline(teams) {
    let games = 0;
    let goals = 0;
    let shots = 0;

    for (const team of teams) {
        const gp = team.gamesPlayed ?? 0;
        if (gp === 0) continue;
        games += gp;
        goals += team.goalsFor ?? 0;
        shots += (team.shotsForPerGame ?? 0) * gp;
    }

    if (games === 0) {
        // Kauden ensimmäinen päivä: käytetään historiallisia tyypillisiä arvoja.
        return { goalsPerGame: 3.05, shotsPerGame: 29.0, shootingPct: 0.105, savePct: 0.895 };
    }

    const goalsPerGame = goals / games;
    const shotsPerGame = shots / games;
    const shootingPct = shotsPerGame > 0 ? goalsPerGame / shotsPerGame : 0.105;

    return {
        goalsPerGame,
        shotsPerGame,
        shootingPct,
        savePct: 1 - shootingPct,
    };
}

/**
 * Yhden joukkueen voimaluvut suhteessa liigan keskitasoon.
 * Arvo 1.0 tarkoittaa keskiverto­joukkuetta.
 */
/**
 * Corsin paino laukausvoimassa.
 *
 * Corsi (kaikki laukausyritykset, myös blokatut ja ohi menneet) mittaa
 * kiekonhallintaa laajemmin kuin maalille asti päässeet laukaukset. Painotus
 * on maltillinen, koska maalille päässyt laukaus on silti lähempänä
 * maalintekoa kuin blokattu yritys.
 */
const CORSI_WEIGHT = Number(process.env.CORSI_WEIGHT ?? 0.35);

/**
 * Corsin paino kasvaa otoskoon mukana.
 *
 * Kymmenen ottelun Corsi on lähes yhtä kohinaista kuin kymmenen ottelun
 * maalimäärä, joten sitä ei saa uskoa täydellä painolla lokakuussa. Sama
 * periaate kuin muuallakin mallissa: mitä enemmän havaintoja, sitä enemmän
 * painoa.
 */
const CORSI_PRIOR_GAMES = 15;

export function computeTeamStrength(team, league, corsi) {
    const gp = team.gamesPlayed ?? 0;

    const shotsFor = shrinkRate(
        (team.shotsForPerGame ?? league.shotsPerGame) * gp,
        gp,
        league.shotsPerGame,
        MODEL.priorGames,
    );

    const shotsAgainst = shrinkRate(
        (team.shotsAgainstPerGame ?? league.shotsPerGame) * gp,
        gp,
        league.shotsPerGame,
        MODEL.priorGames,
    );

    // Maalintekoprosentti kutistetaan laukausmäärän mukaan, ei ottelumäärän:
    // 10 ottelua on ~290 laukausta, mikä on yhä hyvin pieni otos.
    const totalShots = (team.shotsForPerGame ?? 0) * gp;
    const shootingPct = shrinkRate(
        team.goalsFor ?? 0,
        totalShots,
        league.shootingPct,
        MODEL.shootingPriorShots,
    );

    const totalShotsAgainst = (team.shotsAgainstPerGame ?? 0) * gp;
    const savePct = 1 - shrinkRate(
        team.goalsAgainst ?? 0,
        totalShotsAgainst,
        1 - league.savePct,
        MODEL.shootingPriorShots,
    );

    // Laukausvoima blendataan Corsin kanssa, jos se on saatavilla.
    // Corsi on osuus (0,5 = tasan), joten se muunnetaan suhdeluvuksi.
    const shotGenerationRaw = shotsFor / league.shotsPerGame;
    const shotSuppressionRaw = league.shotsPerGame / shotsAgainst;

    const corsiRatio = corsi ? corsi / 0.5 : null;
    const corsiWeight = CORSI_WEIGHT * (gp / (gp + CORSI_PRIOR_GAMES));

    const blend = (raw) => (corsiRatio === null
        ? raw
        : raw * (1 - corsiWeight) + corsiRatio * corsiWeight);

    return {
        abbrev: team.abbrev,
        gamesPlayed: gp,
        // Suhdeluvut: >1 tarkoittaa keskitasoa parempaa
        shotGeneration: blend(shotGenerationRaw),
        shotSuppression: blend(shotSuppressionRaw),
        corsiPct: corsi ?? null,
        finishing: shootingPct / league.shootingPct,
        goaltending: savePct / league.savePct,
        // Erikoistilanteet suoraan rajapinnasta (jo valmiiksi osuuksia)
        powerPlayPct: team.powerPlayPct ?? 0.2,
        penaltyKillPct: team.penaltyKillPct ?? 0.8,
    };
}

/**
 * Maalivahdin torjuntaprosentti kutistettuna kohdattujen laukausten mukaan.
 *
 * Vanha malli käytti kauden torjuntaprosenttia sellaisenaan ja kertoi eron
 * liigan keskiarvoon vakiolla 8. Luku oli mielivaltainen: se aliarvioi
 * maalivahdin vaikutuksen noin nelinkertaisesti, koska oikea mittakaava on
 * kohdattujen laukausten määrä (~29 per ottelu), ei kahdeksan.
 */
export function regressedSavePct(goalie, leagueSavePct) {
    const shotsAgainst = goalie.shotsAgainst ?? 0;
    const saves = goalie.saves ?? Math.round(shotsAgainst * (goalie.savePct ?? leagueSavePct));

    return shrinkRate(saves, shotsAgainst, leagueSavePct, MODEL.goaliePriorShots);
}

/**
 * Hakee joukkuetilastot kaudelle.
 *
 * @param {string} season
 * @param {string} [beforeDate] YYYY-MM-DD. Mukaan otetaan vain tätä ennen
 *   pelatut ottelut. Tuotannossa tämä on ennustepäivä: aamulla laskettava
 *   ennuste ei saa nähdä saman illan tuloksia. Takautuvassa testauksessa sama
 *   rajaus estää tulevan datan vuotamisen ja tekee tuloksesta rehellisen.
 */
export async function fetchTeamStats(season, beforeDate) {
    let cayenneExp = `seasonId=${season} and gameTypeId=2`;
    if (beforeDate) cayenneExp += ` and gameDate<"${beforeDate}"`;

    const response = await stats('team/summary', { limit: -1, cayenneExp });
    return response?.data ?? [];
}

/**
 * Corsi joukkueittain.
 *
 * Erillinen raportti, koska `team/summary` sisältää vain maalille päässeet
 * laukaukset — ei blokattuja eikä ohi menneitä yrityksiä.
 *
 * @param {string} season
 * @param {string} [beforeDate] sama rajaus kuin fetchTeamStats
 */
export async function fetchTeamCorsi(season, beforeDate) {
    let cayenneExp = `seasonId=${season} and gameTypeId=2`;
    if (beforeDate) cayenneExp += ` and gameDate<"${beforeDate}"`;

    const response = await stats('team/percentages', { limit: -1, cayenneExp }).catch(() => null);

    const byName = new Map();
    for (const row of response?.data ?? []) {
        if (row.satPct != null) byName.set(row.teamFullName, row.satPct);
    }
    return byName;
}

export const STRENGTH_MODEL = MODEL;
