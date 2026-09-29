import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { parseCsv } from '../src/services/moneypuck.js';

describe('parseCsv', () => {
    test('muuntaa numerot luvuiksi ja jättää tekstit merkkijonoiksi', () => {
        const rows = parseCsv('playerId,name,team,xGoals\n8478402,Connor McDavid,EDM,43.61\n');
        assert.deepEqual(rows, [{ playerId: 8478402, name: 'Connor McDavid', team: 'EDM', xGoals: 43.61 }]);
    });

    test('lainausmerkeissä oleva pilkku ei katkaise kenttää', () => {
        const rows = parseCsv('name,team\n"Smith, Jr.",NYR\n');
        assert.equal(rows[0].name, 'Smith, Jr.');
        assert.equal(rows[0].team, 'NYR');
    });

    test('tyhjä kenttä on null eikä nolla', () => {
        const rows = parseCsv('a,b\n1,\n');
        assert.equal(rows[0].a, 1);
        assert.equal(rows[0].b, null);
    });

    test('toistuva sarakenimi: ensimmäinen arvo voittaa', () => {
        // Joukkuetiedostossa "team" on kahdesti.
        const rows = parseCsv('team,season,team\nNYR,2025,XXX\n');
        assert.equal(rows[0].team, 'NYR');
    });

    test('pelkkä otsikkorivi tai tyhjä tiedosto antaa tyhjän listan', () => {
        assert.deepEqual(parseCsv('a,b\n'), []);
        assert.deepEqual(parseCsv(''), []);
    });

    test('Windowsin rivinvaihdot', () => {
        const rows = parseCsv('a,b\r\n1,2\r\n');
        assert.deepEqual(rows, [{ a: 1, b: 2 }]);
    });
});
