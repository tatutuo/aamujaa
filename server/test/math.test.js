import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
    shrinkRate,
    poissonPmf,
    scoreMatrix,
    outcomeProbabilities,
    overtimeWinProbability,
    brierScore,
    logLoss,
    pointsInterval,
} from '../src/predictions/math.js';

const close = (actual, expected, tolerance = 1e-6) =>
    assert.ok(
        Math.abs(actual - expected) < tolerance,
        `odotettiin ${expected}, saatiin ${actual} (ero ${Math.abs(actual - expected)})`,
    );

describe('shrinkRate', () => {
    test('ilman havaintoja palautetaan ennakkoarvo', () => {
        close(shrinkRate(0, 0, 3.0, 15), 3.0);
    });

    test('pieni otos vedetään voimakkaasti kohti keskiarvoa', () => {
        // 5 ottelua, 21 maalia = 4.2 per peli. Liigan keskiarvo 3.0.
        const rate = shrinkRate(21, 5, 3.0, 15);
        assert.ok(rate > 3.0 && rate < 3.5, `odotettiin välille 3.0–3.5, saatiin ${rate}`);
    });

    test('suuri otos säilyttää havaitun tason', () => {
        // 82 ottelua samalla 4.2 vauhdilla — nyt luku on oikeasti ansaittu.
        const rate = shrinkRate(344, 82, 3.0, 15);
        assert.ok(rate > 3.9, `odotettiin yli 3.9, saatiin ${rate}`);
    });

    test('kutistus on monotoninen otoskoon suhteen', () => {
        const few = shrinkRate(4.2 * 5, 5, 3.0, 15);
        const many = shrinkRate(4.2 * 40, 40, 3.0, 15);
        assert.ok(many > few, 'suuremman otoksen pitäisi olla lähempänä havaintoa');
    });
});

describe('poissonPmf', () => {
    test('summautuu ykköseen', () => {
        let total = 0;
        for (let k = 0; k <= 40; k++) total += poissonPmf(k, 3.1);
        close(total, 1, 1e-9);
    });

    test('tunnetut arvot', () => {
        close(poissonPmf(0, 1), Math.exp(-1), 1e-12);
        close(poissonPmf(2, 2), 2 * Math.exp(-2), 1e-12);
    });

    test('negatiivinen maalimäärä on mahdoton', () => {
        assert.equal(poissonPmf(-1, 3), 0);
    });
});

describe('scoreMatrix', () => {
    test('todennäköisyydet summautuvat ykköseen', () => {
        const matrix = scoreMatrix(3.1, 2.8);
        const total = matrix.flat().reduce((a, b) => a + b, 0);
        close(total, 1, 1e-9);
    });

    test('kaikki todennäköisyydet ovat ei-negatiivisia', () => {
        const matrix = scoreMatrix(3.1, 2.8);
        assert.ok(matrix.flat().every((p) => p >= 0));
    });

    test('tasatilanteiden korotus vastaa NHL:n toteutunutta osuutta', () => {
        const matrix = scoreMatrix(2.95, 2.95);
        const tieProbability = matrix.reduce((sum, row, i) => sum + row[i], 0);

        // Riippumaton Poisson antaisi noin 17 %; NHL:n toteutunut on ~23 %.
        assert.ok(tieProbability > 0.21 && tieProbability < 0.26,
            `odotettiin 21–26 %, saatiin ${tieProbability}`);
    });
});

describe('outcomeProbabilities', () => {
    test('voittotodennäköisyydet summautuvat ykköseen', () => {
        const result = outcomeProbabilities(3.2, 2.7);
        close(result.homeWin + result.awayWin, 1, 1e-9);
    });

    test('parempi joukkue voittaa todennäköisemmin', () => {
        const result = outcomeProbabilities(3.6, 2.4);
        assert.ok(result.homeWin > result.awayWin);
        assert.ok(result.homeWin > 0.55, `odotettiin yli 55 %, saatiin ${result.homeWin}`);
    });

    test('tasaväkisessä ottelussa kotietu ratkaisee niukasti', () => {
        const result = outcomeProbabilities(3.0, 3.0);
        assert.ok(result.homeWin > 0.5 && result.homeWin < 0.56,
            `odotettiin niukkaa kotietua, saatiin ${result.homeWin}`);
    });

    test('jatkoajan osuus on realistinen', () => {
        const result = outcomeProbabilities(3.0, 3.0);
        // NHL:ssä noin joka neljäs ottelu menee jatkoajalle.
        assert.ok(result.overtime > 0.18 && result.overtime < 0.30,
            `odotettiin 18–30 %, saatiin ${result.overtime}`);
    });

    test('jatkoaika jakautuu jatkoerään ja voittolaukauksiin', () => {
        const result = outcomeProbabilities(3.0, 3.0);
        close(result.overtimeDecidedInOt + result.shootout, result.overtime, 1e-9);
    });

    test('todennäköisin tulos ei ole koskaan tasan', () => {
        for (const [h, a] of [[3.0, 3.0], [2.5, 2.5], [4.0, 4.0]]) {
            const { mostLikelyScore } = outcomeProbabilities(h, a);
            assert.notEqual(mostLikelyScore.home, mostLikelyScore.away,
                `tasalukema ${mostLikelyScore.home}-${mostLikelyScore.away} ei ole mahdollinen lopputulos`);
        }
    });

    test('maalirikas ottelu nostaa yli 5,5 maalin todennäköisyyttä', () => {
        const low = outcomeProbabilities(2.2, 2.2).overFiveHalfGoals;
        const high = outcomeProbabilities(4.0, 4.0).overFiveHalfGoals;
        assert.ok(high > low);
    });

    test('tulos on toistettava — sama syöte antaa saman vastauksen', () => {
        const a = outcomeProbabilities(3.1, 2.9);
        const b = outcomeProbabilities(3.1, 2.9);
        assert.deepEqual(a, b);
    });
});

describe('overtimeWinProbability', () => {
    test('tasavahvoilla kotietu on pieni', () => {
        const p = overtimeWinProbability(3.0, 3.0);
        assert.ok(p > 0.5 && p < 0.56, `saatiin ${p}`);
    });

    test('vahvuusero vaikuttaa vaimennettuna', () => {
        const dominant = overtimeWinProbability(4.0, 2.0);
        // Varsinaisella peliajalla ero olisi paljon suurempi kuin 3-on-3:ssa.
        assert.ok(dominant < 0.68, `jatkoajan edun pitäisi olla maltillinen, saatiin ${dominant}`);
    });
});

describe('mallin arviointimittarit', () => {
    test('täydellinen ennuste antaa Brier-pisteen 0', () => {
        close(brierScore([{ probability: 1, outcome: 1 }, { probability: 0, outcome: 0 }]), 0);
    });

    test('kolikonheitto antaa Brier-pisteen 0.25', () => {
        close(brierScore([{ probability: 0.5, outcome: 1 }, { probability: 0.5, outcome: 0 }]), 0.25);
    });

    test('logaritminen tappio rankaisee varmasta virheestä', () => {
        const confidentWrong = logLoss([{ probability: 0.99, outcome: 0 }]);
        const unsureWrong = logLoss([{ probability: 0.55, outcome: 0 }]);
        assert.ok(confidentWrong > unsureWrong * 3);
    });

    test('tyhjä syöte ei kaada laskentaa', () => {
        assert.equal(brierScore([]), null);
        assert.equal(logLoss([]), null);
    });
});

describe('pointsInterval', () => {
    test('kauden lopussa ei ole epävarmuutta', () => {
        assert.deepEqual(pointsInterval(80, 0), { low: 80, high: 80 });
    });

    test('väli ympäröi odotusarvon', () => {
        const { low, high } = pointsInterval(50, 30);
        assert.ok(low < 80 && high > 80, `odotettiin väliä 80:n ympärille, saatiin ${low}–${high}`);
    });

    test('väli levenee kun peliä on enemmän jäljellä', () => {
        const narrow = pointsInterval(50, 10);
        const wide = pointsInterval(50, 40);
        assert.ok((wide.high - wide.low) > (narrow.high - narrow.low));
    });

    test('alaraja ei alita jo kerättyjä pisteitä', () => {
        const { low } = pointsInterval(50, 1);
        assert.ok(low >= 50, 'pisteitä ei voi menettää');
    });
});
