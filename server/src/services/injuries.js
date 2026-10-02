import { web, search, mapWithConcurrency } from '../lib/nhlApi.js';
import { getOrFetch, TTL } from '../lib/cache.js';
import { abbrevFromName } from '../lib/teams.js';

/**
 * Loukkaantumiset ESPN:n avoimesta rajapinnasta.
 *
 * NHL ei julkaise loukkaantumistietoja lainkaan. ESPN:n lista ei ole
 * virallinen eikä dokumentoitu rajapinta, joten se voi muuttua; siksi
 * virhe palautetaan hallitusti eikä se kaada muuta sovellusta.
 *
 * ESPN:n pelaajilla ei ole NHL:n tunnisteita. Ne yhdistetään joukkueen
 * kokoonpanoon nimen perusteella (aksentit ja välimerkit poistettuina),
 * jotta pelaajakortin voi avata. Joukkue päätellään koko nimestä, koska
 * ESPN:n lyhenteet poikkeavat NHL:n omista (LA, NJ, SJ, TB).
 */

const URL = 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/injuries';
const TTL_INJURIES = 30 * 60_000;

const normalise = (name) => String(name ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim();

async function fetchEspn() {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000);
    try {
        // Ei omaa User-Agentia: ESPN torjuu osan tunnisteista (403).
        const res = await fetch(URL, { signal: controller.signal });
        if (!res.ok) {
            const err = new Error(`ESPN ${res.status}`);
            err.status = 502;
            throw err;
        }
        return await res.json();
    } finally {
        clearTimeout(timer);
    }
}

/** Joukkueen kokoonpano nimihakemistoksi (koko nimi ja "etukirjain + sukunimi") -> tunniste ja syntymämaa. */
async function rosterIndex(abbrev) {
    const roster = await getOrFetch(`roster:${abbrev}`, TTL.roster, () => web(`/roster/${abbrev}/current`));
    const byFull = new Map();
    const byShort = new Map();
    for (const group of ['forwards', 'defensemen', 'goalies']) {
        for (const p of roster?.[group] ?? []) {
            const first = p.firstName?.default ?? '';
            const last = p.lastName?.default ?? '';
            const entry = { id: p.id, nat: p.birthCountry ?? null };
            byFull.set(normalise(`${first} ${last}`), entry);
            byShort.set(normalise(`${first[0] ?? ''} ${last}`), entry);
        }
    }
    return { byFull, byShort };
}

/**
 * Varareitti: loukkaantuneiden listalle siirretyt pelaajat putoavat NHL:n
 * "current"-kokoonpanosta, joten heidät etsitään pelaajahaulla. Osuma
 * hyväksytään vain, jos nimi täsmää ja joukkue on sama (nykyinen tai viimeisin).
 */
async function searchPlayer(name, team) {
    const key = normalise(name);
    const results = await getOrFetch(`injury-search:${key}`, 24 * 60 * 60_000, () =>
        search(`/search/player?culture=en-us&limit=8&q=${encodeURIComponent(name)}`));
    const hit = (results ?? []).find((p) => normalise(p.name) === key
        && (p.teamAbbrev === team || p.lastTeamAbbrev === team));
    return hit ? { id: Number(hit.playerId), nat: hit.birthCountry ?? null } : null;
}

export async function getInjuries() {
    return getOrFetch('injuries', TTL_INJURIES, async () => {
        const data = await fetchEspn();
        const teams = (data.injuries ?? [])
            .map((t) => ({ abbrev: abbrevFromName(t.displayName), injuries: t.injuries ?? [] }))
            .filter((t) => t.abbrev);

        const indexes = new Map();
        await mapWithConcurrency(teams, 6, async (t) => {
            indexes.set(t.abbrev, await rosterIndex(t.abbrev).catch(() => null));
        });

        const rows = teams.flatMap((t) => t.injuries.map((i) => {
            const a = i.athlete ?? {};
            const index = indexes.get(t.abbrev);
            const full = normalise(a.displayName);
            const short = normalise(`${(a.firstName ?? '')[0] ?? ''} ${a.lastName ?? ''}`);
            const d = i.details ?? {};
            const match = index?.byFull.get(full) ?? index?.byShort.get(short) ?? null;
            return {
                id: match?.id ?? null,
                nat: match?.nat ?? null,
                // Huom: ESPN:n tunniste on uutismerkinnän, ei pelaajan, ja voi toistua.
                espnId: i.id,
                name: a.displayName,
                team: t.abbrev,
                pos: a.position?.abbreviation ?? null,
                status: i.status,
                statusCode: d.fantasyStatus?.abbreviation ?? null,
                type: d.type && d.type !== 'Not Specified' ? d.type : null,
                detail: d.detail && d.detail !== 'Not Specified' ? d.detail : null,
                side: d.side && d.side !== 'Not Specified' ? d.side : null,
                returnDate: d.returnDate ?? null,
                updated: i.date ?? null,
                comment: i.longComment && i.longComment.length > 3 ? i.longComment : null,
            };
        }));

        const missing = rows.filter((r) => !r.id);
        await mapWithConcurrency(missing, 4, async (row) => {
            const hit = await searchPlayer(row.name, row.team).catch(() => null);
            if (hit) Object.assign(row, hit);
        });

        return { updated: data.timestamp ?? new Date().toISOString(), source: 'ESPN', rows };
    });
}
