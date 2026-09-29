import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { getGameDayDate, toApiDate, GAME_DAY_SWITCH_HOUR } from '../src/utils/dates.js';

/** Suomen aika ISO-muodossa ilman vyöhykettä -> oikea hetki. */
const helsinki = (iso) => new Date(`${iso}+03:00`);   // kesäaika
const helsinkiTalvi = (iso) => new Date(`${iso}+02:00`);

describe('ottelukierroksen päivä', () => {
    test('vaihtumisaika on klo 18', () => {
        assert.equal(GAME_DAY_SWITCH_HOUR, 18);
    });

    /*
     * NHL merkitsee ottelut Pohjois-Amerikan päivämäärällä. Yöllä 26.–27.9.
     * pelatut ottelut ovat kierrosta 2026-09-26, ja ne halutaan nähdä vielä
     * seuraavana iltapäivänä.
     */
    test('iltapäivällä näytetään edellisen yön kierros', () => {
        assert.equal(toApiDate(getGameDayDate(helsinki('2026-09-27T14:27:00'))), '2026-09-26');
    });

    test('aamulla näytetään yhä saman yön kierros', () => {
        assert.equal(toApiDate(getGameDayDate(helsinki('2026-09-27T08:00:00'))), '2026-09-26');
    });

    test('yöllä kesken otteluiden näytetään käynnissä oleva kierros', () => {
        assert.equal(toApiDate(getGameDayDate(helsinki('2026-09-27T03:30:00'))), '2026-09-26');
    });

    test('klo 17.59 ollaan yhä edellisessä kierroksessa', () => {
        assert.equal(toApiDate(getGameDayDate(helsinki('2026-09-27T17:59:00'))), '2026-09-26');
    });

    test('klo 18.00 siirrytään tulevan yön kierrokseen', () => {
        assert.equal(toApiDate(getGameDayDate(helsinki('2026-09-27T18:00:00'))), '2026-09-27');
    });

    test('illalla myöhään näytetään tulevan yön kierros', () => {
        assert.equal(toApiDate(getGameDayDate(helsinki('2026-09-27T23:30:00'))), '2026-09-27');
    });

    test('toimii myös talviaikaan', () => {
        assert.equal(toApiDate(getGameDayDate(helsinkiTalvi('2026-01-15T14:00:00'))), '2026-01-14');
        assert.equal(toApiDate(getGameDayDate(helsinkiTalvi('2026-01-15T19:00:00'))), '2026-01-15');
    });

    test('kuukauden vaihde menee oikein', () => {
        assert.equal(toApiDate(getGameDayDate(helsinki('2026-10-01T10:00:00'))), '2026-09-30');
    });
});
