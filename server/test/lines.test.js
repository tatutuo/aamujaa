import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { assignForwardSlots, orderDefence, splitUnit, penaltyKillUnits } from '../src/services/lines.js';

const p = (id, pos, shoots, faceoffs = 0) => ({ id, pos, shoots, faceoffs });
const slots = (list) => list.map((x) => `${x.id}:${x.slot}`);

describe('ketjun paikat', () => {
    test('keskushyökkääjä on aloitukset ottanut, vaikka nimilistassa laitahyökkääjä', () => {
        const line = assignForwardSlots([p('a', 'L', 'L', 0), p('b', 'L', 'R', 14), p('c', 'R', 'R', 1)]);
        assert.deepEqual(slots(line), ['a:L', 'b:C', 'c:R']);
    });

    test('kaksi vasenta laitaa: oikealta laukova siirtyy oikealle', () => {
        const line = assignForwardSlots([p('a', 'L', 'R'), p('b', 'C', 'L', 12), p('c', 'L', 'L')]);
        assert.deepEqual(slots(line), ['c:L', 'b:C', 'a:R']);
    });

    test('ilman aloituksia keskushyökkääjäksi nimilistan C', () => {
        const line = assignForwardSlots([p('a', 'R', 'R'), p('b', 'L', 'L'), p('c', 'C', 'L')]);
        assert.deepEqual(slots(line), ['b:L', 'c:C', 'a:R']);
    });

    test('puolustajapari: vasemmalta laukova vasemmalle', () => {
        assert.deepEqual(slots(orderDefence([p('a', 'D', 'R'), p('b', 'D', 'L')])), ['b:LD', 'a:RD']);
    });

    test('ylivoimakenttä jaetaan hyökkääjiin ja puolustajiin, laitoja ei nimetä', () => {
        const unit = splitUnit([p('d', 'D', 'L'), p('a', 'L', 'L'), p('b', 'C', 'L', 9), p('c', 'R', 'R'), p('e', 'C', 'R', 2)]);
        assert.deepEqual(unit.defence.map((x) => x.id), ['d']);
        assert.equal(unit.forwards.length, 4);
        assert.equal(unit.forwards.find((x) => x.slot === 'C').id, 'b');
        assert.ok(unit.forwards.filter((x) => x.id !== 'b').every((x) => x.slot === 'F'));
    });

    test('alivoimakentät kootaan pareista: kaksi hyökkääjää ja kaksi puolustajaa', () => {
        const roster = new Map([p(1, 'C', 'L', 10), p(2, 'L', 'L'), p(3, 'D', 'R'), p(4, 'D', 'L'), p(5, 'C', 'R', 4), p(6, 'R', 'R')].map((x) => [x.id, x]));
        const toPlayers = (ids) => ids.map((id) => roster.get(id));
        const units = penaltyKillUnits(
            [{ ids: [1, 2], seconds: 90 }, { ids: [5, 6], seconds: 40 }],
            [{ ids: [3, 4], seconds: 100 }],
            toPlayers,
        );
        assert.equal(units.length, 2);
        assert.deepEqual(slots(units[0].forwards), ['2:F', '1:C']);
        assert.deepEqual(slots(units[0].defence), ['4:LD', '3:RD']);
        assert.equal(units[0].defenceSeconds, 100);
        assert.deepEqual(units[1].defence, []);
        assert.equal(units[1].defenceSeconds, undefined);
    });
});
