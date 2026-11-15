import { Router } from 'express';
import { getPredictions, listPredictionDates, getAccuracy, getSeasonAccuracy } from '../lib/db.js';
import { runPredictions, scoreYesterday, getStatus } from '../predictions/index.js';
import { MODEL_INFO, DEFAULT_PARAMS } from '../predictions/matches.js';
import { toDateString, isValidDateString, addDays } from '../lib/dates.js';
import { getSeasonId } from '../lib/season.js';
import { config } from '../config.js';

const router = Router();

const asyncRoute = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** Kauden alku tarkkuuslaskentaan (syyskuun alusta). */
const seasonStart = () => `${getSeasonId().slice(0, 4)}-09-01`;

router.get('/dates', (req, res) => {
    res.json(listPredictionDates(60));
});

router.get('/accuracy', (req, res) => {
    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 30, 1), 365);
    res.json(getAccuracy(days));
});

/**
 * Etusivun ottelukorttien todennäköisyyspalkit: vain luvut, ei laskentaa.
 * Tyhjä lista, jos päivälle ei ole ennusteita.
 */
router.get('/summary', (req, res) => {
    const date = req.query.date ?? toDateString();
    if (!isValidDateString(date)) return res.status(400).json({ error: 'Virheellinen päivämäärä' });

    const stored = getPredictions(date);
    const games = (stored?.matches ?? []).map((m) => ({
        gameId: m.gameId,
        home: m.home,
        away: m.away,
        homeWinProb: m.homeWinProb,
        awayWinProb: m.awayWinProb,
        otProb: m.otProb,
    }));
    res.set('Cache-Control', 'public, max-age=300');
    res.json({ date, games });
});

/**
 * Yhden ottelun ennuste laskentavaiheineen ja mallin kauden tarkkuus.
 * `date` nopeuttaa hakua; ilman sitä etsitään viimeisimmistä päivistä.
 */
router.get('/game/:id', (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Virheellinen ottelu-ID' });

    const date = req.query.date;
    const candidates = date && isValidDateString(date)
        ? [date, addDays(date, -1), addDays(date, 1)]
        : listPredictionDates(200);

    let prediction = null;
    for (const d of candidates) {
        prediction = getPredictions(d)?.matches?.find((m) => m.gameId === id) ?? null;
        if (prediction) break;
    }

    res.set('Cache-Control', 'public, max-age=120');
    res.json({
        available: Boolean(prediction),
        enabled: config.predictionsEnabled,
        prediction,
        accuracy: getSeasonAccuracy(seasonStart()),
        model: { ...MODEL_INFO, params: DEFAULT_PARAMS },
    });
});

router.get('/', (req, res) => {
    const date = req.query.date ?? toDateString();

    if (!isValidDateString(date)) {
        return res.status(400).json({ error: 'Virheellinen päivämäärä' });
    }

    const stored = getPredictions(date);

    if (!stored) {
        return res.json({ date, matches: [], available: false });
    }

    res.set('Cache-Control', 'public, max-age=300');
    res.json({ date, matches: stored.matches, available: true });
});

/**
 * Ennusteiden pakotettu uudelleenlaskenta.
 *
 * Vaatii ADMIN_TOKENin, ja reitti on POST koska se muuttaa palvelimen tilaa.
 */
function requireAdmin(req, res, next) {
    if (!config.adminToken) {
        return res.status(503).json({ error: 'Admin-reitit eivät ole käytössä (ADMIN_TOKEN puuttuu)' });
    }
    const token = req.get('x-admin-token');
    if (token !== config.adminToken) {
        return res.status(401).json({ error: 'Ei oikeuksia' });
    }
    next();
}

router.get('/status', requireAdmin, (req, res) => res.json(getStatus()));

router.post('/run', requireAdmin, asyncRoute(async (req, res) => {
    const result = await runPredictions({ force: true });
    res.json(result);
}));

router.post('/score', requireAdmin, asyncRoute(async (req, res) => {
    res.json(await scoreYesterday());
}));

export default router;
