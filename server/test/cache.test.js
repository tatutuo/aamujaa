import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { getOrFetch, sweep, cacheStats, invalidate } from '../src/lib/cache.js';

describe('välimuistin siivous', () => {
    test('tuore merkintä säilyy, kauan sitten vanhentunut poistuu', async () => {
        invalidate('t:');
        await getOrFetch('t:fresh', 60_000, async () => 1);
        await getOrFetch('t:old', 1, async () => 2);

        const before = cacheStats().entries;
        // Kolmen tunnin päästä: lyhyen merkinnän varoaika (2 h) on ohi.
        const removed = sweep(Date.now() + 3 * 60 * 60_000);
        assert.ok(removed >= 2, 'molemmat ovat siinä vaiheessa yli varoajan');
        assert.ok(cacheStats().entries < before);
    });

    test('vanhentunut merkintä säilyy varoajan, jotta sitä voi tarjota rajapinnan ollessa nurin', async () => {
        invalidate('t:');
        await getOrFetch('t:grace', 1, async () => 'vanha');
        sweep(Date.now() + 60_000); // minuutti myöhemmin: vanhentunut mutta varoajalla

        const value = await getOrFetch('t:grace', 1, async () => { throw new Error('nurin'); });
        assert.equal(value, 'vanha');
    });
});
