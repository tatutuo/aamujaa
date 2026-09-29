/**
 * Service worker.
 *
 * Kaksi tehtävää:
 *   1. Sovelluskuori (HTML, JS, CSS, ikonit) toimii ilman verkkoa — Play Storen
 *      TWA-julkaisu käytännössä edellyttää, ettei sovellus näytä selaimen
 *      "ei yhteyttä" -virhesivua.
 *   2. API-vastaukset tarjoillaan verkosta ensisijaisesti, mutta viimeisin
 *      onnistunut vastaus jää talteen. Junassa tai hississä käyttäjä näkee
 *      viimeksi ladatut ottelut tyhjän ruudun sijaan.
 *
 * VERSION on nostettava kun sovelluskuori muuttuu, jotta vanha välimuisti
 * siivotaan. Vite-buildissa tiedostonimissä on sisältöhajaute, joten
 * käytännössä riittää että tämä tiedosto muuttuu julkaisun yhteydessä.
 */

const VERSION = 'v3';
const SHELL_CACHE = `aamujaa-shell-${VERSION}`;
const API_CACHE = `aamujaa-api-${VERSION}`;

const SHELL_ASSETS = [
    './',
    './index.html',
    './manifest.webmanifest',
    './icon-192.png',
    './icon-512.png',
    './icon-maskable-512.png',
    './splash.png',
];

// Näitä ei kannata säilyttää: live-tulokset vanhenevat sekunneissa.
const NO_STORE_PATHS = ['/api/palaute'];

const API_CACHE_MAX_ENTRIES = 60;

/**
 * Polku sovelluksen juuresta katsottuna.
 *
 * Sovellus voi olla asennettu alipolkuun (d4nyyy.fi/hockey), jolloin
 * rajapintakutsut ovat muotoa '/hockey/api/nhl/day'. Ilman tätä ne eivät
 * täsmäisi '/api/'-tarkistukseen, vaan päätyisivät sovelluskuoren
 * välimuistiin ikuisesti — käyttäjä näkisi vanhat tulokset eikä mikään
 * päivittyisi. Laajuus luetaan rekisteröinnistä, joten se toimii sekä
 * juuressa että alipolussa ilman asetuksia.
 */
function appPath(url) {
    const scope = new URL(self.registration.scope).pathname.replace(/\/$/, '');
    return scope && url.pathname.startsWith(scope)
        ? url.pathname.slice(scope.length) || '/'
        : url.pathname;
}

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(SHELL_CACHE)
            .then((cache) => cache.addAll(SHELL_ASSETS))
            .then(() => self.skipWaiting()),
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(
                keys
                    .filter((key) => key.startsWith('aamujaa-') && !key.endsWith(VERSION))
                    .map((key) => caches.delete(key)),
            ))
            .then(() => self.clients.claim()),
    );
});

/** Poistaa vanhimmat merkinnät, ettei välimuisti kasva rajatta. */
async function trimCache(cacheName, maxEntries) {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    if (keys.length <= maxEntries) return;
    await Promise.all(keys.slice(0, keys.length - maxEntries).map((key) => cache.delete(key)));
}

/** Verkko ensin, välimuisti varalla. Sopii datalle joka muuttuu jatkuvasti. */
async function networkFirst(request) {
    const cache = await caches.open(API_CACHE);

    try {
        const response = await fetch(request);
        if (response.ok) {
            cache.put(request, response.clone());
            trimCache(API_CACHE, API_CACHE_MAX_ENTRIES);
        }
        return response;
    } catch (err) {
        const cached = await cache.match(request);
        if (cached) {
            // Merkitään vastaus vanhentuneeksi, jotta käyttöliittymä voi
            // halutessaan kertoa käyttäjälle että data ei ole tuoretta.
            const headers = new Headers(cached.headers);
            headers.set('X-Aamujaa-Cache', 'stale');
            return new Response(cached.body, { status: 200, headers });
        }
        throw err;
    }
}

/** Välimuisti ensin. Sopii tiedostoille joiden nimessä on sisältöhajaute. */
async function cacheFirst(request) {
    const cached = await caches.match(request);
    if (cached) return cached;

    const response = await fetch(request);
    if (response.ok && request.method === 'GET') {
        const cache = await caches.open(SHELL_CACHE);
        cache.put(request, response.clone());
    }
    return response;
}

self.addEventListener('fetch', (event) => {
    const { request } = event;

    if (request.method !== 'GET') return;

    const url = new URL(request.url);

    // Muut originit (esim. NHL:n pelaajakuvat) hoitaa selaimen oma välimuisti.
    if (url.origin !== self.location.origin) return;

    const pathname = appPath(url);

    if (NO_STORE_PATHS.some((path) => pathname.startsWith(path))) return;

    if (pathname.startsWith('/api/')) {
        event.respondWith(networkFirst(request));
        return;
    }

    // SPA-navigaatio: jos verkko ei vastaa, näytetään sovelluskuori.
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request).catch(() => caches.match('./index.html')),
        );
        return;
    }

    event.respondWith(cacheFirst(request));
});
