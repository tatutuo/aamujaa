import { Router } from 'express';
import { getPredictions, listPredictionDates, getAccuracy } from '../lib/db.js';
import { runPredictions, scoreYesterday, getStatus } from '../predictions/index.js';
import { toDateString, isValidDateString } from '../lib/dates.js';
import { config } from '../config.js';

const router = Router();

const asyncRoute = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.get('/dates', (req, res) => {
    res.json(listPredictionDates(60));
});

router.get('/accuracy', (req, res) => {
    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 30, 1), 365);
    res.json(getAccuracy(days));
});

router.get('/', (req, res) => {
    const date = req.query.date ?? toDateString();

    if (!isValidDateString(date)) {
        return res.status(400).json({ error: 'Virheellinen päivämäärä' });
    }

    const stored = getPredictions(date);

    if (!stored) {
        // Selkeä tyhjä vastaus 200:lla — frontendin on helpompi näyttää
        // "ei ennusteita tälle päivälle" kuin käsitellä virhetilaa.
        return res.json({ date, players: [], teams: [], matches: [], available: false });
    }

    res.set('Cache-Control', 'public, max-age=300');
    res.json({ ...stored, available: true });
});

/**
 * Ennusteiden pakotettu uudelleenlaskenta.
 *
 * Vanhassa versiossa tämä oli suojaamaton GET-reitti: kuka tahansa saattoi
 * käynnistää raskaan laskennan niin monta kertaa kuin halusi. Nyt tarvitaan
 * ADMIN_TOKEN, ja reitti on POST koska se muuttaa palvelimen tilaa.
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
