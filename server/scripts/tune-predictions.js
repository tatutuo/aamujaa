/**
 * Otteluennusteiden kalibrointi kahdella kaudella.
 *
 * Ajo:  TUNE_CACHE=<kansio> node scripts/tune-predictions.js
 *
 * 1. Hakee jokaiselle runkosarjapäivälle mallin syötteet (vain sitä päivää
 *    edeltävä data) ja toteutuneet tulokset. Välimuistiin tallennettuna
 *    uusinta-ajot eivät hae NHL:ltä mitään.
 * 2. Etsii parametrit kaudelta 2024–25 (sovitus) minimoimalla voittajan
 *    logaritmisen tappion; tasatilanteiden korotus sovitetaan erikseen
 *    jatkoaikojen osuuteen.
 * 3. Raportoi tulokset kaudelta 2025–26 (tarkistus), jota sovitus ei nähnyt.
 *    Vain tarkistuskauden luvut kertovat mallin todellisen tarkkuuden.
 */
import fs from 'node:fs';
import path from 'node:path';
import { web } from '../src/lib/nhlApi.js';
import { addDays } from '../src/lib/dates.js';
import { fetchMatchInputs, computeMatchPredictions, DEFAULT_PARAMS } from '../src/predictions/matches.js';
import { brierScore, logLoss } from '../src/predictions/math.js';

const SEASONS = {
    train: { id: '20242025', start: '2024-10-04', end: '2025-04-17' },
    test: { id: '20252026', start: '2025-10-07', end: '2026-04-16' },
};
const EARLY_UNTIL = { '20242025': '2024-11-15', '20252026': '2025-11-15' };

const cacheDir = process.env.TUNE_CACHE;
if (!cacheDir) {
    console.error('Aseta TUNE_CACHE=<kansio> (aineisto tallennetaan sinne).');
    process.exit(1);
}
fs.mkdirSync(cacheDir, { recursive: true });

async function results(date) {
    const score = await web(`/score/${date}`).catch(() => null);
    const out = {};
    for (const g of score?.games ?? []) {
        if (g.gameType !== 2 || !['FINAL', 'OFF'].includes(g.gameState)) continue;
        const extra = g.gameOutcome?.lastPeriodType;
        out[g.id] = {
            homeWon: g.homeTeam.score > g.awayTeam.score ? 1 : 0,
            overtime: extra === 'OT' || extra === 'SO' || (g.periodDescriptor?.number ?? 3) > 3 ? 1 : 0,
        };
    }
    return out;
}

async function dataset(season) {
    const file = path.join(cacheDir, `predictions-${season.id}.json`);
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));

    const cache = { schedules: new Map(), previous: new Map(), rest: new Map() };
    const dates = [];
    for (let d = season.start; d <= season.end; d = addDays(d, 1)) dates.push(d);

    const days = [];
    let index = 0;
    const worker = async () => {
        while (index < dates.length) {
            const date = dates[index++];
            const [inputs, res] = await Promise.all([fetchMatchInputs(date, cache).catch(() => null), results(date)]);
            if (inputs?.games?.length) days.push({ date, inputs, results: res });
            if (days.length % 25 === 0) process.stderr.write(`  ${season.id}: ${days.length} päivää\n`);
        }
    };
    await Promise.all(Array.from({ length: 2 }, worker));
    days.sort((a, b) => a.date.localeCompare(b.date));
    // restEffects on Map; muutetaan JSONiksi sopivaksi (fetchMatchInputs tekee sen jo).
    fs.writeFileSync(file, JSON.stringify(days));
    return days;
}

function evaluate(days, params, { until } = {}) {
    const win = [];
    const ot = [];
    let hits = 0;
    for (const day of days) {
        if (until && day.date > until) continue;
        for (const p of computeMatchPredictions(day.inputs, params)) {
            const r = day.results[p.gameId];
            if (!r) continue;
            win.push({ probability: p.homeWinProbability, outcome: r.homeWon });
            ot.push({ probability: p.overtimeProbability, outcome: r.overtime });
            if ((p.homeWinProbability >= 0.5 ? 1 : 0) === r.homeWon) hits++;
        }
    }
    const mean = (list, key) => list.reduce((s, x) => s + x[key], 0) / list.length;
    return {
        games: win.length,
        accuracy: hits / win.length,
        brier: brierScore(win),
        logLoss: logLoss(win),
        otLogLoss: logLoss(ot),
        otPredicted: mean(ot, 'probability'),
        otActual: mean(ot, 'outcome'),
        calibration: calibration(win),
    };
}

function calibration(list) {
    const bins = [[0, 0.35], [0.35, 0.45], [0.45, 0.55], [0.55, 0.65], [0.65, 1.01]];
    return bins.map(([lo, hi]) => {
        const inBin = list.filter((x) => x.probability >= lo && x.probability < hi);
        if (!inBin.length) return null;
        const p = inBin.reduce((s, x) => s + x.probability, 0) / inBin.length;
        const o = inBin.reduce((s, x) => s + x.outcome, 0) / inBin.length;
        return `${Math.round(lo * 100)}–${Math.round(Math.min(hi, 1) * 100)} %: n=${inBin.length} ennuste ${(p * 100).toFixed(1)} % toteutui ${(o * 100).toFixed(1)} %`;
    }).filter(Boolean);
}

const GRID = {
    homeAdvantage: [1.0, 1.02, 1.035, 1.05, 1.07],
    priorGames: [6, 10, 14, 20, 30, 45],
    shootingPriorShots: [200, 450, 800, 1500, 3000],
    goaliePriorShots: [400, 900, 1600, 3000],
    corsiWeight: [0, 0.2, 0.35, 0.5, 0.7],
    carryOver: [0, 0.2, 0.35, 0.5, 0.65, 0.8],
    formMax: [0, 0.02, 0.05, 0.08],
    specialScale: [0, 0.25, 0.5, 0.75, 1],
    b2bGoalieShift: [0, 0.2, 0.4, 0.6],
};
const TIE_GRID = [0.45, 0.55, 0.58, 0.65, 0.72, 0.8, 0.9, 1.0];

function tune(days) {
    let best = { ...DEFAULT_PARAMS };
    let bestLoss = evaluate(days, best).logLoss;
    for (let round = 1; round <= 3; round++) {
        let improved = false;
        for (const [key, values] of Object.entries(GRID)) {
            for (const value of values) {
                if (value === best[key]) continue;
                const candidate = { ...best, [key]: value };
                const loss = evaluate(days, candidate).logLoss;
                if (loss < bestLoss - 1e-5) {
                    best = candidate;
                    bestLoss = loss;
                    improved = true;
                }
            }
        }
        process.stderr.write(`  kierros ${round}: log loss ${bestLoss.toFixed(4)}\n`);
        if (!improved) break;
    }
    // Tasatilanteet: sovitetaan jatkoaikojen osuuteen.
    let bestTie = best.tieInflation;
    let bestOt = evaluate(days, best).otLogLoss;
    for (const value of TIE_GRID) {
        const loss = evaluate(days, { ...best, tieInflation: value }).otLogLoss;
        if (loss < bestOt - 1e-5) { bestOt = loss; bestTie = value; }
    }
    return { ...best, tieInflation: bestTie };
}

const fmt = (r) => `${r.games} ottelua · oikein ${(r.accuracy * 100).toFixed(1)} % · Brier ${r.brier.toFixed(4)} · log loss ${r.logLoss.toFixed(4)} · jatkoajat ${(r.otPredicted * 100).toFixed(1)} % vs ${(r.otActual * 100).toFixed(1)} %`;

const train = await dataset(SEASONS.train);
const test = await dataset(SEASONS.test);
console.log(`Aineisto: ${train.length} + ${test.length} päivää`);

const changedFrom = (params) => JSON.stringify(Object.fromEntries(Object.entries(params).filter(([k, v]) => DEFAULT_PARAMS[k] !== v)));

/*
 * Ristiintarkistus: sovitus toisella kaudella ja tarkistus toisella,
 * molempiin suuntiin. Vain sovituksen ulkopuoliset luvut kertovat, yleistyykö
 * kalibrointi vai vain ylisovittuuko se yhteen kauteen.
 */
const folds = [
    { label: 'Sovitus 2024–25 → tarkistus 2025–26', fit: train, check: test, id: SEASONS.test.id },
    { label: 'Sovitus 2025–26 → tarkistus 2024–25', fit: test, check: train, id: SEASONS.train.id },
];
for (const fold of folds) {
    const tuned = tune(fold.fit);
    console.log(`\n== ${fold.label}`);
    console.log('  Parametrit:', changedFrom(tuned));
    console.log('  Nykyinen:   ', fmt(evaluate(fold.check, DEFAULT_PARAMS)));
    console.log('  Kalibroitu: ', fmt(evaluate(fold.check, tuned)));
    console.log('  Kauden alku, nykyinen:   ', fmt(evaluate(fold.check, DEFAULT_PARAMS, { until: EARLY_UNTIL[fold.id] })));
    console.log('  Kauden alku, kalibroitu: ', fmt(evaluate(fold.check, tuned, { until: EARLY_UNTIL[fold.id] })));
}

// Lopullinen: molemmat kaudet yhdessä.
const both = [...train, ...test];
const final = tune(both);
console.log('\n== Lopullinen (molemmat kaudet)');
console.log('  Parametrit:', changedFrom(final));
for (const [label, days, id] of [['2024–25', train, SEASONS.train.id], ['2025–26', test, SEASONS.test.id]]) {
    console.log(`  ${label} nykyinen:   `, fmt(evaluate(days, DEFAULT_PARAMS)));
    console.log(`  ${label} lopullinen: `, fmt(evaluate(days, final)));
    console.log(`  ${label} alku, lopullinen: `, fmt(evaluate(days, final, { until: EARLY_UNTIL[id] })));
    console.log(`  ${label} luotettavuus:`);
    for (const line of evaluate(days, final).calibration) console.log(`    ${line}`);
}
// "Koti voittaa" -vertailu kummallekin kaudelle.
for (const [label, days] of [['2024–25', train], ['2025–26', test]]) {
    const outcomes = days.flatMap((d) => Object.values(d.results).map((r) => r.homeWon));
    const rate = outcomes.reduce((s, x) => s + x, 0) / outcomes.length;
    const brier = brierScore(outcomes.map((o) => ({ probability: rate, outcome: o })));
    console.log(`  ${label} koti voittaa aina: ${(Math.max(rate, 1 - rate) * 100).toFixed(1)} %, Brier ${brier.toFixed(4)}`);
}
console.log('\nLopulliset parametrit:', JSON.stringify(final, null, 2));
