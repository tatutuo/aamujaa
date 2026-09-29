import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
    faceoffPoints,
    savePoints,
    goalsAgainstPoints,
    shotBlockHitPoints,
    penaltyPoints,
    starPoints,
    applyCaptain,
    scoreSkater,
    scoreGoalie,
} from '../src/utils/fantasy.js';

/** Yhden erittelyrivin pisteet. */
const pts = (result, key) => result.breakdown.find((r) => r.key === key)?.points;

describe('aloitukset lasketaan voittojen ja häviöiden erotuksesta', () => {
    /** Sääntökirjan oma esimerkki: 9 voittoa, 3 häviötä -> erotus 6 -> 2 p. */
    test('sääntökirjan esimerkki', () => {
        assert.equal(faceoffPoints(9, 3), 2);
    });

    test('portaat neljän välein', () => {
        assert.equal(faceoffPoints(1, 0), 1);    // erotus 1
        assert.equal(faceoffPoints(4, 0), 1);    // erotus 4
        assert.equal(faceoffPoints(5, 0), 2);    // erotus 5
        assert.equal(faceoffPoints(8, 0), 2);
        assert.equal(faceoffPoints(9, 0), 3);
        assert.equal(faceoffPoints(12, 0), 3);
        assert.equal(faceoffPoints(13, 0), 4);
    });

    test('miinuspuoli on peilikuva', () => {
        assert.equal(faceoffPoints(0, 1), -1);
        assert.equal(faceoffPoints(0, 5), -2);
        assert.equal(faceoffPoints(3, 9), -2);   // erotus -6
        assert.equal(faceoffPoints(0, 13), -4);
    });

    test('tasan menneistä ei pisteitä', () => {
        assert.equal(faceoffPoints(10, 10), 0);
        assert.equal(faceoffPoints(0, 0), 0);
    });

    /*
     * Otoskoko hoituu erotuksella itsestään: yksi voitettu aloitus on erotus 1,
     * kun taas 17-8 on erotus 9. Prosenttiin perustuva laskenta antoi
     * molemmille saman tuloksen, mistä heittely johtui.
     */
    test('pieni otos ei enää anna suuria pisteitä', () => {
        assert.equal(faceoffPoints(1, 0), 1);
        assert.equal(faceoffPoints(17, 8), 3);
    });
});

describe('laukaukset, blokit ja taklaukset', () => {
    test('kaksi suoritusta on piste', () => {
        assert.deepEqual([0, 1, 2, 3, 4, 7, 8].map(shotBlockHitPoints), [0, 1, 1, 2, 2, 4, 4]);
    });
});

describe('maalivahdin torjunnat ja päästetyt', () => {
    test('torjuntataulukko', () => {
        assert.equal(savePoints(0), 0);
        assert.equal(savePoints(4), 1);
        assert.equal(savePoints(5), 3);
        assert.equal(savePoints(14), 5);
        assert.equal(savePoints(34), 13);
        assert.equal(savePoints(35), 16);
        assert.equal(savePoints(44), 19);
        assert.equal(savePoints(59), 28);
    });

    test('torjuntapisteet eivät koskaan laske määrän kasvaessa', () => {
        let edellinen = -1;
        for (let s = 0; s <= 70; s += 1) {
            const p = savePoints(s);
            assert.ok(p >= edellinen, `torjunnat ${s} antoi ${p}, edellinen ${edellinen}`);
            edellinen = p;
        }
    });

    test('päästetyt maalit', () => {
        assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7].map(goalsAgainstPoints), [0, -1, -2, -3, -4, -6, -8, -10]);
    });
});

describe('jäähyt tyypeittäin', () => {
    /** hockeygm.fi: 2 min jäähy on maalivahdille −1, kenttäpelaajalle +1. */
    test('kahden minuutin jäähy: kenttäpelaajalle plussaa, maalivahdille miinusta', () => {
        assert.equal(penaltyPoints({ minor: 1 }, false), 1);
        assert.equal(penaltyPoints({ minor: 1 }, true), -1);
    });

    test('muut jäähyt ovat samat kaikille', () => {
        for (const isGoalie of [false, true]) {
            assert.equal(penaltyPoints({ fightingMajor: 1 }, isGoalie), 2);
            assert.equal(penaltyPoints({ otherMajor: 1 }, isGoalie), -3);
            assert.equal(penaltyPoints({ misconduct: 1 }, isGoalie), -5);
            assert.equal(penaltyPoints({ gameMisconduct: 1 }, isGoalie), -8);
            assert.equal(penaltyPoints({ matchPenalty: 1 }, isGoalie), -10);
        }
    });

    test('kaksoispieni on kaksi pientä', () => {
        assert.equal(penaltyPoints({ minor: 2 }, false), 2);
        assert.equal(penaltyPoints({ minor: 2 }, true), -2);
    });

    test('maalivahdin katto koskee myös pieniä jäähyjä', () => {
        assert.equal(penaltyPoints({ minor: 12 }, true), -10);
    });

    test('maalivahdin jäähypisteet eivät alita kymmentä', () => {
        assert.equal(penaltyPoints({ gameMisconduct: 1, otherMajor: 1 }, true), -10);
        assert.equal(penaltyPoints({ gameMisconduct: 1, otherMajor: 1 }, false), -11);
    });

    test('tappelu on plussaa myös muiden jäähyjen kanssa', () => {
        assert.equal(penaltyPoints({ fightingMajor: 1, otherMajor: 1 }, false), -1);
    });
});

describe('kapteenin kerroin', () => {
    /** Sääntökirjan esimerkit: 8 × 1,3 = 10,4 -> 11 ja −7 × 1,3 = −9,1 -> −10. */
    test('sääntökirjan esimerkit', () => {
        assert.equal(applyCaptain(8, true), 11);
        assert.equal(applyCaptain(-7, true), -10);
    });

    test('ilman kapteeniutta pisteet eivät muutu', () => {
        assert.equal(applyCaptain(8, false), 8);
    });

    test('pyöristys on aina nollasta poispäin', () => {
        assert.equal(applyCaptain(10, true), 13);
        assert.equal(applyCaptain(-10, true), -13);
        assert.equal(applyCaptain(0, true), 0);
    });
});

describe('tähdet', () => {
    test('portaat', () => {
        assert.deepEqual([1, 2, 3, null].map(starPoints), [3, 2, 1, 0]);
    });
});

describe('kenttäpelaaja', () => {
    test('hyökkääjän perusrivit', () => {
        const r = scoreSkater({
            position: 'C', goals: 1, assists: 2, plusMinus: 2,
            sog: 4, hits: 2, blockedShots: 1,
            faceoffWins: 9, faceoffLosses: 3, starRank: 1,
        });
        assert.equal(pts(r, 'goals'), 7);
        assert.equal(pts(r, 'assists'), 8);
        assert.equal(pts(r, 'plusMinus'), 4);
        assert.equal(pts(r, 'sbh'), 4);
        assert.equal(pts(r, 'faceoffs'), 2);
        assert.equal(pts(r, 'star'), 3);
        assert.equal(r.total, 28);
    });

    test('puolustajan kertoimet ovat suuremmat', () => {
        const r = scoreSkater({ position: 'D', goals: 1, assists: 1, plusMinus: 1 });
        assert.equal(pts(r, 'goals'), 9);
        assert.equal(pts(r, 'assists'), 6);
        assert.equal(pts(r, 'plusMinus'), 3);
    });

    test('miinusteho rankaisee lievemmin kuin plusteho palkitsee', () => {
        assert.equal(pts(scoreSkater({ position: 'D', plusMinus: -3 }), 'plusMinus'), -6);
        assert.equal(pts(scoreSkater({ position: 'L', plusMinus: -3 }), 'plusMinus'), -3);
    });

    test('alivoimamaali ja -syöttö tulevat maalin päälle', () => {
        const r = scoreSkater({ position: 'L', goals: 1, shorthandedGoals: 1 });
        assert.equal(pts(r, 'goals'), 7);
        assert.equal(pts(r, 'shorthandedGoal'), 4);
        assert.equal(r.total, 11);
    });

    /** Sääntö: jatkoaikamaali sisältää voittomaalin osuuden. */
    test('jatkoaikamaalista ei tule lisäksi voittomaalipisteitä', () => {
        const r = scoreSkater({ position: 'L', goals: 1, gameWinningGoals: 1, overtimeGoals: 1 });
        assert.equal(pts(r, 'overtimeGoal'), 3);
        assert.equal(pts(r, 'gameWinner'), 0);
        assert.equal(r.total, 10);
    });

    test('varsinaisella pelatusta voittomaalista tulee kaksi pistettä', () => {
        const r = scoreSkater({ position: 'L', goals: 1, gameWinningGoals: 1 });
        assert.equal(pts(r, 'gameWinner'), 2);
    });

    /** Säännöissä vain jatkoaikatappio on rajattu runkosarjaan, ei voittomaali. */
    test('voittomaalipisteet annetaan myös pudotuspeleissä', () => {
        const r = scoreSkater({ position: 'L', goals: 1, gameWinningGoals: 1, isRegularSeason: false });
        assert.equal(pts(r, 'gameWinner'), 2);
        assert.equal(r.total, 9);
    });

    /** Voittolaukauskilpailun ratkaiseva maali: voittomaalin pisteet, ei maalia. */
    test('voittolaukauksen ratkaisija saa voittomaalin pisteet', () => {
        const r = scoreSkater({ position: 'C', goals: 0, gameWinningGoals: 1 });
        assert.equal(pts(r, 'goals'), 0);
        assert.equal(pts(r, 'gameWinner'), 2);
        assert.equal(r.total, 2);
    });

    test('kenttäpelaajan pienet jäähyt ovat plussaa, isot miinusta', () => {
        const r = scoreSkater({ position: 'D', goals: 1, penalties: { minor: 2, otherMajor: 1 } });
        assert.equal(pts(r, 'penalties'), 2 - 3);
        assert.equal(r.total, 9 - 1);
    });

    test('aloitusrivi puuttuu jos pelaaja ei ottanut aloituksia', () => {
        const r = scoreSkater({ position: 'D' });
        assert.equal(r.breakdown.find((x) => x.key === 'faceoffs'), undefined);
    });

    test('kapteeni saa kertoimen kokonaispisteisiin', () => {
        const tavallinen = scoreSkater({ position: 'L', goals: 1, assists: 1 });
        const kapteeni = scoreSkater({ position: 'L', goals: 1, assists: 1, isCaptain: true });
        assert.equal(tavallinen.total, 11);
        assert.equal(kapteeni.rawTotal, 11);
        assert.equal(kapteeni.total, 15);   // 11 * 1,3 = 14,3 -> 15
    });

    test('tyhjä ottelu antaa nolla pistettä', () => {
        assert.equal(scoreSkater({ position: 'L' }).total, 0);
    });
});

describe('maalivahti', () => {
    test('nollapeli 30 torjunnalla', () => {
        const r = scoreGoalie({ saves: 30, goalsAgainst: 0, decision: 'W' });
        assert.equal(pts(r, 'win'), 4);
        assert.equal(pts(r, 'shutout'), 12);
        assert.equal(pts(r, 'saves'), 13);
        assert.equal(r.total, 29);
    });

    test('tappio jatkoajalla antaa pisteen', () => {
        const r = scoreGoalie({ saves: 25, goalsAgainst: 3, decision: 'O' });
        assert.equal(pts(r, 'otLoss'), 1);
        assert.equal(r.total, 9);   // 1 (jatkoaikatappio) + 11 (torjunnat) - 3 (päästetyt)
    });

    test('häviö vie kaksi pistettä', () => {
        assert.equal(pts(scoreGoalie({ decision: 'L' }), 'loss'), -2);
    });

    test('nollapeli edellyttää voittoa', () => {
        const r = scoreGoalie({ saves: 20, goalsAgainst: 0, decision: 'O' });
        assert.equal(r.breakdown.find((x) => x.key === 'shutout'), undefined);
    });

    test('pelaamaton vahti ei saa ratkaisupisteitä', () => {
        const r = scoreGoalie({ saves: 0, goalsAgainst: 0, decision: '' });
        assert.equal(r.total, 0);
    });

    test('maalivahdin maali on 25 pistettä', () => {
        assert.equal(pts(scoreGoalie({ goals: 1 }), 'goals'), 25);
    });

    /** Boxscoren maalivahtirivillä ei ole syöttöjä; palvelin laskee ne maalitapahtumista. */
    test('maalivahdin syöttö tulee maalitapahtumista', () => {
        const r = scoreGoalie({ assists: 0, eventAssists: 1, saves: 20, goalsAgainst: 2, decision: 'W' });
        assert.equal(pts(r, 'assists'), 10);
        assert.equal(r.total, 10 + 4 + 9 - 2);
    });

    test('jaettu nollapeli ei ole kummankaan vahdin', () => {
        const r = scoreGoalie({ saves: 12, goalsAgainst: 0, decision: 'W', fullGame: false });
        assert.equal(r.breakdown.find((x) => x.key === 'shutout'), undefined);
    });

    test('maalivahdin jäähyt: pieni −1', () => {
        const r = scoreGoalie({ saves: 30, goalsAgainst: 2, decision: 'W', penalties: { minor: 1 } });
        assert.equal(pts(r, 'penalties'), -1);
        assert.equal(r.total, 4 + 13 - 2 - 1);
    });
});
