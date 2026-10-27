/**
 * Odotetut maalit (xG): todennäköisyys, että laukaus menee maaliin.
 *
 * Malli on logistinen regressio, joka on sovitettu NHL:n play-by-play-
 * datasta (scripts/fit-xg.js). Mukana ovat torjumattomat laukausyritykset
 * eli maalit, torjutut ja ohi menneet; blokattuja ei, koska blokatun
 * laukauksen sijainti kertoo blokkaajan paikan eikä laukojan.
 *
 * Piirteet:
 *   etäisyys ja kulma maaliin   tärkeimmät: läheltä ja edestä menee sisään
 *   laukaustyyppi                ohjaukset ja kääntö läheltä, lämäri kaukaa
 *   paluukiekko (rebound)        laukaus ≤ 3 s edellisestä: maalivahti liikkeessä
 *   hyökkäys vauhdista (rush)    ≤ 4 s siitä kun kiekko oli omalla tai keskialueella
 *   yli-/alivoima                ylivoimalla enemmän tilaa
 *
 * Tyhjiin lauotut eivät kuulu malliin: niiden todennäköisyys on oma lukunsa
 * (EMPTY_NET_XG), koska maalivahditon maali menee lähes aina sisään.
 */

export const FEATURE_NAMES = [
    'distance', 'logDistance', 'distance2', 'angle', 'angle2', 'distanceAngle', 'behindNet',
    'snap', 'slap', 'backhand', 'tip-in', 'deflected', 'wrap-around', 'otherType',
    'rebound', 'rush', 'powerPlay', 'shortHanded',
];

/**
 * Sovitettu kauden 2025–26 600 ottelun satunnaisotoksesta (51 109
 * torjumatonta laukausyritystä); ks. scripts/fit-xg.js.
 *
 * Tarkkuus erillisellä testiotoksella (120 ottelua, 10 180 laukausta):
 * AUC 0,74, log loss 0,222 (pelkkä keskiarvo 0,245), odotetut maalit 686
 * vs. toteutuneet 678.
 *
 * Vertailu MoneyPuckiin samoista otteluista joukkue-ottelutasolla
 * (16.10.2026, 214 testijoukkue-ottelua): korrelaatio 0,88, keskimääräinen
 * ero 0,39 xG/ottelu. Maalien ennustamisessa MoneyPuck on hieman parempi
 * (korrelaatio maaleihin 0,43 vs. 0,37), virheen suuruus sama (RMSE 1,48
 * vs. 1,49). MoneyPuckin mallissa on enemmän piirteitä (mm. edellisen
 * tapahtuman sijainti ja kiekon nopeus).
 *
 * Huomio: paluukiekon kerroin on negatiivinen. Se ei ole virhe: NHL:n
 * datassa paluukiekot eivät mene samalta etäisyydeltä useammin sisään
 * kuin muut laukaukset (0–10 ft: 12,4 % vs 13,3 %), koska etäisyys
 * selittää jo niiden vaarallisuuden.
 */
export const MODEL = {
    season: '20252026', games: 600, shots: 51109,
    intercept: -0.11319,
    weights: {
        distance: -0.02053,
        logDistance: -0.41733,
        distance2: -0.29103,
        angle: 0.00250,
        angle2: -1.02394,
        distanceAngle: -1.87919,
        behindNet: -0.03596,
        snap: 0.23508,
        slap: 0.26702,
        backhand: -0.51726,
        'tip-in': -0.95422,
        deflected: -0.49532,
        'wrap-around': -1.65982,
        otherType: -0.45173,
        rebound: -0.38430,
        rush: -0.37616,
        powerPlay: 0.20415,
        shortHanded: 0.09833,
    },
};

/**
 * Tyhjään maaliin lauotun torjumattoman laukauksen maalitodennäköisyys:
 * samasta otoksesta 232 maalia 452 laukauksesta.
 */
export const EMPTY_NET_XG = 0.51;

const UNBLOCKED = new Set(['shot-on-goal', 'goal', 'missed-shot']);
const ATTEMPTS = new Set(['shot-on-goal', 'goal', 'missed-shot', 'blocked-shot']);
const MAIN_TYPES = new Set(['wrist', 'snap', 'slap', 'backhand', 'tip-in', 'deflected', 'wrap-around']);

const seconds = (mmss) => {
    const [m, s] = String(mmss ?? '').split(':').map(Number);
    return Number.isFinite(m) && Number.isFinite(s) ? m * 60 + s : null;
};

const flipZone = (zone) => (zone === 'O' ? 'D' : zone === 'D' ? 'O' : zone);

/**
 * Piirteet yhdestä tapahtumasta. Palauttaa null, jos tapahtuma ei ole
 * torjumaton laukaus tai sitä ei voi arvioida (voittolaukauskilpailu,
 * rangaistuslaukaus, puuttuva sijainti).
 *
 * @param {Array} plays ottelun tapahtumat aikajärjestyksessä
 * @param {number} i tapahtuman indeksi
 * @param {number} homeTeamId
 */
export function shotFeatures(plays, i, homeTeamId) {
    const play = plays[i];
    if (!UNBLOCKED.has(play.typeDescKey)) return null;
    if (play.periodDescriptor?.periodType === 'SO') return null;

    const d = play.details ?? {};
    if (d.xCoord == null || d.yCoord == null) return null;

    const isHome = d.eventOwnerTeamId === homeTeamId;
    const code = String(play.situationCode ?? '1551').padStart(4, '0');
    const [awayGoalie, awaySkaters, homeSkaters, homeGoalie] = code.split('').map(Number);
    const ownSkaters = isHome ? homeSkaters : awaySkaters;
    const oppSkaters = isHome ? awaySkaters : homeSkaters;
    // Rangaistuslaukaus (yksi vastaan maalivahti) ei ole tavallinen laukaus.
    if (ownSkaters <= 1 || oppSkaters === 0) return null;
    const emptyNet = (isHome ? awayGoalie : homeGoalie) === 0;

    // Hyökkäyssuunta: kotijoukkue hyökkää siihen päätyyn, jota se ei puolusta.
    let goalX;
    if (play.homeTeamDefendingSide === 'left' || play.homeTeamDefendingSide === 'right') {
        const homeAttacksRight = play.homeTeamDefendingSide === 'left';
        goalX = (isHome === homeAttacksRight) ? 89 : -89;
    } else {
        goalX = d.xCoord >= 0 ? 89 : -89;
    }
    const front = (goalX - d.xCoord) * Math.sign(goalX);
    const distance = Math.hypot(goalX - d.xCoord, d.yCoord);
    const angle = (Math.atan2(Math.abs(d.yCoord), front) * 180) / Math.PI;

    // Edellinen tapahtuma samassa erässä: paluukiekko ja vauhtihyökkäys.
    const prev = plays[i - 1];
    const sameperiod = prev && prev.periodDescriptor?.number === play.periodDescriptor?.number;
    const dt = sameperiod ? seconds(play.timeInPeriod) - seconds(prev.timeInPeriod) : null;
    const prevOwnTeam = prev?.details?.eventOwnerTeamId === d.eventOwnerTeamId;
    const rebound = dt != null && dt <= 3 && ATTEMPTS.has(prev.typeDescKey)
        && (prevOwnTeam || prev.typeDescKey === 'blocked-shot');
    const prevZone = prev?.details?.zoneCode ? (prevOwnTeam ? prev.details.zoneCode : flipZone(prev.details.zoneCode)) : null;
    const rush = !rebound && dt != null && dt <= 4 && (prevZone === 'N' || prevZone === 'D');

    const type = d.shotType ?? 'wrist';
    const vector = [
        distance,
        Math.log(distance + 1),
        (distance / 50) ** 2,
        angle,
        (angle / 90) ** 2,
        (distance / 50) * (angle / 90),
        front < 0 ? 1 : 0,
        type === 'snap' ? 1 : 0,
        type === 'slap' ? 1 : 0,
        type === 'backhand' ? 1 : 0,
        type === 'tip-in' ? 1 : 0,
        type === 'deflected' ? 1 : 0,
        type === 'wrap-around' ? 1 : 0,
        MAIN_TYPES.has(type) ? 0 : 1,
        rebound ? 1 : 0,
        rush ? 1 : 0,
        ownSkaters > oppSkaters ? 1 : 0,
        ownSkaters < oppSkaters ? 1 : 0,
    ];

    return {
        vector,
        goal: play.typeDescKey === 'goal',
        emptyNet,
        isHome,
        distance: Math.round(distance),
        angle: Math.round(angle),
        rebound,
        rush,
    };
}

/** Maalitodennäköisyys piirteistä. */
export function xgOf(features) {
    if (!features) return 0;
    if (features.emptyNet) return EMPTY_NET_XG;
    const z = FEATURE_NAMES.reduce((sum, name, j) => sum + (MODEL.weights[name] ?? 0) * features.vector[j], MODEL.intercept);
    return 1 / (1 + Math.exp(-z));
}
