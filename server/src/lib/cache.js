/**
 * Muistivälimuisti, jossa on request coalescing.
 *
 * Vanhassa backendissä jokainen käyttäjän sivulataus meni suoraan NHL:n API:in.
 * Kun 20 käyttäjää avaa sovelluksen samaan aikaan otteluillan aikana, se on
 * satoja pyyntöjä sekunnissa samaan dataan — hidasta ja hyvä tapa tulla
 * rate-limitatuksi.
 *
 * getOrFetch palauttaa saman lupauksen kaikille rinnakkaisille kutsujille, joten
 * ulospäin lähtee vain yksi pyyntö riippumatta siitä montako pyyntöä sisään tuli.
 */

const store = new Map();
const inFlight = new Map();

export async function getOrFetch(key, ttlMs, producer) {
    const cached = store.get(key);
    const now = Date.now();

    if (cached && cached.expires > now) {
        return cached.value;
    }

    const pending = inFlight.get(key);
    if (pending) return pending;

    const promise = (async () => {
        try {
            const value = await producer();
            // Poisto ja lisäys siirtää avaimen järjestyksessä uusimmaksi (siivous poistaa vanhimmat).
            store.delete(key);
            store.set(key, { value, expires: Date.now() + ttlMs });
            return value;
        } catch (err) {
            // Jos ulkoinen API kaatuu, tarjotaan mieluummin vanhentunutta dataa
            // kuin virhesivu. NHL:n API on ajoittain nurin muutaman minuutin.
            if (cached) {
                console.warn(`[cache] ${key} epäonnistui, palautetaan vanhentunut data:`, err.message);
                return cached.value;
            }
            throw err;
        } finally {
            inFlight.delete(key);
        }
    })();

    inFlight.set(key, promise);
    return promise;
}

// ---------------------------------------------------------------------------
// Siivous
// ---------------------------------------------------------------------------

/**
 * Vanhentunut merkintä pidetään vielä hetken varalla (palautetaan, jos
 * ulkoinen rajapinta on nurin), mutta sen jälkeen se poistetaan. Ilman
 * siivousta muisti kasvoi jokaisesta uudesta päivästä, ottelusta, pelaajasta
 * ja hakusanasta, kunnes webhotellin muistiraja (512 Mt) tuli vastaan.
 */
const STALE_GRACE_MS = 2 * 60 * 60_000;
/** Merkintöjen enimmäismäärä; yli menevistä poistetaan ensin vanhimmat. */
const MAX_ENTRIES = 1500;
const SWEEP_INTERVAL_MS = 10 * 60_000;

export function sweep(now = Date.now()) {
    let removed = 0;
    for (const [key, entry] of store) {
        if (entry.expires + STALE_GRACE_MS < now) {
            store.delete(key);
            removed++;
        }
    }
    if (store.size > MAX_ENTRIES) {
        // Map säilyttää lisäysjärjestyksen: ensimmäiset ovat vanhimpia.
        const excess = store.size - MAX_ENTRIES;
        let i = 0;
        for (const key of store.keys()) {
            if (i++ >= excess) break;
            store.delete(key);
            removed++;
        }
    }
    return removed;
}

// unref: ajastin ei pidä prosessia hengissä (testit ja sammutus).
setInterval(() => sweep(), SWEEP_INTERVAL_MS).unref?.();

export function invalidate(prefix) {
    for (const key of store.keys()) {
        if (key.startsWith(prefix)) store.delete(key);
    }
}

export function cacheStats() {
    const now = Date.now();
    let fresh = 0;
    for (const entry of store.values()) if (entry.expires > now) fresh++;
    return { entries: store.size, fresh, inFlight: inFlight.size };
}

/** Yleisimmät TTL:t yhdessä paikassa, jotta virkistysvälit pysyvät johdonmukaisina. */
export const TTL = {
    live: 15_000, // käynnissä olevat ottelut
    scores: 30_000, // päivän tulokset
    boxscore: 20_000,
    schedule: 10 * 60_000,
    standings: 5 * 60_000,
    stats: 15 * 60_000, // tilastokärjet
    player: 60 * 60_000,
    roster: 6 * 60 * 60_000,
    search: 5 * 60_000,
};
