import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { shotFeatures, xgOf, EMPTY_NET_XG } from '../src/lib/xg.js';

const HOME = 10;
const AWAY = 20;

/** Kotijoukkueen laukaus; koti puolustaa vasenta päätyä eli hyökkää oikealle (x = 89). */
const shot = (x, y, extra = {}) => ({
    typeDescKey: 'shot-on-goal',
    timeInPeriod: '10:00',
    situationCode: '1551',
    homeTeamDefendingSide: 'left',
    periodDescriptor: { number: 1, periodType: 'REG' },
    details: { xCoord: x, yCoord: y, eventOwnerTeamId: HOME, shotType: 'wrist', zoneCode: 'O' },
    ...extra,
});

const xgAt = (x, y, extra) => xgOf(shotFeatures([shot(x, y, extra)], 0, HOME));

describe('odotetut maalit', () => {
    test('läheltä ja edestä vaarallisempi kuin kaukaa', () => {
        const close = xgAt(80, 0);
        const far = xgAt(30, 0);
        // Datassa 0–10 ft noin 13 %, 45+ ft alle 2 %.
        assert.ok(close > 0.1, `läheltä ${close}`);
        assert.ok(far < 0.05, `kaukaa ${far}`);
        assert.ok(close > far * 4);
    });

    test('jyrkästä kulmasta vähemmän kuin suoraan edestä samalta etäisyydeltä', () => {
        assert.ok(xgAt(74, 0) > xgAt(85, 15));
    });

    test('vierasjoukkueen hyökkäyssuunta huomioidaan', () => {
        const away = shot(-80, 0, { details: { xCoord: -80, yCoord: 0, eventOwnerTeamId: AWAY, shotType: 'wrist' } });
        const f = shotFeatures([away], 0, HOME);
        assert.equal(f.distance, 9);
    });

    test('tyhjä maali ja rangaistuslaukaus', () => {
        // Vierasmaalivahti pois (ensimmäinen numero 0): kotijoukkue laukoo tyhjään.
        assert.equal(xgAt(30, 0, { situationCode: '0651' }), EMPTY_NET_XG);
        assert.equal(shotFeatures([shot(80, 0, { situationCode: '0101' })], 0, HOME), null);
    });

    test('blokattu laukaus ja voittolaukauskilpailu eivät ole mukana', () => {
        assert.equal(shotFeatures([shot(80, 0, { typeDescKey: 'blocked-shot' })], 0, HOME), null);
        assert.equal(shotFeatures([shot(80, 0, { periodDescriptor: { number: 5, periodType: 'SO' } })], 0, HOME), null);
    });

    test('todennäköisyys pysyy välillä 0–1', () => {
        for (const [x, y] of [[89, 0], [100, 30], [-100, -42], [0, 0]]) {
            const p = xgAt(x, y);
            assert.ok(p > 0 && p < 1, `${x},${y}: ${p}`);
        }
    });
});
