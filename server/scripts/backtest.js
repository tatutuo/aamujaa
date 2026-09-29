/**
 * Takautuva testaus: kuinka hyvin malli olisi ennustanut menneet ottelut?
 *
 * Aja:  node scripts/backtest.js 2026-01-05 2026-02-15
 *
 * Testi on rehellinen siinä mielessä, että jokaisen päivän ennuste käyttää
 * vain sitä päivää edeltävää dataa (ks. `fetchTeamStats(season, date)`).
 * Ilman tätä rajausta malli näkisi tulevaisuuteen ja tulokset näyttäisivät
 * paljon todellista paremmilta.
 *
 * Vertailukohdat kertovat onko mallista oikeasti hyötyä:
 *   - Kolikonheitto (50/50): Brier 0.250
 *   - "Kotijoukkue voittaa aina": NHL:n kotivoittoprosentti on ~53 %
 * Jos malli ei päihitä näitä, se ei tuota arvoa.
 */

import { web } from '../src/lib/nhlApi.js';
import { addDays } from '../src/lib/dates.js';
import { generateMatchPredictions } from '../src/predictions/matches.js';
import { brierScore, logLoss } from '../src/predictions/math.js';

const FINISHED = new Set(['FINAL', 'OFF']);

async function actualResults(date) {
    const score = await web(`/score/${date}`).catch(() => null);
    const results = new Map();

    for (const game of score?.games ?? []) {
        if (!FINISHED.has(game.gameState)) continue;
        results.set(game.id, {
            homeWon: game.homeTeam.score > game.awayTeam.score,
            homeScore: game.homeTeam.score,
            awayScore: game.awayTeam.score,
            wentToOvertime: (game.periodDescriptor?.number ?? 3) > 3,
        });
    }

    return results;
}

async function run(startDate, endDate) {
    const modelPredictions = [];
    const homeAlways = [];
    const coinFlip = [];

    let games = 0;
    let modelHits = 0;
    let homeHits = 0;
    let overtimePredicted = 0;
    let overtimeActual = 0;
    let exactScoreHits = 0;

    for (let date = startDate; date <= endDate; date = addDays(date, 1)) {
        const [predictions, results] = await Promise.all([
            generateMatchPredictions(date).catch(() => []),
            actualResults(date),
        ]);

        if (predictions.length === 0) continue;

        for (const prediction of predictions) {
            const actual = results.get(prediction.gameId);
            if (!actual) continue;

            games++;
            const outcome = actual.homeWon ? 1 : 0;
            const probability = prediction.homeWinProbability;

            modelPredictions.push({ probability, outcome });
            homeAlways.push({ probability: 0.53, outcome });
            coinFlip.push({ probability: 0.5, outcome });

            if ((probability >= 0.5) === actual.homeWon) modelHits++;
            if (actual.homeWon) homeHits++;

            overtimePredicted += prediction.otProb / 100;
            if (actual.wentToOvertime) overtimeActual++;

            if (prediction.homeScore === actual.homeScore && prediction.awayScore === actual.awayScore) {
                exactScoreHits++;
            }
        }

        process.stdout.write(`\r${date}  otteluita yhteensä: ${games}   `);
    }

    console.log('\n');

    if (games === 0) {
        console.log('Ei otteluita annetulla aikavälillä.');
        return;
    }

    const pct = (v) => `${(v * 100).toFixed(1)} %`;
    const num = (v) => v.toFixed(4);

    console.log('='.repeat(58));
    console.log(`TAKAUTUVA TESTAUS  ${startDate} … ${endDate}`);
    console.log('='.repeat(58));
    console.log(`Otteluita:                     ${games}`);
    console.log('');
    console.log('OSUMATARKKUUS (voittajan tunnistaminen)');
    console.log(`  Malli:                       ${pct(modelHits / games)}`);
    console.log(`  "Koti voittaa aina":         ${pct(homeHits / games)}`);
    console.log('');
    console.log('BRIER-PISTEET (pienempi parempi, 0.25 = kolikonheitto)');
    console.log(`  Malli:                       ${num(brierScore(modelPredictions))}`);
    console.log(`  "Koti voittaa 53 %":         ${num(brierScore(homeAlways))}`);
    console.log(`  Kolikonheitto:               ${num(brierScore(coinFlip))}`);
    console.log('');
    console.log('LOGARITMINEN TAPPIO (pienempi parempi)');
    console.log(`  Malli:                       ${num(logLoss(modelPredictions))}`);
    console.log(`  "Koti voittaa 53 %":         ${num(logLoss(homeAlways))}`);
    console.log('');
    console.log('KALIBROINTI');
    console.log(`  Jatkoaikoja ennustettu:      ${(overtimePredicted / games * 100).toFixed(1)} %`);
    console.log(`  Jatkoaikoja toteutui:        ${(overtimeActual / games * 100).toFixed(1)} %`);
    console.log(`  Tarkka lopputulos osui:      ${pct(exactScoreHits / games)}`);
    console.log('='.repeat(58));

    // Luotettavuuskäyrä: osuvatko 60 %:n ennusteet oikeasti 60 %:n ajan?
    console.log('\nLUOTETTAVUUS (ennustettu vs. toteutunut kotivoitto-osuus)');
    const buckets = [[0, 0.35], [0.35, 0.45], [0.45, 0.55], [0.55, 0.65], [0.65, 1]];
    for (const [low, high] of buckets) {
        const inBucket = modelPredictions.filter((p) => p.probability >= low && p.probability < high);
        if (inBucket.length === 0) continue;
        const predicted = inBucket.reduce((s, p) => s + p.probability, 0) / inBucket.length;
        const observed = inBucket.reduce((s, p) => s + p.outcome, 0) / inBucket.length;
        const label = `${(low * 100).toFixed(0)}–${(high * 100).toFixed(0)} %`;
        console.log(`  ${label.padEnd(10)} n=${String(inBucket.length).padStart(4)}  ennustettu ${pct(predicted).padStart(7)}  toteutui ${pct(observed).padStart(7)}`);
    }
}

const [, , start, end] = process.argv;
if (!start || !end) {
    console.error('Käyttö: node scripts/backtest.js <alkupvm> <loppupvm>  (YYYY-MM-DD)');
    process.exit(1);
}

await run(start, end);
