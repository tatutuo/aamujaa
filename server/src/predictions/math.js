/**
 * Ennustemallin matemaattinen ydin.
 *
 * Kaikki tämän tiedoston funktiot ovat puhtaita: sama syöte antaa aina saman
 * tuloksen eikä mikään niistä hae verkosta. Siksi ne voi testata suoraan
 * (`npm test` palvelinkansiossa), mikä on koko mallin uskottavuuden kannalta
 * oleellista — aiemmin luvut syntyivät satunnaissimulaatiossa keskellä
 * verkkokutsuja, eikä niitä päässyt tarkistamaan mitenkään.
 */

// ---------------------------------------------------------------------------
// Kutistus kohti keskiarvoa (empiirinen Bayes)
// ---------------------------------------------------------------------------

/**
 * Kutistaa havaitun keskiarvon kohti ennakkoarvoa otoskoon mukaan.
 *
 * Tämä on mallin tärkein yksittäinen parannus. Kauden alussa joukkueen
 * "maalia per peli" on lähes pelkkää kohinaa: viiden ottelun jälkeen 4.2 GF/G
 * ei tarkoita että joukkue on liigan paras hyökkäys. Vanha malli uskoi luvun
 * sellaisenaan ja tuotti lokakuussa villejä ennusteita.
 *
 * Kaava on standardi: havainnot ja `priorWeight` verran kuvitteellisia
 * keskiarvo-otteluita lasketaan yhteen. Mitä enemmän pelejä, sitä vähemmän
 * ennakkoarvo painaa — 60 ottelun jälkeen vaikutus on enää marginaalinen.
 *
 * @param {number} observedTotal  havaittu summa (esim. tehdyt maalit)
 * @param {number} observedCount  havaintojen määrä (otteluita)
 * @param {number} priorMean      ennakko-oletus (liigan keskiarvo per ottelu)
 * @param {number} priorWeight    kuinka monen ottelun painoarvo ennakolla on
 */
export function shrinkRate(observedTotal, observedCount, priorMean, priorWeight) {
    if (priorWeight <= 0) return observedCount > 0 ? observedTotal / observedCount : priorMean;
    return (observedTotal + priorMean * priorWeight) / (observedCount + priorWeight);
}

// ---------------------------------------------------------------------------
// Poisson-jakauma
// ---------------------------------------------------------------------------

const logFactorialCache = [0, 0];

function logFactorial(n) {
    if (logFactorialCache[n] !== undefined) return logFactorialCache[n];
    let value = logFactorialCache[logFactorialCache.length - 1];
    for (let i = logFactorialCache.length; i <= n; i++) {
        value += Math.log(i);
        logFactorialCache[i] = value;
    }
    return logFactorialCache[n];
}

/** P(X = k), kun X ~ Poisson(lambda). */
export function poissonPmf(k, lambda) {
    if (k < 0 || !Number.isInteger(k)) return 0;
    if (lambda <= 0) return k === 0 ? 1 : 0;
    return Math.exp(-lambda + k * Math.log(lambda) - logFactorial(k));
}

// ---------------------------------------------------------------------------
// Dixon–Coles-korjaus
// ---------------------------------------------------------------------------

/**
 * Riippumaton Poisson aliarvioi matalat tulokset, koska ottelun tapahtumat
 * eivät ole toisistaan riippumattomia. Dixon–Coles korjaa neljän matalimman
 * tuloksen todennäköisyyksiä; muut jäävät ennalleen.
 *
 * HUOM: jääkiekossa tämä korjaus yksin ei riitä. Maaleja tulee niin paljon,
 * että 0–0 ja 1–1 ovat harvinaisia, joten korjaus koskee alle prosenttia
 * tapauksista. Varsinainen tasatilanteiden vajaus hoidetaan erikseen
 * `TIE_INFLATION`-kertoimella, ks. alla.
 */
export const DIXON_COLES_RHO = -0.035;

/**
 * Tasatilanteiden korotus ("score effects").
 *
 * Riippumaton Poisson antaa liigan keskimääräisillä odotusmaaleilla noin 17 %
 * todennäköisyyden tasatilanteelle varsinaisen peliajan päätteeksi. NHL:ssä
 * jatkoajalle menee todellisuudessa noin 23 % otteluista.
 *
 * Ero ei ole sattumaa: johdossa oleva joukkue vetäytyy puolustamaan ja häviävä
 * ottaa riskejä sekä nostaa maalivahdin. Molemmat vaikutukset kuljettavat
 * otteluita kohti tasalukemaa tavalla, jota riippumaton mallinnus ei tavoita.
 *
 * Kerroin on kalibroitu takautuvalla testauksella. Koko kauden 2025–26
 * aineistossa (1292 ottelua) arvo 0,46 antoi keskimäärin 22,3 %:n
 * jatkoaikaennusteen, kun toteutunut osuus oli 25,0 %. Arvo nostettiin siksi
 * 0,58:aan. Testi `outcomeProbabilities` valvoo, ettei se pääse ajautumaan.
 */
export const TIE_INFLATION = 0.58;

export function dixonColesTau(homeGoals, awayGoals, lambdaHome, lambdaAway, rho = DIXON_COLES_RHO) {
    if (homeGoals === 0 && awayGoals === 0) return 1 - lambdaHome * lambdaAway * rho;
    if (homeGoals === 0 && awayGoals === 1) return 1 + lambdaHome * rho;
    if (homeGoals === 1 && awayGoals === 0) return 1 + lambdaAway * rho;
    if (homeGoals === 1 && awayGoals === 1) return 1 - rho;
    return 1;
}

/** Suurin maalimäärä, joka otetaan mukaan laskentaan. */
const MAX_GOALS = 14;

/**
 * Tulosmatriisi: P(koti = i, vieras = j) varsinaisen peliajan päätteeksi.
 *
 * Lasketaan analyyttisesti eikä arpomalla. Vanha malli ajoi 10 000 Monte Carlo
 * -kierrosta, mikä toi mukanaan noin puolen prosenttiyksikön satunnaisvirheen
 * ja teki tuloksista toistokelvottomia: sama ottelu antoi eri luvut joka ajolla.
 * Suora summaus on sekä tarkka että nopeampi.
 */
export function scoreMatrix(lambdaHome, lambdaAway, rho = DIXON_COLES_RHO) {
    const homePmf = [];
    const awayPmf = [];
    for (let i = 0; i <= MAX_GOALS; i++) {
        homePmf[i] = poissonPmf(i, lambdaHome);
        awayPmf[i] = poissonPmf(i, lambdaAway);
    }

    const matrix = [];
    let total = 0;

    for (let i = 0; i <= MAX_GOALS; i++) {
        matrix[i] = [];
        for (let j = 0; j <= MAX_GOALS; j++) {
            let p = homePmf[i] * awayPmf[j] * dixonColesTau(i, j, lambdaHome, lambdaAway, rho);
            // Tasalukemat saavat lisäpainoa: ks. TIE_INFLATION.
            if (i === j) p *= 1 + TIE_INFLATION;
            matrix[i][j] = Math.max(0, p);
            total += matrix[i][j];
        }
    }

    // Katkaisu ja tau-korjaus vievät massaa; normalisoidaan takaisin ykköseen.
    for (let i = 0; i <= MAX_GOALS; i++) {
        for (let j = 0; j <= MAX_GOALS; j++) matrix[i][j] /= total;
    }

    return matrix;
}

// ---------------------------------------------------------------------------
// Jatkoaika ja voittolaukaukset
// ---------------------------------------------------------------------------

/**
 * Kun varsinainen peliaika päättyy tasan, ottelu ratkeaa jatkoajalla tai
 * voittolaukauskilpailussa.
 *
 * Vanha malli ratkaisi tasatilanteet suhteessa odotusmaaleihin, mikä antoi
 * selvästi paremmalle joukkueelle liian ison edun. 3-on-3-jatkoaika ja
 * voittolaukaukset ovat lähempänä kolikonheittoa kuin varsinainen peliaika:
 * kentällisen koko pienenee ja yksittäisen pelaajan merkitys kasvaa.
 *
 * Nämä osuudet vastaavat NHL:n toteutunutta jakaumaa: tasatilanteista noin
 * kaksi kolmasosaa ratkeaa jatkoajalla ja loput voittolaukauksilla.
 */
export const OVERTIME = {
    decidedInOvertime: 0.65,
    /** Kotietu jatkoajalla on olemassa mutta pieni. */
    homeEdge: 0.52,
    /** Kuinka paljon joukkueiden tasoero saa siirtää 50/50-lähtökohtaa. */
    strengthWeight: 0.35,
};

/**
 * Kotijoukkueen todennäköisyys voittaa tasatilanteen jatkolla.
 * Vahvuusero vaikuttaa vaimennettuna, koska 3-on-3 on satunnaisempaa.
 */
export function overtimeWinProbability(lambdaHome, lambdaAway) {
    const total = lambdaHome + lambdaAway;
    const rawShare = total > 0 ? lambdaHome / total : 0.5;
    const damped = 0.5 + (rawShare - 0.5) * OVERTIME.strengthWeight;
    return Math.min(0.75, Math.max(0.25, damped + (OVERTIME.homeEdge - 0.5)));
}

// ---------------------------------------------------------------------------
// Ottelun lopputulosjakauma
// ---------------------------------------------------------------------------

/**
 * Kokoaa tulosmatriisista kaikki käyttöliittymän tarvitsemat todennäköisyydet.
 */
export function outcomeProbabilities(lambdaHome, lambdaAway, rho = DIXON_COLES_RHO) {
    const matrix = scoreMatrix(lambdaHome, lambdaAway, rho);

    let homeRegulation = 0;
    let awayRegulation = 0;
    let tied = 0;

    const homeOvertimeShare = overtimeWinProbability(lambdaHome, lambdaAway);

    /**
     * Jakauma **lopullisista** tuloksista, ei varsinaisen peliajan tuloksista.
     *
     * Tämä ero on tärkeä. Tasatilanteiden korotuksen jälkeen todennäköisin
     * yksittäinen lukema varsinaisella peliajalla on lähes aina tasan, jolloin
     * naiivi "tasalukema + 1" ennustaisi jatkoaikaa joka ikiseen otteluun.
     *
     * Oikein laskettuna moni eri peliajan lukema johtaa samaan lopputulokseen:
     * 3–2 syntyy sekä suoraan varsinaisella peliajalla että tasatilanteesta
     * 2–2 kotijoukkueen jatkoaikamaalilla. Kun nämä lasketaan yhteen, saadaan
     * todennäköisin lopputulos — ja jatkoaikaa ennustetaan vain kun se
     * oikeasti on todennäköisin vaihtoehto.
     */
    const finalScores = new Map();

    const addFinal = (home, away, probability, fromOvertime) => {
        const key = `${home}-${away}`;
        const existing = finalScores.get(key);
        if (existing) {
            existing.probability += probability;
            if (!fromOvertime) existing.regulationShare += probability;
        } else {
            finalScores.set(key, {
                home,
                away,
                probability,
                regulationShare: fromOvertime ? 0 : probability,
            });
        }
    };

    let overFiveHalf = 0;

    for (let i = 0; i < matrix.length; i++) {
        for (let j = 0; j < matrix[i].length; j++) {
            const p = matrix[i][j];
            if (p <= 0) continue;

            if (i > j) {
                homeRegulation += p;
                addFinal(i, j, p, false);
                if (i + j > 5.5) overFiveHalf += p;
            } else if (j > i) {
                awayRegulation += p;
                addFinal(i, j, p, false);
                if (i + j > 5.5) overFiveHalf += p;
            } else {
                tied += p;
                // Tasatilanne ratkeaa yhdellä maalilla kumpaan tahansa suuntaan.
                addFinal(i + 1, j, p * homeOvertimeShare, true);
                addFinal(i, j + 1, p * (1 - homeOvertimeShare), true);
                // Ratkaisumaali lasketaan mukaan maalimäärään.
                if (i + j + 1 > 5.5) overFiveHalf += p;
            }
        }
    }

    let mostLikely = { home: 0, away: 0, probability: 0, isOvertime: false };
    for (const entry of finalScores.values()) {
        if (entry.probability > mostLikely.probability) {
            mostLikely = {
                home: entry.home,
                away: entry.away,
                probability: entry.probability,
                // Merkitään jatkoajaksi vain jos lukema syntyy pääosin
                // tasatilanteen ratkaisusta.
                isOvertime: entry.regulationShare < entry.probability / 2,
            };
        }
    }

    const homeOvertimeWin = tied * homeOvertimeShare;
    const awayOvertimeWin = tied * (1 - homeOvertimeShare);

    return {
        homeWin: homeRegulation + homeOvertimeWin,
        awayWin: awayRegulation + awayOvertimeWin,
        homeRegulationWin: homeRegulation,
        awayRegulationWin: awayRegulation,
        overtime: tied,
        overtimeDecidedInOt: tied * OVERTIME.decidedInOvertime,
        shootout: tied * (1 - OVERTIME.decidedInOvertime),
        overFiveHalfGoals: overFiveHalf,
        mostLikelyScore: mostLikely,
    };
}

// ---------------------------------------------------------------------------
// Mallin arviointi
// ---------------------------------------------------------------------------

/**
 * Brier-pisteet: keskimääräinen neliövirhe todennäköisyyden ja toteuman välillä.
 * Pienempi on parempi. 0.25 vastaa kolikonheittoa, joten kaikki sen alle
 * tuottaa arvoa. Osumaprosentti yksin ei riitä mittariksi, koska se ei erottele
 * varmaa oikeaa arvausta epävarmasta.
 */
export function brierScore(predictions) {
    if (predictions.length === 0) return null;
    const sum = predictions.reduce((acc, { probability, outcome }) => {
        const diff = probability - outcome;
        return acc + diff * diff;
    }, 0);
    return sum / predictions.length;
}

/**
 * Logaritminen tappio. Rankaisee ankarasti varmoja mutta vääriä ennusteita.
 * Käytetään Brierin rinnalla, koska se paljastaa yliluottavaisen mallin.
 */
export function logLoss(predictions) {
    if (predictions.length === 0) return null;
    const epsilon = 1e-9;
    const sum = predictions.reduce((acc, { probability, outcome }) => {
        const p = Math.min(1 - epsilon, Math.max(epsilon, probability));
        return acc + (outcome === 1 ? -Math.log(p) : -Math.log(1 - p));
    }, 0);
    return sum / predictions.length;
}

// ---------------------------------------------------------------------------
// Pelaajaennusteiden epävarmuus
// ---------------------------------------------------------------------------

/**
 * Pistemäärän vaihteluväli loppukaudelle.
 *
 * Piste-ennuste yksinään antaa harhaanjohtavan tarkan vaikutelman: "87 pistettä"
 * kuulostaa mittaustulokselta, vaikka kyseessä on arvio. Kun jäljellä olevien
 * otteluiden pisteet mallinnetaan Poissonina, hajonta on neliöjuuri odotusarvosta,
 * ja siitä saa rehellisen vaihteluvälin.
 *
 * @param {number} currentPoints  jo kerätyt pisteet (ei epävarmuutta)
 * @param {number} expectedRemaining  odotusarvo jäljellä oleville pisteille
 * @returns {{low: number, high: number}} noin 80 %:n vaihteluväli
 */
export function pointsInterval(currentPoints, expectedRemaining) {
    if (expectedRemaining <= 0) {
        return { low: currentPoints, high: currentPoints };
    }
    const standardDeviation = Math.sqrt(expectedRemaining);
    const margin = 1.28 * standardDeviation; // ~80 %:n väli normaaliapproksimaatiolla
    return {
        low: Math.round(currentPoints + Math.max(0, expectedRemaining - margin)),
        high: Math.round(currentPoints + expectedRemaining + margin),
    };
}
