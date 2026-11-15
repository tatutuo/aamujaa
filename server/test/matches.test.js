import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { computeMatchPredictions, DEFAULT_PARAMS } from '../src/predictions/matches.js';

/** Liiga, jossa joukkueet ovat keskitasoa, paitsi vahva STR ja heikko WEA. */
function inputs({ backToBack = [] } = {}) {
    const team = (abbrev, sf, sa, gf, ga) => ({
        abbrev, teamFullName: abbrev, gamesPlayed: 10, goalsFor: gf, goalsAgainst: ga,
        shotsForPerGame: sf, shotsAgainstPerGame: sa, powerPlayPct: 0.2, penaltyKillPct: 0.8,
    });
    const others = Array.from({ length: 30 }, (_, i) => team(`T${i}`, 28, 28, 30, 30));
    return {
        date: '2026-11-01',
        season: '20262027',
        games: [{ id: 1, startTimeUTC: '2026-11-01T23:00:00Z', gameType: 2, home: 'STR', away: 'WEA' }],
        teamStats: [team('STR', 33, 24, 38, 22), team('WEA', 24, 33, 22, 38), ...others],
        previousTeamStats: [],
        goalies: {},
        standings: {},
        backToBack,
        restDays: { STR: 1, WEA: 1 },
        restEffects: [],
        corsi: {},
    };
}

describe('otteluennuste', () => {
    test('vaiheiden kertoimet tuottavat täsmälleen odotetut maalit', () => {
        const [p] = computeMatchPredictions(inputs());
        for (const side of ['home', 'away']) {
            const steps = p.steps[side];
            const product = steps.slice(1).reduce((v, s) => v * s.factor, steps[0].value);
            assert.ok(Math.abs(product - p.expectedGoals[side]) < 0.02, `${side}: ${product} vs ${p.expectedGoals[side]}`);
        }
    });

    test('vahvempi kotijoukkue on suosikki ja todennäköisyydet summautuvat', () => {
        const [p] = computeMatchPredictions(inputs());
        assert.ok(p.homeWinProb > 60, `koti ${p.homeWinProb}`);
        assert.equal(p.homeWinProb + p.awayWinProb, 100);
        assert.ok(p.topScores.length === 5);
    });

    test('peräkkäiset pelipäivät heikentävät joukkueen ennustetta', () => {
        const [rested] = computeMatchPredictions(inputs());
        const [tired] = computeMatchPredictions({
            ...inputs({ backToBack: ['STR'] }),
            restEffects: [[0, { attack: 0.95, defence: 1.03 }], [1, { attack: 1, defence: 1 }]],
        });
        assert.ok(tired.homeWinProbability < rested.homeWinProbability);
    });

    test('nollapainoiset vaiheet (muoto, erikoistilanteet) eivät näy laskennassa', () => {
        const [p] = computeMatchPredictions(inputs());
        const keys = p.steps.home.map((s) => s.key);
        if (DEFAULT_PARAMS.formMax === 0) assert.ok(!keys.includes('form'));
        if (DEFAULT_PARAMS.specialScale === 0) assert.ok(!keys.includes('special'));
    });
});
