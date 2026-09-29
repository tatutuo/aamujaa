import {
    IconCalendarEvent, IconTable, IconChartBar, IconStar, IconDots,
    IconListNumbers, IconTournament, IconCalendarStats, IconFirstAidKit,
    IconTrophy, IconShield, IconUsersGroup, IconChartDots, IconBolt, IconFlag,
    IconSearch, IconHistory, IconSeedling, IconAdjustments, IconInfoCircle, IconMessage,
} from '@tabler/icons-react';

/**
 * Sovelluksen rakenne: alapalkin osiot ja niiden minivalikot.
 *
 * Tämä on ainoa paikka, jossa navigaatio määritellään. Alapalkki,
 * minivalikot ja reititys lukevat kaikki tätä, joten uusi näkymä lisätään
 * yhteen kohtaan eikä kolmeen.
 *
 * Osiolla on joko `path` (aukeaa suoraan) tai `items` (avaa minivalikon).
 * Valikkokohdalla voi olla `path` (näkymä) tai `action` (esim. haku, joka on
 * päällekkäinen ikkuna eikä oma näkymänsä).
 */
export const SECTIONS = [
    {
        id: 'games',
        icon: IconCalendarEvent,
        label: { fi: 'Ottelut', en: 'Games' },
        path: '/',
    },
    {
        id: 'tables',
        icon: IconTable,
        label: { fi: 'Taulukot', en: 'Tables' },
        items: [
            { path: '/taulukot/sarjataulukko', icon: IconListNumbers, label: { fi: 'Sarjataulukko', en: 'Standings' }, hint: { fi: 'Divisioonat, konferenssit, villi kortti', en: 'Divisions, conferences, wild card' } },
            { path: '/taulukot/pudotuspelit', icon: IconTournament, label: { fi: 'Pudotuspelit', en: 'Playoffs' }, hint: { fi: 'Kaavio ja sarjat', en: 'Bracket and series' } },
            { path: '/taulukot/ohjelma', icon: IconCalendarStats, label: { fi: 'Otteluohjelma', en: 'Schedule' }, hint: { fi: 'Tulevat ottelut ja pelimäärät', en: 'Upcoming games and game counts' } },
            { path: '/taulukot/loukkaantumiset', icon: IconFirstAidKit, label: { fi: 'Loukkaantumiset', en: 'Injuries' }, hint: { fi: 'Sivussa olevat ja paluuarviot', en: 'Out and expected returns' } },
        ],
    },
    {
        id: 'stats',
        icon: IconChartBar,
        label: { fi: 'Tilastot', en: 'Stats' },
        items: [
            { path: '/tilastot/pisteporssi', icon: IconTrophy, label: { fi: 'Pistepörssi', en: 'Scoring' }, hint: { fi: 'Pisteet, maalit, syötöt', en: 'Points, goals, assists' } },
            { path: '/tilastot/maalivahdit', icon: IconShield, label: { fi: 'Maalivahdit', en: 'Goalies' }, hint: { fi: 'Torjunta-%, PÄM, nollapelit', en: 'Save %, GAA, shutouts' } },
            { path: '/tilastot/joukkueet', icon: IconUsersGroup, label: { fi: 'Joukkueet', en: 'Teams' }, hint: { fi: 'Maalit, ylivoima, alivoima', en: 'Goals, power play, penalty kill' } },
            { path: '/tilastot/edistyneet', icon: IconChartDots, label: { fi: 'Edistyneet', en: 'Advanced' }, hint: { fi: 'Odotusmaalit ja Corsi', en: 'Expected goals and Corsi' } },
            { path: '/tilastot/nopeudet', icon: IconBolt, label: { fi: 'Nopeudet', en: 'Speed' }, hint: { fi: 'Luistelu ja laukaukset (NHL EDGE)', en: 'Skating and shots (NHL EDGE)' } },
            { path: '/tilastot/kansalliset', icon: IconFlag, label: { fi: 'Suomalaiset', en: 'By country' }, hint: { fi: 'Kausi ja kaikkien aikojen', en: 'Season and all-time' } },
        ],
    },
    {
        id: 'mine',
        icon: IconStar,
        label: { fi: 'Omat', en: 'Mine' },
        path: '/omat',
    },
    {
        id: 'more',
        icon: IconDots,
        label: { fi: 'Lisää', en: 'More' },
        items: [
            { action: 'search', icon: IconSearch, label: { fi: 'Haku', en: 'Search' }, hint: { fi: 'Pelaajat ja joukkueet', en: 'Players and teams' } },
            { path: '/lisaa/historia', icon: IconHistory, label: { fi: 'Historia', en: 'History' }, hint: { fi: 'Ennätykset ja palkinnot', en: 'Records and awards' } },
            { path: '/lisaa/draft', icon: IconSeedling, label: { fi: 'Draft ja lupaukset', en: 'Draft and prospects' }, hint: { fi: 'Rankingit ja varaukset', en: 'Rankings and picks' } },
            { path: '/lisaa/asetukset', icon: IconAdjustments, label: { fi: 'Asetukset', en: 'Settings' }, hint: { fi: 'Räätälöi sovellus', en: 'Make it yours' } },
            { action: 'info', icon: IconInfoCircle, label: { fi: 'Tietoja', en: 'About' } },
            { action: 'feedback', icon: IconMessage, label: { fi: 'Palaute', en: 'Feedback' } },
        ],
    },
];

/** Kaikki reitit, joilla on oma näkymä. */
export const ROUTES = SECTIONS.flatMap((s) => (s.items ? s.items : [s])).filter((r) => r.path);

/** Vanhat Aamujää-pikakuvakkeet (?view=...) ohjataan uusiin osoitteisiin. */
const LEGACY_VIEWS = {
    stats: '/tilastot/pisteporssi',
    standings: '/taulukot/sarjataulukko',
    calendar: '/taulukot/ohjelma',
};

/**
 * Polku osoitteesta. Reititys on hash-pohjainen (#/tilastot/pisteporssi),
 * koska sovellus on alipolussa (d4nyyy.fi/hockey) eikä palvelimen tarvitse
 * tietää näkymistä mitään — sama index.html kelpaa jokaiselle.
 */
export function readPath(location = window.location) {
    const hash = decodeURIComponent(location.hash.replace(/^#/, '')).split('?')[0];
    if (hash && hash !== '/') {
        const clean = hash.startsWith('/') ? hash : `/${hash}`;
        return ROUTES.some((r) => r.path === clean) ? clean : '/';
    }

    const legacy = new URLSearchParams(location.search).get('view');
    return LEGACY_VIEWS[legacy] ?? '/';
}

/** Mihin osioon polku kuuluu (alapalkin korostusta varten). */
export function sectionOf(path) {
    return SECTIONS.find((s) => s.path === path || s.items?.some((i) => i.path === path))?.id ?? 'games';
}

/** Näkymän otsikko ja ikoni polusta. */
export function routeOf(path) {
    return ROUTES.find((r) => r.path === path) ?? ROUTES[0];
}
