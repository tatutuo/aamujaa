import { int, dec, pct, clock } from '../../utils/format';

/**
 * Odotettujen maalien (xG) taulukot. Data: MoneyPuck.com.
 *
 * xG kertoo, montako maalia laukauksista olisi keskimäärin syntynyt niiden
 * paikan, kulman ja tyypin perusteella. Osuudet (xG%, CF%, FF%) on laskettu
 * tasakentin 5v5, jolloin yli- ja alivoima eivät vääristä niitä.
 */

const col = (key, label, title, extra = {}) => ({ key, label, title, ...extra });

/** Etumerkillinen desimaaliluku: +3,2 / −1,4. */
const signedDec = (decimals) => (v, _r, l) => {
    if (v === null || v === undefined || Number.isNaN(v)) return '–';
    const sign = v > 0 ? '+' : v < 0 ? '−' : '';
    return sign + dec(Math.abs(v), decimals, l);
};

/** Etumerkillinen prosenttiyksikkö osuudesta: 0.021 -> +2,1. */
const signedPct = (v, _r, l) => {
    if (v === null || v === undefined || Number.isNaN(v)) return '–';
    const sign = v > 0 ? '+' : v < 0 ? '−' : '';
    return sign + pct(Math.abs(v), 1, l);
};

const pct1 = (v, _r, l) => pct(v, 1, l);
const dec2 = (v, _r, l) => dec(v, 2, l);
const dec1 = (v, _r, l) => dec(v, 1, l);

export const XG_SKATER_GROUPS = [
    {
        id: 'xg',
        label: { fi: 'Odotetut maalit', en: 'Expected goals' },
        columns: [
            col('gp', { fi: 'O', en: 'GP' }, { fi: 'Ottelut', en: 'Games played' }, { format: int }),
            col('goals', { fi: 'M', en: 'G' }, { fi: 'Maalit', en: 'Goals' }, { format: int }),
            col('xg', { fi: 'xG', en: 'xG' }, { fi: 'Odotetut maalit: montako maalia laukauksista olisi keskimäärin syntynyt', en: 'Expected goals from shot quality' }, { format: dec1 }),
            col('gax', { fi: 'M−xG', en: 'G−xG' }, { fi: 'Maalit miinus odotetut: viimeistely odotettuun nähden', en: 'Goals above expected: finishing' }, { format: signedDec(1), width: '52px' }),
            col('xg60', { fi: 'xG/60', en: 'xG/60' }, { fi: 'Odotetut maalit 60 minuutissa', en: 'Expected goals per 60 minutes' }, { format: dec2, rate: true, width: '52px' }),
        ],
    },
    {
        id: 'onice',
        label: { fi: 'Jäällä 5v5', en: 'On ice 5v5' },
        columns: [
            col('xgPct', { fi: 'xG%', en: 'xG%' }, { fi: 'Joukkueen osuus odotetuista maaleista pelaajan ollessa jäällä (5v5)', en: 'Team share of expected goals with player on ice (5v5)' }, { format: pct1, rate: true }),
            col('xgPctRel', { fi: 'Rel', en: 'Rel' }, { fi: 'xG% verrattuna siihen, kun pelaaja on vaihdossa', en: 'xG% relative to when player is off ice' }, { format: signedPct, rate: true }),
            col('cfPct', { fi: 'CF%', en: 'CF%' }, { fi: 'Corsi: osuus laukaisuyrityksistä (5v5)', en: 'Corsi: share of shot attempts (5v5)' }, { format: pct1, rate: true }),
            col('ffPct', { fi: 'FF%', en: 'FF%' }, { fi: 'Fenwick: osuus blokkaamattomista yrityksistä (5v5)', en: 'Fenwick: share of unblocked attempts (5v5)' }, { format: pct1, rate: true }),
            col('toi', { fi: 'Aika', en: 'TOI' }, { fi: 'Peliaika per ottelu', en: 'Time on ice per game' }, { format: clock, width: '52px' }),
        ],
    },
    {
        id: 'danger',
        label: { fi: 'Vaaralliset paikat', en: 'High danger' },
        columns: [
            col('hdShots', { fi: 'VL', en: 'HDS' }, { fi: 'Laukaukset vaarallisilta paikoilta', en: 'High-danger shots' }, { format: int }),
            col('hdGoals', { fi: 'VM', en: 'HDG' }, { fi: 'Maalit vaarallisilta paikoilta', en: 'High-danger goals' }, { format: int }),
            col('hdxg', { fi: 'VxG', en: 'HDxG' }, { fi: 'Odotetut maalit vaarallisilta paikoilta', en: 'High-danger expected goals' }, { format: dec1 }),
            col('shotAttempts', { fi: 'YR', en: 'ATT' }, { fi: 'Laukaisuyritykset', en: 'Shot attempts' }, { format: int }),
            col('gameScore', { fi: 'GS/O', en: 'GS/GP' }, { fi: 'Game Score per ottelu: yhden luvun arvio ottelun annista', en: 'Game Score per game' }, { format: dec2, rate: true, width: '52px' }),
        ],
    },
];

export const XG_GOALIE_GROUPS = [
    {
        id: 'gsax',
        label: { fi: 'Torjunnat yli odotetun', en: 'Saves above expected' },
        columns: [
            col('gp', { fi: 'O', en: 'GP' }, { fi: 'Ottelut', en: 'Games played' }, { format: int }),
            col('ga', { fi: 'PM', en: 'GA' }, { fi: 'Päästetyt maalit', en: 'Goals against' }, { format: int, lowerIsBetter: true }),
            col('xga', { fi: 'xPM', en: 'xGA' }, { fi: 'Odotetut päästetyt maalit', en: 'Expected goals against' }, { format: dec1 }),
            col('gsax', { fi: 'GSAx', en: 'GSAx' }, { fi: 'Estetyt maalit odotettuun nähden (xPM − PM)', en: 'Goals saved above expected' }, { format: signedDec(1), width: '52px' }),
            col('gsax60', { fi: '/60', en: '/60' }, { fi: 'GSAx 60 minuutissa', en: 'GSAx per 60 minutes' }, { format: signedDec(2), rate: true, width: '52px' }),
        ],
    },
    {
        id: 'danger',
        label: { fi: 'Vaaralliset paikat', en: 'High danger' },
        columns: [
            col('savePct', { fi: 'T%', en: 'SV%' }, { fi: 'Torjuntaprosentti', en: 'Save percentage' }, { format: pct1, rate: true }),
            col('hdShots', { fi: 'VL', en: 'HDS' }, { fi: 'Laukaukset vaarallisilta paikoilta', en: 'High-danger shots against' }, { format: int }),
            col('hdGoals', { fi: 'VM', en: 'HDG' }, { fi: 'Maalit vaarallisilta paikoilta', en: 'High-danger goals against' }, { format: int, lowerIsBetter: true }),
            col('hdSavePct', { fi: 'VT%', en: 'HDSV%' }, { fi: 'Torjuntaprosentti vaarallisilta paikoilta', en: 'High-danger save percentage' }, { format: pct1, rate: true, width: '52px' }),
            col('hdGsax', { fi: 'VGSAx', en: 'HDGSAx' }, { fi: 'Estetyt maalit vaarallisilta paikoilta odotettuun nähden', en: 'High-danger goals saved above expected' }, { format: signedDec(1), width: '56px' }),
        ],
    },
];

export const XG_TEAM_GROUPS = [
    {
        id: 'share',
        label: { fi: 'Osuudet 5v5', en: 'Shares 5v5' },
        columns: [
            col('xgPct', { fi: 'xG%', en: 'xG%' }, { fi: 'Osuus odotetuista maaleista (5v5)', en: 'Share of expected goals (5v5)' }, { format: pct1 }),
            col('cfPct', { fi: 'CF%', en: 'CF%' }, { fi: 'Corsi: osuus laukaisuyrityksistä (5v5)', en: 'Corsi (5v5)' }, { format: pct1 }),
            col('ffPct', { fi: 'FF%', en: 'FF%' }, { fi: 'Fenwick: osuus blokkaamattomista (5v5)', en: 'Fenwick (5v5)' }, { format: pct1 }),
            col('hdfPerGame', { fi: 'VL/O', en: 'HDF/GP' }, { fi: 'Vaaralliset laukaukset per ottelu', en: 'High-danger shots for per game' }, { format: dec1, width: '52px' }),
            col('hdaPerGame', { fi: 'VLV/O', en: 'HDA/GP' }, { fi: 'Vaaralliset laukaukset vastaan per ottelu', en: 'High-danger shots against per game' }, { format: dec1, lowerIsBetter: true, width: '52px' }),
        ],
    },
    {
        id: 'xg',
        label: { fi: 'xG ja maalit', en: 'xG and goals' },
        columns: [
            col('xgf', { fi: 'xTM', en: 'xGF' }, { fi: 'Odotetut tehdyt maalit per ottelu', en: 'Expected goals for per game' }, { format: dec2 }),
            col('gf', { fi: 'TM', en: 'GF' }, { fi: 'Tehdyt maalit per ottelu', en: 'Goals for per game' }, { format: dec2 }),
            col('xga', { fi: 'xPM', en: 'xGA' }, { fi: 'Odotetut päästetyt maalit per ottelu', en: 'Expected goals against per game' }, { format: dec2, lowerIsBetter: true }),
            col('ga', { fi: 'PM', en: 'GA' }, { fi: 'Päästetyt maalit per ottelu', en: 'Goals against per game' }, { format: dec2, lowerIsBetter: true }),
            col('finishing', { fi: 'Viim', en: 'Fin' }, { fi: 'Viimeistely: tehdyt maalit miinus odotetut koko kaudelta', en: 'Finishing: goals minus expected over the season' }, { format: signedDec(1) }),
        ],
    },
    {
        id: 'goaltending',
        label: { fi: 'Maalivahtipeli', en: 'Goaltending' },
        columns: [
            col('gp', { fi: 'O', en: 'GP' }, { fi: 'Ottelut', en: 'Games played' }, { format: int }),
            col('goaltending', { fi: 'GSAx', en: 'GSAx' }, { fi: 'Maalivahtien estämät maalit odotettuun nähden koko kaudelta', en: 'Goals saved above expected over the season' }, { format: signedDec(1) }),
            col('xga', { fi: 'xPM', en: 'xGA' }, { fi: 'Odotetut päästetyt maalit per ottelu', en: 'Expected goals against per game' }, { format: dec2, lowerIsBetter: true }),
            col('ga', { fi: 'PM', en: 'GA' }, { fi: 'Päästetyt maalit per ottelu', en: 'Goals against per game' }, { format: dec2, lowerIsBetter: true }),
        ],
    },
];
