import { web } from '../lib/nhlApi.js';
import { toDateString, addDays } from '../lib/dates.js';
import { config } from '../config.js';
import { savePredictions, getPredictions, saveResult } from '../lib/db.js';
import { generatePlayerPredictions } from './players.js';
import { generateTeamPredictions } from './teams.js';
import { generateMatchPredictions } from './matches.js';

/**
 * Ennusteiden ajastus ja ajo.
 *
 * Ennusteet lasketaan kerran vuorokaudessa klo 09:00 Suomen aikaa, kun edellisen
 * yön ottelut ovat päättyneet ja NHL:n tilastot päivittyneet.
 */

let running = false;
let lastRun = null;

export function getStatus() {
    return { running, lastRun, enabled: config.predictionsEnabled };
}

export async function runPredictions({ force = false, date = toDateString() } = {}) {
    if (running) {
        return { skipped: true, reason: 'Ajo on jo käynnissä' };
    }

    if (!force && getPredictions(date)) {
        return { skipped: true, reason: 'Päivän ennusteet on jo laskettu' };
    }

    running = true;
    const startedAt = Date.now();

    try {
        console.log(`[ennusteet] Aloitetaan laskenta päivälle ${date}`);

        // Kolme mallia ovat toisistaan riippumattomia, joten ne ajetaan rinnakkain.
        // allSettled: yhden mallin kaatuminen ei saa hukata kahta muuta.
        const [players, teams, matches] = await Promise.allSettled([
            generatePlayerPredictions(),
            generateTeamPredictions(),
            generateMatchPredictions(date),
        ]);

        const result = {
            players: players.status === 'fulfilled' ? players.value : [],
            teams: teams.status === 'fulfilled' ? teams.value : [],
            matches: matches.status === 'fulfilled' ? matches.value : [],
        };

        for (const [name, outcome] of [['pelaajat', players], ['joukkueet', teams], ['ottelut', matches]]) {
            if (outcome.status === 'rejected') {
                console.error(`[ennusteet] ${name} epäonnistui:`, outcome.reason?.message ?? outcome.reason);
            }
        }

        // Ei tallenneta täysin tyhjää ajoa vanhan päälle — se pyyhkisi eilisen
        // toimivat ennusteet jos NHL:n rajapinta sattuu olemaan nurin.
        const isEmpty = result.players.length === 0 && result.teams.length === 0 && result.matches.length === 0;
        if (isEmpty) {
            console.warn('[ennusteet] Kaikki mallit palauttivat tyhjää — ei tallenneta');
            return { skipped: true, reason: 'Ulkoisesta rajapinnasta ei saatu dataa' };
        }

        savePredictions(date, result);
        lastRun = new Date().toISOString();

        const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
        console.log(
            `[ennusteet] Valmis ${seconds}s: ${result.players.length} pelaajaa, ` +
            `${result.teams.length} joukkuetta, ${result.matches.length} ottelua`,
        );

        return { ok: true, date, counts: {
            players: result.players.length,
            teams: result.teams.length,
            matches: result.matches.length,
        } };
    } finally {
        running = false;
    }
}

/**
 * Tarkistaa eilisen otteluennusteiden osumatarkkuuden.
 * Ilman tätä mallia ei voi kehittää — nyt näkee mustaa valkoisella osuuko se.
 */
export async function scoreYesterday(date = addDays(toDateString(), -1)) {
    const stored = getPredictions(date);
    if (!stored?.matches?.length) return { checked: 0 };

    const schedule = await web(`/score/${date}`).catch(() => null);
    const games = new Map((schedule?.games ?? []).map((g) => [g.id, g]));

    let checked = 0;

    for (const prediction of stored.matches) {
        const game = games.get(prediction.gameId);
        if (!game) continue;
        if (game.gameState !== 'FINAL' && game.gameState !== 'OFF') continue;

        const actualWinner = game.homeTeam.score > game.awayTeam.score ? prediction.home : prediction.away;
        const predictedWinner = prediction.homeWinProb >= 50 ? prediction.home : prediction.away;

        saveResult({
            gameId: prediction.gameId,
            date,
            predictedWinner,
            actualWinner,
            homeWinProb: prediction.homeWinProb,
            homeWinProbability: prediction.homeWinProbability ?? prediction.homeWinProb / 100,
            homeWon: actualWinner === prediction.home ? 1 : 0,
            correct: predictedWinner === actualWinner ? 1 : 0,
        });
        checked++;
    }

    if (checked > 0) console.log(`[ennusteet] Tarkistettu ${checked} ottelun tulos päivältä ${date}`);
    return { checked };
}

/**
 * Ajastin joka herää joka päivä klo 09:00 Suomen aikaa.
 *
 * Toteutus laskee eron seuraavaan yhdeksään ja ajastaa yhden setTimeoutin
 * kerrallaan — ei setIntervalia, joka ajautuisi pikkuhiljaa pieleen eikä
 * ottaisi kesäajan vaihtumista huomioon.
 */
export function startScheduler() {
    if (!config.predictionsEnabled) {
        console.log('[ennusteet] Automaattiajo pois päältä (PREDICTIONS_ENABLED=false)');
        return;
    }

    const scheduleNext = () => {
        const delay = millisecondsUntilNextRun();
        const at = new Date(Date.now() + delay);
        console.log(`[ennusteet] Seuraava ajo: ${at.toLocaleString('fi-FI', { timeZone: config.timezone })}`);

        setTimeout(async () => {
            try {
                await scoreYesterday();
                await runPredictions();
            } catch (err) {
                console.error('[ennusteet] Ajastettu ajo epäonnistui:', err.message);
            } finally {
                scheduleNext();
            }
        }, delay).unref?.();
    };

    // Ensimmäinen ajo heti käynnistyksessä, jos päivän ennusteita ei vielä ole.
    runPredictions().catch((err) => console.error('[ennusteet] Käynnistysajo epäonnistui:', err.message));
    scheduleNext();
}

const RUN_HOUR = 9;

function millisecondsUntilNextRun(now = new Date()) {
    // Nykyinen paikallinen aika Suomessa, riippumatta palvelimen aikavyöhykkeestä.
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: config.timezone,
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: false,
    }).formatToParts(now);

    const get = (type) => Number(parts.find((p) => p.type === type).value);
    const hour = get('hour') % 24;
    const secondsIntoDay = hour * 3600 + get('minute') * 60 + get('second');
    const target = RUN_HOUR * 3600;

    const secondsUntil = secondsIntoDay < target
        ? target - secondsIntoDay
        : 24 * 3600 - secondsIntoDay + target;

    return secondsUntil * 1000;
}
