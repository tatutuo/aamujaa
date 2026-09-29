import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { accentFromTeam, contrast, isVivid, DEFAULT_ACCENT, MIN_CONTRAST } from '../src/utils/colour.js';
import { teamColors } from '../src/utils/teamColors.js';

const CARD = { dark: '#25292e', light: '#ffffff' };

describe('korostusväri suosikkijoukkueesta', () => {
    /*
     * Tärkein ominaisuus: millä tahansa joukkueella korostus on luettava.
     * Monen joukkueen pääväri on tummansininen, joka katoaisi grafiittiin.
     */
    for (const theme of ['dark', 'light']) {
        test(`kaikkien 32 joukkueen korostus on luettava (${theme})`, () => {
            for (const [abbrev, colours] of Object.entries(teamColors)) {
                const { accent } = accentFromTeam(colours, theme);
                const ratio = contrast(accent, CARD[theme]);
                assert.ok(ratio >= MIN_CONTRAST, `${abbrev}: ${accent} kontrasti ${ratio.toFixed(2)}`);
            }
        });
    }

    test('sävy säilyy: Leafsin korostus on sininen, Canesin punainen', () => {
        const blue = accentFromTeam(teamColors.TOR, 'dark').accent;
        const red = accentFromTeam(teamColors.CAR, 'dark').accent;
        const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
        const [br, , bb] = hex(blue);
        const [rr, , rb] = hex(red);
        assert.ok(bb > br, `sininen ${blue}`);
        assert.ok(rr > rb, `punainen ${red}`);
    });

    test('mustavalkoinen joukkue saa toissijaisen värinsä tai oletuksen', () => {
        // LAK: musta + hopea -> kumpikaan ei ole kylläinen -> oletus.
        assert.deepEqual(accentFromTeam(teamColors.LAK, 'dark'), DEFAULT_ACCENT.dark);
    });

    test('ilman suosikkia käytetään jääsinistä', () => {
        assert.deepEqual(accentFromTeam(undefined, 'dark'), DEFAULT_ACCENT.dark);
        assert.deepEqual(accentFromTeam(undefined, 'light'), DEFAULT_ACCENT.light);
    });

    test('teksti korostuspinnan päällä on luettava', () => {
        for (const colours of Object.values(teamColors)) {
            const { accent, onAccent } = accentFromTeam(colours, 'dark');
            assert.ok(contrast(onAccent, accent) >= MIN_CONTRAST, `${onAccent} / ${accent}`);
        }
    });
});

describe('kylläisyys', () => {
    test('harmaat eivät kelpaa korostukseksi', () => {
        assert.equal(isVivid('#000000'), false);
        assert.equal(isVivid('#FFFFFF'), false);
        assert.equal(isVivid('#8F8F8C'), false);
        assert.equal(isVivid('#CE1126'), true);
    });
});
