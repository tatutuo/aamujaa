/**
 * Fantasy-pistelasku Hockey GM:n (hockeygm.fi) virallisen pistetaulukon mukaan.
 *
 * Säännöt ovat tarkoituksella tässä yhdessä tiedostossa eivätkä komponentin
 * sisällä, jotta taulukkoa voi verrata riveittäin alkuperäiseen. Kaikki
 * funktiot ovat puhtaita: sisään tilastot, ulos pisteet ja erittely.
 *
 * Pistetaulukko (maalivahti / puolustaja / hyökkääjä):
 *
 *   Voitto                4 / 0 / 0        Maali            25 / 9 / 7
 *   Tappio               -2 / 0 / 0        Syöttö           10 / 6 / 4
 *   Tappio jatkoajalla    1 / 0 / 0        Voittomaali       0 / 2 / 2
 *   Nollapeli            12 / 0 / 0        Alivoimamaali     0 / 4 / 4
 *   Plusmiinus            0 / +3,-2 / +2,-1  Alivoimasyöttö  0 / 2 / 2
 *                                          Jatkoaikamaali    0 / 3 / 3
 *
 *   Tähdet: 1. = 3 p, 2. = 2 p, 3. = 1 p (kaikille)
 *
 *   Jäähyt: 2 min: maalivahti −1, kenttäpelaaja +1. Tappelu (5 min) +2,
 *           muu 5 min −3, 10 min −5, pelirangaistus −8, ottelurangaistus −10.
 *           Vain henkilökohtaiset jäähyt; maalivahdilla enintään −10/ottelu.
 *
 *   Voittomaali annetaan myös pudotuspeleissä ja voittolaukauskilpailun
 *   ratkaisevasta maalista. Jatkoaikatappio on vain runkosarjassa (NHL merkitsee
 *   pudotuspeleissä maalivahdille aina W tai L, joten tämä hoituu itsestään).
 *
 * Lähde: hockeygm.fi/ohjeet (tarkistettu 29.9.2026).
 */

/** Kapteenin kerroin. Pisteet pyöristetään aina nollasta poispäin. */
export const CAPTAIN_MULTIPLIER = 1.3;

/**
 * Jäähytyyppien pistearvot.
 *
 * Kahden minuutin jäähy on taulukon ainoa rivi, jossa maalivahti ja
 * kenttäpelaaja eroavat: kenttäpelaaja saa siitä pisteen, maalivahti menettää
 * sellaisen. Sääntö on omalaatuinen, mutta näin se on Hockey GM:n taulukossa.
 */
const PENALTY_POINTS = {
    minor: { skater: 1, goalie: -1 },
    fightingMajor: { skater: 2, goalie: 2 },
    otherMajor: { skater: -3, goalie: -3 },
    misconduct: { skater: -5, goalie: -5 },
    gameMisconduct: { skater: -8, goalie: -8 },
    matchPenalty: { skater: -10, goalie: -10 },
};

/** Maalivahdin jäähypisteillä on kattonsa; kenttäpelaajalla ei ole. */
const GOALIE_PENALTY_FLOOR = -10;

const row = (key, count, points) => ({ key, count, points });

/**
 * Aloituspisteet voittojen ja häviöiden **erotuksesta**, ei prosentista.
 *
 * Sääntö: erotus 1–4 antaa 1 p, 5–8 antaa 2 p, 9–12 antaa 3 p ja niin edelleen
 * neljän välein, symmetrisesti myös miinukselle. Esimerkiksi 9 voittoa ja 3
 * häviötä on erotus 6, josta tulee 2 pistettä.
 *
 * Erotus hoitaa otoskoon itsestään: yhden aloituksen voittaneen erotus on 1,
 * mistä tulee 1 piste, kun taas 17/8 aloituksen erotus 9 antaa 3 pistettä.
 * Aiempi prosenttiin perustunut laskenta antoi molemmille saman tuloksen.
 */
export function faceoffPoints(wins, losses) {
    const diff = (wins ?? 0) - (losses ?? 0);
    if (diff === 0) return 0;
    return Math.sign(diff) * Math.ceil(Math.abs(diff) / 4);
}

/** Laukaukset maalia kohti, blokatut laukaukset ja taklaukset: 2 suoritusta = 1 p. */
export function shotBlockHitPoints(total) {
    return total > 0 ? Math.ceil(total / 2) : 0;
}

/** Tähtipisteet: 1. tähti 3 p, 2. tähti 2 p, 3. tähti 1 p. */
export function starPoints(rank) {
    if (rank === 1) return 3;
    if (rank === 2) return 2;
    if (rank === 3) return 1;
    return 0;
}

/**
 * Maalivahdin torjuntapisteet.
 *
 * 1–4 torjuntaa antaa 1 p. Siitä 34:ään asti pisteet kasvavat kahdella joka
 * viides torjunta (5–9 = 3, 10–14 = 5, … 30–34 = 13).35:stä ylöspäin porras
 * kasvaa kolmeen (35–39 = 16, 40–44 = 19, …).
 */
export function savePoints(saves) {
    if (saves <= 0) return 0;
    if (saves <= 4) return 1;
    if (saves <= 34) return 3 + Math.floor((saves - 5) / 5) * 2;
    return 16 + Math.floor((saves - 35) / 5) * 3;
}

/** Päästetyt maalit: neljään asti −1 kappaleelta, viidennestä alkaen −2. */
export function goalsAgainstPoints(goalsAgainst) {
    if (goalsAgainst <= 0) return 0;
    if (goalsAgainst <= 4) return -goalsAgainst;
    return -(4 + (goalsAgainst - 4) * 2);
}

/**
 * Jäähypisteet tyypeittäin.
 * @param {object} penalties  { minor, fightingMajor, otherMajor, misconduct, gameMisconduct, matchPenalty }
 * @param {boolean} isGoalie  maalivahdilla pisteillä on −10 katto
 */
export function penaltyPoints(penalties, isGoalie = false) {
    let points = 0;
    for (const [key, value] of Object.entries(PENALTY_POINTS)) {
        points += (penalties?.[key] ?? 0) * (isGoalie ? value.goalie : value.skater);
    }
    return isGoalie ? Math.max(GOALIE_PENALTY_FLOOR, points) : points;
}

/** Jäähyjen yhteismäärä erittelyn otsikkoon. */
const penaltyCount = (penalties) =>
    Object.keys(PENALTY_POINTS).reduce((sum, key) => sum + (penalties?.[key] ?? 0), 0);

/**
 * Kapteenin kerroin: pisteet kerrotaan 1,3:lla ja pyöristetään nollasta
 * poispäin — plussat ylös (8 × 1,3 = 10,4 → 11), miinukset alas
 * (−7 × 1,3 = −9,1 → −10).
 */
export function applyCaptain(points, isCaptain) {
    if (!isCaptain) return points;
    const scaled = points * CAPTAIN_MULTIPLIER;
    return scaled >= 0 ? Math.ceil(scaled) : Math.floor(scaled);
}

/**
 * Kenttäpelaajan pisteet.
 *
 * @param {object} stats
 * @param {'C'|'L'|'R'|'D'} stats.position
 */
export function scoreSkater(stats) {
    const {
        position = 'C',
        goals = 0,
        assists = 0,
        plusMinus = 0,
        sog = 0,
        hits = 0,
        blockedShots = 0,
        shorthandedGoals = 0,
        shorthandedAssists = 0,
        overtimeGoals = 0,
        gameWinningGoals = 0,
        faceoffWins = 0,
        faceoffLosses = 0,
        penalties = null,
        starRank = null,
        isCaptain = false,
    } = stats;

    const isDefence = position === 'D';
    const breakdown = [];
    let total = 0;

    const add = (key, count, points) => {
        total += points;
        breakdown.push(row(key, count, points));
    };

    add('goals', goals, goals * (isDefence ? 9 : 7));
    add('assists', assists, assists * (isDefence ? 6 : 4));

    /*
     * Jatkoaikamaali sisältää jo voittomaalin osuuden, joten samasta maalista
     * ei anneta molempia. Voittomaali pisteytetään myös pudotuspeleissä.
     */
    const winnersNotInOvertime = Math.max(0, gameWinningGoals - overtimeGoals);
    add('gameWinner', winnersNotInOvertime, winnersNotInOvertime * 2);
    add('overtimeGoal', overtimeGoals, overtimeGoals * 3);

    add('shorthandedGoal', shorthandedGoals, shorthandedGoals * 4);
    add('shorthandedAssist', shorthandedAssists, shorthandedAssists * 2);

    add('plusMinus', plusMinus > 0 ? `+${plusMinus}` : plusMinus,
        plusMinus > 0
            ? plusMinus * (isDefence ? 3 : 2)
            : plusMinus * (isDefence ? 2 : 1));

    const sbh = sog + hits + blockedShots;
    add('sbh', sbh, shotBlockHitPoints(sbh));

    const faceoffTotal = faceoffWins + faceoffLosses;
    if (faceoffTotal > 0) {
        add('faceoffs', `${faceoffWins}-${faceoffLosses}`, faceoffPoints(faceoffWins, faceoffLosses));
    }

    if (penaltyCount(penalties) > 0) {
        add('penalties', penaltyCount(penalties), penaltyPoints(penalties, false));
    }

    add('star', starRank, starPoints(starRank));

    return { total: applyCaptain(total, isCaptain), rawTotal: total, isCaptain, breakdown };
}

/**
 * Maalivahdin pisteet.
 *
 * Maalivahdin maalit ja syötöt eivät ole NHL:n boxscoren maalivahtirivillä,
 * joten palvelin laskee ne ottelun maalitapahtumista (eventGoals,
 * eventAssists). Suurempi luku voittaa, jos kumpikin on annettu.
 *
 * @param {boolean} stats.fullGame  pelasiko vahti koko ottelun (nollapelin ehto)
 */
export function scoreGoalie(stats) {
    const {
        goals: boxGoals = 0,
        assists: boxAssists = 0,
        eventGoals = 0,
        eventAssists = 0,
        fullGame = true,
        saves = 0,
        goalsAgainst = 0,
        decision = '',
        penalties = null,
        starRank = null,
        isCaptain = false,
    } = stats;

    const goals = Math.max(boxGoals ?? 0, eventGoals ?? 0);
    const assists = Math.max(boxAssists ?? 0, eventAssists ?? 0);

    const breakdown = [];
    let total = 0;

    const add = (key, count, points) => {
        total += points;
        breakdown.push(row(key, count, points));
    };

    add('goals', goals, goals * 25);
    add('assists', assists, assists * 10);

    if (decision === 'W') add('win', decision, 4);
    else if (decision === 'L') add('loss', decision, -2);
    else if (decision === 'O' || decision === 'OTL') add('otLoss', decision, 1);

    /*
     * Nollapeli kuten NHL:n tilastoissa: voitto, ei päästettyjä maaleja ja koko
     * ottelu samalla vahdilla. Jaettu nollapeli ei ole kummankaan vahdin.
     * Voittolaukauskilpailun maalit eivät ole päästettyjä maaleja.
     */
    if (decision === 'W' && goalsAgainst === 0 && fullGame) add('shutout', 1, 12);

    add('saves', saves, savePoints(saves));
    add('goalsAgainst', goalsAgainst, goalsAgainstPoints(goalsAgainst));

    if (penaltyCount(penalties) > 0) {
        add('penalties', penaltyCount(penalties), penaltyPoints(penalties, true));
    }

    add('star', starRank, starPoints(starRank));

    return { total: applyCaptain(total, isCaptain), rawTotal: total, isCaptain, breakdown };
}
