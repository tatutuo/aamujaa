import { stats, web, mapWithConcurrency } from '../lib/nhlApi.js';
import { getOrFetch, TTL } from '../lib/cache.js';
import { getSeasonId } from '../lib/season.js';
import { NHL_TEAMS } from '../lib/teams.js';

/**
 * Pelaajien kansallisuudet suoraan NHL:n datasta — ei käsin ylläpidettyä listaa.
 *
 * Tämä korvaa vanhan app.js:n 100 nimen kovakoodatun SUOMI_LISTA-taulukon ja sen
 * ympärille rakennetun aksenttien poiston + "E Tolvanen" -tyyppisen lyhennevertailun.
 * Vanha tapa vanheni heti kun joku nousi liigaan, ja nimivertailu antoi vääriä
 * osumia samannimisillä pelaajilla. Nyt tunnistus perustuu pelaaja-ID:hen.
 *
 * Lähteitä on kaksi, koska kumpikaan yksin ei riitä:
 *
 *   1. Joukkueiden kokoonpanot (`/roster/{joukkue}/current`) sisältävät
 *      jokaisen NHL-sopimuspelaajan syntymämaineen — myös tulokkaat, joilla ei
 *      ole vielä yhtään NHL-ottelua. Ilman tätä esimerkiksi Benjamin
 *      Rautiainen puuttui listalta kokonaan.
 *
 *   2. Tilastoraportti `bios` kertoo virallisen kansallisuuden, joka voi
 *      poiketa syntymämaasta (ulkomailla syntynyt Suomen edustaja). Se listaa
 *      kuitenkin vain kauden aikana pelanneet, joten se ei yksin riitä.
 *
 * Kokoonpanoista otetaan vain ne pelaajat, joita bios ei jo tuntenut, jolloin
 * virallinen kansallisuus voittaa syntymämaan aina kun se on tiedossa.
 */

/** NHL käyttää ISO-maakoodeja (DEU, CHE, DNK, SVN) eikä olympiakoodeja. */
const EURO_NATIONALITIES = [
    'FIN', 'SWE', 'RUS', 'CZE', 'CHE', 'SVK', 'DEU',
    'DNK', 'LVA', 'AUT', 'FRA', 'NOR', 'SVN', 'BLR',
];

/** Vanhat olympiakoodit ISO-koodeiksi. */
const LEGACY_CODES = { GER: 'DEU', SUI: 'CHE', DEN: 'DNK', SLO: 'SVN', LAT: 'LVA' };
export const normaliseNation = (code) => LEGACY_CODES[code] ?? code;

/** Alueen maat: 'fi' = Suomi, 'en' = Euroopan maat (vanha Aamujää-jako). */
function regionCountries(region) {
    return region === 'en' ? EURO_NATIONALITIES : ['FIN'];
}

/** Lisää yhden kauden yhden maan pelaajat karttaan. */
async function fetchSeason(code, season, map) {
    const cayenneExp = `seasonId=${season} and nationalityCode='${code}'`;

    const [skaters, goalies] = await Promise.all([
        stats('skater/bios', { limit: -1, cayenneExp }).catch(() => null),
        stats('goalie/bios', { limit: -1, cayenneExp }).catch(() => null),
    ]);

    for (const p of skaters?.data ?? []) {
        map.set(p.playerId, {
            id: p.playerId,
            name: p.skaterFullName,
            nationality: p.nationalityCode,
            birthDate: p.birthDate,
            position: p.positionCode || 'F',
        });
    }

    for (const g of goalies?.data ?? []) {
        map.set(g.playerId, {
            id: g.playerId,
            name: g.goalieFullName,
            nationality: g.nationalityCode,
            birthDate: g.birthDate,
            position: 'G',
        });
    }
}

/**
 * Täydentää kartan joukkueiden kokoonpanoista syntymämaan perusteella.
 *
 * Vain ne pelaajat, joita bios-raportti ei jo tuntenut — virallinen
 * kansallisuus on tarkempi tieto kuin syntymämaa, joten se ei saa ylikirjoittua.
 * Kokoonpanot ovat samassa välimuistissa kuin /roster-reitti, joten useamman
 * maan seuraaminen ei moninkertaista NHL-pyyntöjä.
 */
async function fetchRosters(code, map) {
    const rosters = await mapWithConcurrency(NHL_TEAMS, 6, (team) =>
        getOrFetch(`roster:${team.abbrev}`, TTL.roster, () => web(`/roster/${team.abbrev}/current`)).catch(() => null),
    );

    rosters.forEach((roster) => {
        if (!roster) return;

        const players = [
            ...(roster.forwards ?? []),
            ...(roster.defensemen ?? []),
            ...(roster.goalies ?? []),
        ];

        for (const p of players) {
            if (normaliseNation(p.birthCountry) !== code || map.has(p.id)) continue;

            map.set(p.id, {
                id: p.id,
                name: `${p.firstName?.default ?? ''} ${p.lastName?.default ?? ''}`.trim(),
                nationality: code,
                birthDate: p.birthDate,
                position: p.positionCode || 'F',
            });
        }
    });
}

/**
 * Yhden maan pelaajat. Välimuistissa maakohtaisesti, joten eri käyttäjien
 * erilaiset maayhdistelmät jakavat saman datan.
 */
async function getPlayersByNation(code, season) {
    return getOrFetch(`nationality:${season}:${code}`, TTL.roster, async () => {
        const map = new Map();

        /*
         * Bios-raportti listaa vain ne pelaajat, jotka ovat jo pelanneet
         * kyseisellä kaudella. Siksi lista on tyhjä ennen kauden avausta ja
         * vajaa ensimmäisinä viikkoina — juuri silloin "Suomalaiset"-osio
         * näytti tyhjää, vaikka pelaajia oli jäällä.
         *
         * Edellinen kausi otetaan mukaan täydennyksenä. Kansallisuus ei muutu,
         * ja listaa käytetään vain suodattimena illan kokoonpanoille, joten
         * lopettaneesta pelaajasta ei ole haittaa — hän ei osu mihinkään.
         */
        const previous = `${Number(season.slice(0, 4)) - 1}${season.slice(0, 4)}`;
        await fetchSeason(code, previous, map);
        await fetchSeason(code, season, map);

        // Kokoonpanot täydentävät ne, joilla ei vielä ole yhtään NHL-ottelua.
        await fetchRosters(code, map);

        return map;
    });
}

/**
 * Usean maan pelaajat yhdessä kartassa.
 * @param {string[]} codes ISO-maakoodit, esim. ['FIN', 'SWE']
 * @param {string} [season]
 * @returns {Promise<Map<number, {id:number,name:string,nationality:string,position:string}>>}
 */
export async function getPlayersByNations(codes, season = getSeasonId()) {
    const unique = [...new Set(codes.map(normaliseNation))];
    const maps = await Promise.all(unique.map((code) => getPlayersByNation(code, season).catch(() => new Map())));
    const merged = new Map();
    for (const map of maps) for (const [id, p] of map) merged.set(id, p);
    return merged;
}

/**
 * Vanha rajapinta: 'fi' = suomalaiset, 'en' = eurooppalaiset.
 * @param {string} region
 * @param {string} [season]
 */
export async function getPlayersByRegion(region = 'fi', season = getSeasonId()) {
    return getPlayersByNations(regionCountries(region), season);
}
