import express from 'express';
import compression from 'compression';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { config } from './config.js';
import { cacheStats } from './lib/cache.js';
import { NhlApiError } from './lib/nhlApi.js';
import { getSeasonId } from './lib/season.js';
import { stripBasePath } from './lib/basePath.js';
import nhlRoutes from './routes/nhl.js';
import predictionRoutes from './routes/predictions.js';
import feedbackRoutes from './routes/feedback.js';
import { startScheduler } from './predictions/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// Reverse proxyn (nginx/Caddy) takana ollaan, jotta rate limit näkee oikean IP:n.
app.set('trust proxy', 1);

const distDir = path.join(__dirname, '..', '..', 'dist');

/**
 * Frontendin juuritiedostot ja -kansiot (`index.html`, `assets`, `manifest…`).
 * Käytetään tunnistamaan, alkaako polku oikealla tiedostolla vai asennuksen
 * alipolulla. Luetaan kerran käynnistyksessä, ei joka pyynnöllä.
 */
const distEntries = fs.existsSync(distDir) ? new Set(fs.readdirSync(distDir)) : new Set();

// Alipolkuasennus (esim. d4nyyy.fi/hockey) — ks. lib/basePath.js.
app.use((req, res, next) => {
    req.url = stripBasePath(req.url, distEntries, config.basePath);
    next();
});

app.use(helmet({
    // Frontend on eri origin ja lataa kuvia NHL:n CDN:stä.
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false,
}));
app.use(compression());
app.use(express.json({ limit: '32kb' }));

app.use(cors({
    origin: config.corsOrigins.length > 0 ? config.corsOrigins : true,
    methods: ['GET', 'POST'],
}));

// Yleinen katto koko API:lle. Yksittäisillä reiteillä voi olla tiukempi raja.
app.use('/api', rateLimit({
    windowMs: 60_000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Liikaa pyyntöjä, hidasta hieman.' },
}));

// ---------------------------------------------------------------------------
// Reitit
// ---------------------------------------------------------------------------

app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        season: getSeasonId(),
        uptime: Math.round(process.uptime()),
        cache: cacheStats(),
        // Muistinkulutus megatavuina: webhotellin raja on 512 Mt koko tilille.
        memory: {
            rssMb: Math.round(process.memoryUsage().rss / 1048576),
            heapUsedMb: Math.round(process.memoryUsage().heapUsed / 1048576),
        },
        pid: process.pid,
    });
});

app.use('/api/nhl/predictions', predictionRoutes);
app.use('/api/nhl', nhlRoutes);
app.use('/api/palaute', feedbackRoutes);

// ---------------------------------------------------------------------------
// Frontendin staattinen jakelu (kun `npm run build` on ajettu)
// ---------------------------------------------------------------------------

if (fs.existsSync(distDir)) {
    app.use(express.static(distDir, {
        // Vite lisää tiedostonimiin sisältöhajautteen, joten ne voi cachettaa pitkään.
        setHeaders: (res, filePath) => {
            if (filePath.includes(`${path.sep}assets${path.sep}`)) {
                res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
            }
        },
    }));

    /*
     * SPA-fallback: kaikki muut kuin /api-polut palauttavat index.htmlin.
     *
     * Tiedostopäätteiset pyynnöt jätetään kuitenkin 404:ksi. Muuten puuttuva
     * tyyli- tai skriptitiedosto vastaisi index.htmlillä koodilla 200, ja
     * selain valittaisi vain väärästä MIME-tyypistä — todellinen syy eli
     * "tiedostoa ei löytynyt" jäisi kokonaan piiloon.
     */
    app.get(/^(?!\/api).*/, (req, res, next) => {
        if (path.extname(req.path)) return next();
        res.sendFile(path.join(distDir, 'index.html'));
    });
}

// ---------------------------------------------------------------------------
// Virheenkäsittely
// ---------------------------------------------------------------------------

app.use((req, res) => {
    res.status(404).json({ error: 'Reittiä ei löytynyt' });
});

app.use((err, req, res, _next) => {
    const status = err.status ?? (err instanceof NhlApiError ? 502 : 500);

    if (status >= 500) {
        console.error(`[virhe] ${req.method} ${req.originalUrl}:`, err.message);
    }

    res.status(status).json({
        error: status >= 500 ? 'Palvelinvirhe, yritä hetken päästä uudelleen.' : err.message,
    });
});

// ---------------------------------------------------------------------------
// Käynnistys
// ---------------------------------------------------------------------------

const server = app.listen(config.port, () => {
    const mounted = config.basePath ? ` alipolussa ${config.basePath}` : '';
    console.log(`pucknower-palvelin portissa ${config.port}${mounted} (kausi ${getSeasonId()})`);
    startScheduler();
});

/*
 * Hallittu sammutus.
 *
 * server.close() odottaa, että kaikki yhteydet sulkeutuvat. Webhotellin
 * Passenger pitää yhteyksiä auki (keep-alive), joten pelkkä close ei koskaan
 * valmistunut: vanha prosessi jäi uudelleenkäynnistyksen jälkeen pyörimään
 * päiviksi ja söi prosessikiintiötä. Nyt joutilaat yhteydet suljetaan heti ja
 * viimeistään viiden sekunnin kuluttua prosessi lopetetaan joka tapauksessa.
 */
let shuttingDown = false;
function shutdown(reason) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`${reason}: suljetaan palvelin`);
    server.close(() => process.exit(0));
    server.closeIdleConnections?.();
    setTimeout(() => {
        server.closeAllConnections?.();
        process.exit(0);
    }, 5000).unref();
}

for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
    process.on(signal, () => shutdown(signal));
}
