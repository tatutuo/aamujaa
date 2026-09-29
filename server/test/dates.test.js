import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { getAamujaaDate, GAME_DAY_SWITCH_HOUR } from '../src/lib/dates.js';

const helsinki = (iso) => new Date(`${iso}+03:00`);
const helsinkiTalvi = (iso) => new Date(`${iso}+02:00`);

describe('aamujää-päivä palvelimella', () => {
    test('vaihtumisaika on klo 18', () => {
        assert.equal(GAME_DAY_SWITCH_HOUR, 18);
    });

    test('iltapäivällä näytetään edellisen yön kierros', () => {
        assert.equal(getAamujaaDate(helsinki('2026-09-27T14:27:00')), '2026-09-26');
    });

    test('klo 17.59 ollaan yhä edellisessä kierroksessa', () => {
        assert.equal(getAamujaaDate(helsinki('2026-09-27T17:59:00')), '2026-09-26');
    });

    test('klo 18.00 siirrytään tulevan yön kierrokseen', () => {
        assert.equal(getAamujaaDate(helsinki('2026-09-27T18:00:00')), '2026-09-27');
    });

    test('yöllä kesken otteluiden näytetään käynnissä oleva kierros', () => {
        assert.equal(getAamujaaDate(helsinki('2026-09-27T03:30:00')), '2026-09-26');
    });

    /*
     * Tärkein tapaus palvelimelle: tulos ei saa riippua siitä, millä
     * aikavyöhykkeellä palvelin sattuu olemaan. Webhotelli on usein UTC:ssä.
     */
    test('tulos ei riipu palvelimen aikavyöhykkeestä', () => {
        const hetki = helsinki('2026-09-27T18:30:00');
        assert.equal(getAamujaaDate(hetki), '2026-09-27');
        assert.equal(getAamujaaDate(new Date(hetki.toISOString())), '2026-09-27');
    });

    test('toimii talviaikaan', () => {
        assert.equal(getAamujaaDate(helsinkiTalvi('2026-01-15T14:00:00')), '2026-01-14');
        assert.equal(getAamujaaDate(helsinkiTalvi('2026-01-15T19:00:00')), '2026-01-15');
    });

    test('kuukauden ja vuoden vaihde', () => {
        assert.equal(getAamujaaDate(helsinkiTalvi('2027-01-01T10:00:00')), '2026-12-31');
    });
});
