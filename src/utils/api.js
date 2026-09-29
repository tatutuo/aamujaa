/**
 * Keskitetty API-asiakas.
 *
 * Aiemmin jokainen komponentti kutsui fetchiä suoraan omalla tavallaan: osa
 * nieli virheet hiljaa, osa ei peruuttanut pyyntöjä unmountissa, ja yksi haki
 * NHL:n rajapintaa suoraan selaimesta ohi oman palvelimen. Kaikki kulkee nyt
 * tämän kautta.
 */

/**
 * Rajapinnan juuriosoite.
 *
 * Oletuksena sama polku, josta sovellus itse tarjoillaan. Vite tietää sen
 * (`BASE_URL`), joten sitä ei tarvitse kertoa erikseen käännöksessä: kun
 * sovellus on osoitteessa d4nyyy.fi/hockey/, kutsut menevät automaattisesti
 * osoitteeseen d4nyyy.fi/hockey/api/... eivätkä verkkotunnuksen juureen.
 *
 * VITE_API_URL ohittaa tämän, jos rajapinta on jossain muualla kuin
 * frontendin kanssa samassa paikassa.
 */
const trimSlash = (value) => String(value ?? '').replace(/\/+$/, '');

// Tyhjä VITE_API_URL käsitellään puuttuvana: '??' päästäisi tyhjän merkkijonon
// läpi, jolloin kutsut menisivät verkkotunnuksen juureen alipolun sijaan.
const BASE = import.meta.env.VITE_API_URL
    ? trimSlash(import.meta.env.VITE_API_URL)
    : trimSlash(import.meta.env.BASE_URL);

export class ApiError extends Error {
    constructor(message, status) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
    }
}

async function request(path, { signal } = {}) {
    const res = await fetch(`${BASE}${path}`, { signal });

    if (!res.ok) {
        let message = `Pyyntö epäonnistui (${res.status})`;
        try {
            const body = await res.json();
            if (body?.error) message = body.error;
        } catch {
            // Vastaus ei ollut JSONia — käytetään oletusviestiä.
        }
        throw new ApiError(message, res.status);
    }

    return res.json();
}

const query = (params) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null && value !== '') search.set(key, value);
    }
    const str = search.toString();
    return str ? `?${str}` : '';
};

export const api = {
    /** Päivän kooste: ottelut, tulikuumat ja seurattavat pelaajat yhdellä kutsulla. */
    day: (date, region, opts) => request(`/api/nhl/day${query({ date, region })}`, opts),

    score: (date, opts) => request(`/api/nhl/score${query({ date })}`, opts),
    game: (id, opts) => request(`/api/nhl/game/${id}`, opts),
    boxscore: (id, opts) => request(`/api/nhl/boxscore/${id}`, opts),
    gamePlayers: (id, opts) => request(`/api/nhl/game/${id}/players`, opts),
    playByPlay: (id, opts) => request(`/api/nhl/playbyplay/${id}`, opts),
    /** Laukauskartta: sijainnit, tyypit ja maalivideot. */
    gameShots: (id, opts) => request(`/api/nhl/game/${id}/shots`, opts),
    /** Aloitukset tarkkoina lukemina ja vyohykkeittain. */
    gameFaceoffs: (id, opts) => request(`/api/nhl/game/${id}/faceoffs`, opts),
    /** Tuomarit, valmentajat, ylimaaraiset, laukaukset erittain. */
    gameExtras: (id, opts) => request(`/api/nhl/game/${id}/extras`, opts),
    /** Fantasy-pisteytyksen tapahtumat: maalityypit, jäähyt, aloitukset, tähdet. */
    gameFantasy: (id, opts) => request(`/api/nhl/game/${id}/fantasy`, opts),
    /** Fantasy-joukkueen pisteet paivan otteluista yhdella pyynnolla. */
    fantasyStats: (ids, date, opts) =>
        request(`/api/nhl/fantasy/stats${query({ ids: ids.join(','), date })}`, opts),

    calendar: (date, opts) => request(`/api/nhl/calendar/${date}`, opts),
    schedule: (params, opts) => request(`/api/nhl/schedule${query(params)}`, opts),

    standings: (opts) => request('/api/nhl/standings', opts),

    teams: (opts) => request('/api/nhl/teams', opts),
    team: (abbrev, opts) => request(`/api/nhl/team/${abbrev}`, opts),
    teamSchedule: (abbrev, opts) => request(`/api/nhl/team-schedule/${abbrev}`, opts),
    roster: (abbrev, opts) => request(`/api/nhl/roster/${abbrev}`, opts),

    player: (id, opts) => request(`/api/nhl/player/${id}`, opts),
    /** Pelaajan ottelukohtainen loki ja muototunnusluvut. */
    playerForm: (id, season, opts) => request(`/api/nhl/player/${id}/form${query({ season })}`, opts),
    /** Monta pelaajaa yhdellä pyynnöllä — korvaa aiemman silmukan yksittäisiä hakuja. */
    players: (ids, opts) => {
        const list = [...new Set(ids)].filter(Boolean);
        if (list.length === 0) return Promise.resolve([]);
        return request(`/api/nhl/players${query({ ids: list.join(',') })}`, opts);
    },

    search: (q, opts) => request(`/api/nhl/search${query({ q })}`, opts),

    leaders: (params, opts) => request(`/api/nhl/leaders${query(params)}`, opts),

    /** Mitkä edistyneiden tilastojen näkymät ovat olemassa. */
    advancedViews: (opts) => request('/api/nhl/advanced', opts),
    advanced: (category, view, params, opts) =>
        request(`/api/nhl/advanced/${category}/${view}${query(params)}`, opts),

    predictions: (date, opts) => request(`/api/nhl/predictions${query({ date })}`, opts),
    predictionDates: (opts) => request('/api/nhl/predictions/dates', opts),
    predictionAccuracy: (days, opts) => request(`/api/nhl/predictions/accuracy${query({ days })}`, opts),

    sendFeedback: async (viesti, lahettaja) => {
        const res = await fetch(`${BASE}/api/palaute`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ viesti, lahettaja }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new ApiError(body.error ?? 'Lähetys epäonnistui', res.status);
        return body;
    },
};
