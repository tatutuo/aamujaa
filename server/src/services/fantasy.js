import { web, mapWithConcurrency } from '../lib/nhlApi.js';
import { getOrFetch, TTL } from '../lib/cache.js';

/**
 * Fantasy-pisteytyksen tarvitsemat ottelutapahtumat pelaajittain.
 *
 * Boxscore antaa perustilastot (maalit, syötöt, laukaukset, taklaukset,
 * torjunnat), mutta ei sitä mikä Hockey GM:n säännöissä ratkaisee pisteet:
 * oliko maali alivoimalla, jatkoajalla vai voittomaali, minkä tyyppisiä jäähyjä
 * pelaaja otti, ja paljonko aloituksia hän voitti ja hävisi.
 *
 * Tämä palvelu kokoaa ne yhteen vastaukseen, jotta selaimen ei tarvitse hakea
 * ja tulkita kahta raakadatalähdettä.
 */

/** Jäähyn pistearvo tyypin mukaan (Hockey GM). */
function penaltyCategory(details) {
    const { typeCode, duration, descKey } = details;

    // Penkkijäähyt jätetään pois: säännöissä pisteitä annetaan vain
    // henkilökohtaisista jäähyistä. Ne tunnistaa myös siitä, ettei
    // committedByPlayerId-kenttää ole.
    if (typeCode === 'BEN') return null;

    // Rangaistuslaukaus ei ole pelaajalle jäähy, vaan vastustajalle laukaus.
    if (typeCode === 'PS') return null;

    if (typeCode === 'MIN') {
        // Kaksoispieni (4 min) on kaksi kahden minuutin jäähyä.
        return { key: 'minor', count: Math.max(1, Math.round((duration ?? 2) / 2)) };
    }
    if (typeCode === 'MAJ') {
        return descKey === 'fighting'
            ? { key: 'fightingMajor', count: 1 }
            : { key: 'otherMajor', count: 1 };
    }
    if (typeCode === 'MIS') return { key: 'misconduct', count: 1 };
    if (typeCode === 'GAM') return { key: 'gameMisconduct', count: 1 };
    if (typeCode === 'MAT') return { key: 'matchPenalty', count: 1 };

    return null;
}

const emptyPlayer = () => ({
    // Maalitapahtumista lasketut maalit ja syötöt. Tarvitaan maalivahdeille,
    // joiden boxscore-rivillä niitä ei ole lainkaan.
    eventGoals: 0,
    eventAssists: 0,
    shorthandedGoals: 0,
    shorthandedAssists: 0,
    overtimeGoals: 0,
    gameWinningGoals: 0,
    faceoffWins: 0,
    faceoffLosses: 0,
    penalties: {
        minor: 0,
        fightingMajor: 0,
        otherMajor: 0,
        misconduct: 0,
        gameMisconduct: 0,
        matchPenalty: 0,
    },
});

export async function getFantasyEvents(gameId) {
    return getOrFetch(`fantasy:${gameId}`, TTL.boxscore, async () => {
        const [landing, pbp] = await Promise.all([
            web(`/gamecenter/${gameId}/landing`),
            web(`/gamecenter/${gameId}/play-by-play`),
        ]);

        const players = new Map();
        const get = (id) => {
            if (!players.has(id)) players.set(id, emptyPlayer());
            return players.get(id);
        };

        // --- Maalit: alivoima, jatkoaika ja voittomaali ---
        //
        // Maalit ja syötöt itsessään luetaan boxscoresta; täällä kirjataan vain
        // ne lisämääreet, joita boxscore ei kerro.
        const scoring = landing.summary?.scoring ?? [];

        const goalsInOrder = scoring.flatMap((period) =>
            (period.goals ?? []).map((goal) => ({ ...goal, period: period.periodDescriptor })),
        );

        for (const goal of goalsInOrder) {
            const isShootout = goal.period?.periodType === 'SO';

            // Voittolaukausmaalit eivät ole pelaajan maaleja NHL:n tilastoissa
            // (boxscore ei laske niitä), joten niitä ei pisteytetä maaleina.
            if (isShootout) continue;

            const scorer = get(goal.playerId);
            scorer.eventGoals += 1;
            for (const assist of goal.assists ?? []) get(assist.playerId).eventAssists += 1;

            if (goal.strength === 'sh') {
                scorer.shorthandedGoals += 1;
                for (const assist of goal.assists ?? []) {
                    get(assist.playerId).shorthandedAssists += 1;
                }
            }

            if (goal.period?.periodType === 'OT') scorer.overtimeGoals += 1;
        }

        // Voittomaali on voittajan (häviäjän maalit + 1). maali. Voittolaukauskilpailussa
        // NHL listaa maaleihin vain ratkaisevan laukauksen, ja se saa säännöissä
        // voittomaalin pisteet.
        const homeScore = landing.homeTeam?.score ?? 0;
        const awayScore = landing.awayTeam?.score ?? 0;
        if (homeScore !== awayScore) {
            const winnerIsHome = homeScore > awayScore;
            const loserGoals = Math.min(homeScore, awayScore);
            const winnerGoals = goalsInOrder.filter((g) => Boolean(g.isHome) === winnerIsHome);
            const decider = winnerGoals[loserGoals];
            if (decider) get(decider.playerId).gameWinningGoals += 1;
        }

        // --- Jäähyt ja aloitukset play-by-playsta ---
        for (const play of pbp.plays ?? []) {
            const d = play.details ?? {};

            if (play.typeDescKey === 'penalty') {
                const playerId = d.committedByPlayerId;
                if (!playerId) continue;
                const category = penaltyCategory(d);
                if (!category) continue;
                get(playerId).penalties[category.key] += category.count;
                continue;
            }

            if (play.typeDescKey === 'faceoff') {
                if (d.winningPlayerId) get(d.winningPlayerId).faceoffWins += 1;
                if (d.losingPlayerId) get(d.losingPlayerId).faceoffLosses += 1;
            }
        }

        // --- Tähdet ---
        const stars = {};
        for (const star of landing.summary?.threeStars ?? []) {
            if (star.playerId) stars[star.playerId] = Number(star.star);
        }

        return {
            gameId: Number(gameId),
            // 2 = runkosarja, 3 = pudotuspelit.
            gameType: landing.gameType ?? 2,
            players: Object.fromEntries(players),
            stars,
        };
    });
}

/** Ottelut jotka eivät ole vielä alkaneet — niistä ei ole tilastoja. */
const NOT_STARTED = new Set(['FUT', 'PRE']);

/**
 * Fantasy-joukkueen pelaajien tilastot päivän otteluista yhtenä vastauksena.
 *
 * Etusivun pelaajakortit näyttävät pisteet ottelun edetessä, joten pyyntöjä
 * tulee tiheään. Yksi kutsu koko joukkueelle on kevyempi kuin kuusi erillistä,
 * ja päivän ottelut ovat joka tapauksessa jo välimuistissa.
 *
 * Pisteitä ei lasketa täällä vaan selaimessa: kapteenin kerroin riippuu
 * käyttäjän valinnasta, joka on vain laitteen omassa muistissa. Palvelin
 * palauttaa siis vain ne tilastot joita sääntökirja tarvitsee.
 */
export async function getFantasyStats(playerIds, date) {
    const wanted = new Set(playerIds.map(Number));
    if (wanted.size === 0) return { date, players: {} };

    const score = await web(`/score/${date}`);
    const games = (score.games ?? []).filter((g) => !NOT_STARTED.has(g.gameState));

    const loaded = await mapWithConcurrency(games, 4, async (game) => {
        const [box, events] = await Promise.all([
            web(`/gamecenter/${game.id}/boxscore`),
            getFantasyEvents(game.id),
        ]);
        return { game, box, events };
    });

    const players = {};

    for (const entry of loaded) {
        if (!entry?.box?.playerByGameStats) continue;
        const { game, box, events } = entry;

        for (const side of ['awayTeam', 'homeTeam']) {
            const stats = box.playerByGameStats[side];
            if (!stats) continue;

            // Nollapeli edellyttää, että sama vahti pelasi koko ottelun.
            const goaliesUsed = (stats.goalies ?? []).filter((g) => g.toi && g.toi !== '00:00').length;

            for (const group of ['forwards', 'defense', 'goalies']) {
                for (const p of stats[group] ?? []) {
                    if (!wanted.has(Number(p.playerId))) continue;

                    // Pelaamaton varavahti ei ole "pelannut" vaikka onkin kokoonpanossa.
                    const played = group !== 'goalies' || (p.toi && p.toi !== '00:00');

                    players[p.playerId] = {
                        gameId: game.id,
                        gameState: game.gameState,
                        played,
                        position: p.position,
                        fullGame: group === 'goalies' ? goaliesUsed === 1 : undefined,
                        starRank: events?.stars?.[p.playerId] ?? null,
                        // Boxscoren perustilastot sellaisenaan. Mukana myös
                        // peliaika ja torjuntaprosentti, jotta pelaajakortti
                        // voi näyttää illan tilastorivin eikä vain pisteitä.
                        toi: p.toi ?? null,
                        goals: p.goals ?? 0,
                        assists: p.assists ?? 0,
                        plusMinus: p.plusMinus ?? 0,
                        sog: p.sog ?? 0,
                        hits: p.hits ?? 0,
                        blockedShots: p.blockedShots ?? 0,
                        saves: p.saves ?? 0,
                        shotsAgainst: p.shotsAgainst ?? 0,
                        savePctg: p.savePctg ?? 0,
                        goalsAgainst: p.goalsAgainst ?? 0,
                        decision: p.decision ?? '',
                        // Sääntökirjan tarvitsemat lisämääreet.
                        ...(events?.players?.[p.playerId] ?? emptyPlayer()),
                    };
                }
            }
        }
    }

    return { date, players };
}
