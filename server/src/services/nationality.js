import { stats, web, mapWithConcurrency } from '../lib/nhlApi.js';
import { getOrFetch, TTL } from '../lib/cache.js';
import { getSeasonId, getPreviousSeasonId } from '../lib/season.js';
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

const EURO_NATIONALITIES = [
    'FIN', 'SWE', 'RUS', 'CZE', 'SUI', 'SVK', 'GER',
    'DEN', 'LVA', 'AUT', 'FRA', 'NOR', 'SLO', 'BLR',
];

/** Mitkä maakoodit kuuluvat alueeseen. Sama joukko molemmille lähteille. */
function regionCountries(region) {
    return region === 'en' ? EURO_NATIONALITIES : ['FIN'];
}

function nationalityExpression(region) {
    if (region === 'en') {
        const list = EURO_NATIONALITIES.map((c) => `'${c}'`).join(',');
        return `nationalityCode in (${list})`;
    }
    return `nationalityCode='FIN'`;
}

/** Lisää yhden kauden pelaajat karttaan. Uudempi kausi voittaa vanhemman. */
async function fetchSeason(region, season, map) {
    const cayenneExp = `seasonId=${season} and ${nationalityExpression(region)}`;

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
 */
async function fetchRosters(region, map) {
    const wanted = new Set(regionCountries(region));

    const rosters = await mapWithConcurrency(NHL_TEAMS, 6, (team) =>
        web(`/roster/${team.abbrev}/current`).catch(() => null),
    );

    rosters.forEach((roster) => {
        if (!roster) return;

        const players = [
            ...(roster.forwards ?? []),
            ...(roster.defensemen ?? []),
            ...(roster.goalies ?? []),
        ];

        for (const p of players) {
            if (!wanted.has(p.birthCountry) || map.has(p.id)) continue;

            map.set(p.id, {
                id: p.id,
                name: `${p.firstName?.default ?? ''} ${p.lastName?.default ?? ''}`.trim(),
                nationality: p.birthCountry,
                birthDate: p.birthDate,
                position: p.positionCode || 'F',
            });
        }
    });
}

/**
 * @param {string} region 'fi' = suomalaiset, 'en' = eurooppalaiset
 * @param {string} [season] kauden tunniste; oletuksena kuluva kausi
 * @returns {Promise<Map<number, {id:number,name:string,nationality:string,position:string}>>}
 */
export async function getPlayersByRegion(region = 'fi', season = getSeasonId()) {
    const key = `nationality:${season}:${region}`;

    return getOrFetch(key, TTL.roster, async () => {
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
        // Virallinen kansallisuus ensin: edellinen kausi pohjaksi, kuluva päälle.
        await fetchSeason(region, getPreviousSeasonId(), map);
        await fetchSeason(region, season, map);

        // Kokoonpanot täydentävät ne, joilla ei vielä ole yhtään NHL-ottelua.
        await fetchRosters(region, map);

        return map;
    });
}
