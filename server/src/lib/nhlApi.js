/**
 * Ohut kerros NHL:n julkisten rajapintojen päälle.
 *
 * Kaksi eri hostia:
 *   api-web.nhle.com  — ottelut, kokoonpanot, pelaajakortit (moderni rajapinta)
 *   api.nhle.com      — tilastohaut cayenneExp-kyselykielellä
 *
 * Lisätty vanhaan verrattuna: timeout, retry, järkevä virheluokka ja
 * yksi paikka jossa User-Agent asetetaan (NHL torjuu osan pyynnöistä ilman sitä).
 */

const WEB_BASE = 'https://api-web.nhle.com/v1';
const STATS_BASE = 'https://api.nhle.com/stats/rest/en';
const SEARCH_BASE = 'https://search.d3.nhle.com/api/v1';

const DEFAULT_TIMEOUT_MS = 12_000;
const USER_AGENT = 'pucknower/1.0 (+https://d4nyyy.fi/hockey)';

export class NhlApiError extends Error {
    constructor(message, status) {
        super(message);
        this.name = 'NhlApiError';
        this.status = status;
    }
}

async function request(url, { timeout = DEFAULT_TIMEOUT_MS, retries = 1 } = {}) {
    let lastError;

    for (let attempt = 0; attempt <= retries; attempt++) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeout);

        try {
            const res = await fetch(url, {
                headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
                signal: controller.signal,
            });

            if (!res.ok) {
                // 4xx ei parane uusintayrityksellä, 5xx voi parantua.
                if (res.status < 500) throw new NhlApiError(`NHL API ${res.status}`, res.status);
                throw new NhlApiError(`NHL API ${res.status}`, res.status);
            }

            return await res.json();
        } catch (err) {
            lastError = err;
            const retriable = !(err instanceof NhlApiError) || err.status >= 500;
            if (!retriable || attempt === retries) break;
            await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
        } finally {
            clearTimeout(timer);
        }
    }

    if (lastError?.name === 'AbortError') {
        throw new NhlApiError('NHL API ei vastannut ajoissa', 504);
    }
    throw lastError;
}

export const web = (path, opts) => request(`${WEB_BASE}${path}`, opts);
export const search = (path, opts) => request(`${SEARCH_BASE}${path}`, opts);

/**
 * Tilastohaku. cayenneExp/factCayenneExp koodataan täällä, jotta kutsupaikoissa
 * ei tarvitse muistaa encodeURIComponentia — vanhassa koodissa osa kyselyistä oli
 * koodattu käsin %20-merkeillä ja osa ei, mikä johti satunnaisiin 400-virheisiin.
 */
export function stats(resource, { limit = 100, sort, cayenneExp, factCayenneExp, start, isAggregate } = {}, opts) {
    const params = new URLSearchParams();
    // isAggregate summaa kaikki kaudet pelaajittain (uratilastot).
    if (isAggregate) {
        params.set('isAggregate', 'true');
        params.set('isGame', 'false');
    }
    params.set('limit', String(limit));
    if (start !== undefined) params.set('start', String(start));
    if (sort) params.set('sort', JSON.stringify(sort));
    if (cayenneExp) params.set('cayenneExp', cayenneExp);
    if (factCayenneExp) params.set('factCayenneExp', factCayenneExp);

    return request(`${STATS_BASE}/${resource}?${params.toString()}`, opts);
}

/**
 * Rajoitettu rinnakkaisuus. Vanha koodi haki 32 joukkueen ohjelmat peräkkäin
 * yhden sekunnin unilla välissä (yli 30 s), tai vaihtoehtoisesti kaikki kerralla
 * Promise.all:lla (mikä johtaa rate-limitiin). Tämä on niiden väliltä.
 */
export async function mapWithConcurrency(items, limit, fn) {
    const results = new Array(items.length);
    let index = 0;

    const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (index < items.length) {
            const i = index++;
            try {
                results[i] = await fn(items[i], i);
            } catch {
                results[i] = null;
            }
        }
    });

    await Promise.all(workers);
    return results;
}
