import { Router } from 'express';
import { web, search, stats, mapWithConcurrency } from '../lib/nhlApi.js';
import { getOrFetch, TTL } from '../lib/cache.js';
import { getSeasonId, getPreviousSeasonId } from '../lib/season.js';
import { toDateString, isValidDateString, getAamujaaDate } from '../lib/dates.js';
import { NHL_TEAMS, isValidAbbrev } from '../lib/teams.js';
import { getGameDay, getGamePlayers } from '../services/gameDay.js';
import { getGameShots, getGameFaceoffs, getGameExtras } from '../services/shots.js';
import { getPlayerForm } from '../services/playerForm.js';
import { getFantasyEvents, getFantasyStats } from '../services/fantasy.js';
import { getStatsTable, CATEGORIES } from '../services/stats.js';
import { getStandings } from '../services/standings.js';
import { normaliseNation } from '../services/nationality.js';
import { getXgTable, XG_CATEGORIES } from '../services/moneypuck.js';
import { getEdgeLeaders, getEdgePlayer, EDGE_CATEGORIES, EDGE_POSITIONS } from '../services/edge.js';
import { getInjuries } from '../services/injuries.js';
import { getBracket, getSeriesGames } from '../services/playoffs.js';
import { getNationCareers, getCupHistory, getAwardWinners, getNationAwards, TROPHIES } from '../services/history.js';
import { getDraftPicks, getDraftRankings } from '../services/draft.js';
import { getForm, FORM_WINDOWS } from '../services/form.js';
import { getGameLines, getLatestLines } from '../services/lines.js';

const router = Router();

/** Kaikki reitit palauttavat virheensä keskitetyn error handlerin kautta. */
const asyncRoute = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function badRequest(message) {
    const err = new Error(message);
    err.status = 400;
    return err;
}

/** Päivämäärä query-parametrista, oletuksena kuluva "aamujää-päivä". */
function dateParam(req) {
    const raw = req.query.date;
    if (raw === undefined) return getAamujaaDate();
    if (!isValidDateString(raw)) throw badRequest('Virheellinen päivämäärä, odotettu muoto YYYY-MM-DD');
    return raw;
}

function gameIdParam(req) {
    const id = req.params.id;
    if (!/^\d{6,12}$/.test(id)) throw badRequest('Virheellinen ottelu-ID');
    return id;
}

const EURO_NATIONS = ['FIN', 'SWE', 'RUS', 'CZE', 'CHE', 'SVK', 'DEU', 'DNK', 'LVA', 'AUT', 'FRA', 'NOR', 'SVN', 'BLR'];

/**
 * Seuratut maat: ?nations=FIN,SWE (ISO-koodit, enintään 8). Vanha ?region=en
 * tarkoittaa Euroopan maita ja oletus on Suomi.
 */
function nationsParam(req) {
    const raw = String(req.query.nations ?? '').toUpperCase();
    if (/^[A-Z]{3}(,[A-Z]{3}){0,7}$/.test(raw)) return raw.split(',').map(normaliseNation);
    return req.query.region === 'en' ? EURO_NATIONS : ['FIN'];
}

/** ?season=20252026, tai undefined (kuluva kausi, ennen avausta edellinen). */
function seasonParam(req) {
    return /^\d{8}$/.test(req.query.season ?? '') ? req.query.season : undefined;
}

function abbrevParam(req) {
    const abbrev = req.params.abbrev?.toUpperCase();
    if (!isValidAbbrev(abbrev)) throw badRequest('Tuntematon joukkuelyhenne');
    return abbrev;
}

// ---------------------------------------------------------------------------
// Ottelut
// ---------------------------------------------------------------------------

/**
 * Päivän kooste: ottelut + tulikuumat + seurattavan alueen pelaajat.
 * Korvaa frontendin aiemman kymmenien pyyntöjen ketjun.
 */
router.get('/day', asyncRoute(async (req, res) => {
    const date = dateParam(req);
    // ?favs=8484801,8476872: suosikkien illan tilastot kansallisuudesta riippumatta (enintään 40).
    const favs = String(req.query.favs ?? '').split(',').filter((id) => /^\d{7}$/.test(id)).slice(0, 40).map(Number);
    const data = await getGameDay(date, nationsParam(req), favs);

    // Kun ottelut ovat käynnissä, selain saa virkistää usein; muuten harvoin.
    res.set('Cache-Control', data.hasLiveGames ? 'public, max-age=15' : 'public, max-age=120');
    res.json(data);
}));

router.get('/score', asyncRoute(async (req, res) => {
    const date = dateParam(req);
    const data = await getOrFetch(`score:${date}`, TTL.scores, () => web(`/score/${date}`));
    res.json(data);
}));

router.get('/game/:id', asyncRoute(async (req, res) => {
    const id = gameIdParam(req);
    const data = await getOrFetch(`landing:${id}`, TTL.live, () => web(`/gamecenter/${id}/landing`));
    res.json(data);
}));

router.get('/boxscore/:id', asyncRoute(async (req, res) => {
    const id = gameIdParam(req);
    const data = await getOrFetch(`boxscore:${id}`, TTL.boxscore, () => web(`/gamecenter/${id}/boxscore`));
    res.json(data);
}));

router.get('/game/:id/players', asyncRoute(async (req, res) => {
    res.json(await getGamePlayers(gameIdParam(req)));
}));

router.get('/playbyplay/:id', asyncRoute(async (req, res) => {
    const id = gameIdParam(req);
    const data = await getOrFetch(`pbp:${id}`, TTL.live, () => web(`/gamecenter/${id}/play-by-play`));
    res.json(data);
}));


/**
 * Ottelun laukauskartta: sijainnit, tyypit, tulokset ja maalivideot.
 * Koordinaatit on normalisoitu niin, että koti hyökkää oikealle.
 */
router.get('/game/:id/shots', asyncRoute(async (req, res) => {
    res.json(await getGameShots(gameIdParam(req)));
}));

/**
 * Aloitukset pelaajittain tarkkoina lukemina ja vyöhykkeittäin.
 * Boxscore antaa vain prosentin, joka on laitahyökkääjillä aina nolla.
 */
router.get('/game/:id/faceoffs', asyncRoute(async (req, res) => {
    res.json(await getGameFaceoffs(gameIdParam(req)));
}));

/** Tuomarit, valmentajat, ylimääräiset, laukaukset erittäin, keskinäiset. */
router.get('/game/:id/extras', asyncRoute(async (req, res) => {
    res.json(await getGameExtras(gameIdParam(req)));
}));

/**
 * Fantasy-pisteytyksen tarvitsemat tapahtumat: alivoima- ja jatkoaikamaalit,
 * voittomaali, jäähyt tyypeittäin, aloitusten voitot ja häviöt sekä tähdet.
 */
router.get('/game/:id/fantasy', asyncRoute(async (req, res) => {
    res.json(await getFantasyEvents(gameIdParam(req)));
}));

/**
 * Fantasy-joukkueen pelaajien tilastot päivän otteluista yhdellä pyynnöllä.
 * Etusivun kortit päivittävät pisteensä tästä ottelun edetessä.
 */
router.get('/fantasy/stats', asyncRoute(async (req, res) => {
    const raw = String(req.query.ids ?? '').trim();
    if (!raw) return res.json({ date: dateParam(req), players: {} });

    const ids = raw.split(',').map((id) => id.trim()).filter(Boolean);
    if (ids.length > 12) throw badRequest('Enintään 12 pelaajaa kerralla');
    if (!ids.every((id) => /^\d{6,10}$/.test(id))) throw badRequest('Virheellinen pelaajatunniste');

    res.json(await getFantasyStats(ids, dateParam(req)));
}));

/** Pelaajan ottelukohtainen loki ja siitä lasketut tunnusluvut. */
router.get('/player/:id/form', asyncRoute(async (req, res) => {
    const id = req.params.id;
    if (!/^\d{6,9}$/.test(id)) throw badRequest('Virheellinen pelaaja-ID');

    const season = /^\d{8}$/.test(req.query.season ?? '') ? req.query.season : undefined;
    res.json(await getPlayerForm(id, season));
}));

/**
 * Tilastotaulukko kokonaisena: kenttäpelaajat, maalivahdit tai joukkueet.
 * Selain lajittelee ja suodattaa, joten tässä ei ole sort- eikä limit-parametria.
 *
 * ?season=20252026  kausi; oletuksena kuluva (ennen avausta edellinen)
 * ?gameType=2|3     runkosarja tai pudotuspelit
 */
router.get('/stats/:category', asyncRoute(async (req, res) => {
    const { category } = req.params;
    const isXg = XG_CATEGORIES.includes(category);
    if (!CATEGORIES.includes(category) && !isXg) throw badRequest('Tuntematon tilastoluokka');

    const season = seasonParam(req);
    const gameType = req.query.gameType === '3' ? 3 : 2;

    // xg-skaters, xg-goalies, xg-teams: odotetut maalit MoneyPuckista.
    res.json(isXg ? await getXgTable(category, { season, gameType }) : await getStatsTable(category, { season, gameType }));
}));

// ---------------------------------------------------------------------------
// NHL EDGE: nopeudet, laukausnopeudet, luistelumatkat
// ---------------------------------------------------------------------------

router.get('/edge/leaders/:category', asyncRoute(async (req, res) => {
    const { category } = req.params;
    if (!EDGE_CATEGORIES.includes(category)) throw badRequest('Tuntematon EDGE-luokka');
    const pos = EDGE_POSITIONS.includes(req.query.pos) ? req.query.pos : 'all';
    const gameType = req.query.gameType === '3' ? 3 : 2;
    res.json(await getEdgeLeaders(category, { pos, season: seasonParam(req), gameType }));
}));

router.get('/edge/player/:id', asyncRoute(async (req, res) => {
    const id = req.params.id;
    if (!/^\d{7}$/.test(id)) throw badRequest('Virheellinen pelaaja-ID');
    res.json(await getEdgePlayer(id, req.query.goalie === '1'));
}));

// ---------------------------------------------------------------------------
// Loukkaantumiset, pudotuspelit, historia ja draft
// ---------------------------------------------------------------------------

/** Ottelun kentälliset vaihdoista laskettuna. */
router.get('/game/:id/lines', asyncRoute(async (req, res) => {
    res.json(await getGameLines(gameIdParam(req)));
}));

/** Joukkueen viimeisimmän ottelun kentälliset ja nykyiset poissaolot. */
router.get('/team/:abbrev/lines', asyncRoute(async (req, res) => {
    res.json(await getLatestLines(abbrevParam(req)));
}));

/** Kunto: viimeisen 7, 14 tai 30 päivän taso verrattuna kauteen. */
router.get('/form', asyncRoute(async (req, res) => {
    const days = Number(req.query.days);
    res.json(await getForm({ days: FORM_WINDOWS.includes(days) ? days : 14 }));
}));

router.get('/injuries', asyncRoute(async (req, res) => {
    res.json(await getInjuries());
}));

router.get('/playoffs', asyncRoute(async (req, res) => {
    const year = /^\d{4}$/.test(req.query.year ?? '') ? Number(req.query.year) : undefined;
    res.json(await getBracket({ year }));
}));

router.get('/playoffs/:season/:letter', asyncRoute(async (req, res) => {
    const { season, letter } = req.params;
    if (!/^\d{8}$/.test(season) || !/^[A-Oa-o]$/.test(letter)) throw badRequest('Virheellinen sarja');
    res.json(await getSeriesGames(season, letter));
}));

router.get('/history/nation/:code', asyncRoute(async (req, res) => {
    const code = String(req.params.code).toUpperCase();
    if (!/^[A-Z]{3}$/.test(code)) throw badRequest('Virheellinen maakoodi');
    const gameType = req.query.gameType === '3' ? 3 : 2;
    res.json(await getNationCareers(code, gameType));
}));

router.get('/history/nation/:code/awards', asyncRoute(async (req, res) => {
    const code = String(req.params.code).toUpperCase();
    if (!/^[A-Z]{3}$/.test(code)) throw badRequest('Virheellinen maakoodi');
    res.json(await getNationAwards(code));
}));

router.get('/history/cup', asyncRoute(async (req, res) => {
    res.json(await getCupHistory());
}));

router.get('/history/trophies', (req, res) => res.json(TROPHIES));

router.get('/history/award/:trophyId', asyncRoute(async (req, res) => {
    const trophyId = Number(req.params.trophyId);
    if (!TROPHIES.some((t) => t.id === trophyId)) throw badRequest('Tuntematon palkinto');
    res.json(await getAwardWinners(trophyId));
}));

router.get('/draft/picks', asyncRoute(async (req, res) => {
    const year = /^\d{4}$/.test(req.query.year ?? '') ? Number(req.query.year) : undefined;
    res.json(await getDraftPicks(year));
}));

router.get('/draft/rankings', asyncRoute(async (req, res) => {
    const year = /^\d{4}$/.test(req.query.year ?? '') ? Number(req.query.year) : undefined;
    const category = [1, 2, 3, 4].includes(Number(req.query.category)) ? Number(req.query.category) : 1;
    res.json(await getDraftRankings(year, category));
}));

// ---------------------------------------------------------------------------
// Otteluohjelma ja kalenteri
// ---------------------------------------------------------------------------

router.get('/calendar/:date', asyncRoute(async (req, res) => {
    const date = req.params.date;
    if (!isValidDateString(date)) throw badRequest('Virheellinen päivämäärä');
    const data = await getOrFetch(`calendar:${date}`, TTL.schedule, () => web(`/schedule/${date}`));
    res.json(data);
}));

/**
 * Otteluohjelma seuraaville päiville: päivittäiset ottelut ja joukkuekohtainen
 * yhteenveto (ottelumäärät, koti/vieras, peräkkäiset pelipäivät).
 */
router.get('/schedule', asyncRoute(async (req, res) => {
    const startDate = req.query.startDate ? req.query.startDate : toDateString();
    if (!isValidDateString(startDate)) throw badRequest('Virheellinen startDate');

    const endDate = req.query.endDate ?? null;
    if (endDate && !isValidDateString(endDate)) throw badRequest('Virheellinen endDate');

    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 7, 1), 28);
    const cacheKey = `schedule:${startDate}:${endDate ?? days}`;

    const result = await getOrFetch(cacheKey, TTL.schedule, async () => {
        const allDates = [];
        const gamesData = [];
        let url = `/schedule/${startDate}`;
        let guard = 0;

        // NHL palauttaa viikon kerrallaan; jatketaan nextStartDatella kunnes raja täyttyy.
        // guard estää ikuisen silmukan jos rajapinta palauttaa oudon nextStartDaten.
        while (guard++ < 6) {
            const data = await web(url);
            let done = false;

            for (const day of data.gameWeek ?? []) {
                if (endDate && day.date > endDate) { done = true; break; }
                if (!endDate && allDates.length >= days) { done = true; break; }
                if (day.date >= startDate && !allDates.includes(day.date)) {
                    allDates.push(day.date);
                    gamesData.push(day);
                }
            }

            if (done || !data.nextStartDate) break;
            url = `/schedule/${data.nextStartDate}`;
        }

        const teams = {};
        const ensureTeam = (abbrev) => {
            if (!teams[abbrev]) {
                teams[abbrev] = { abbrev, gamesCount: 0, homeGames: 0, awayGames: 0, backToBacks: 0, schedule: {} };
                for (const d of allDates) teams[abbrev].schedule[d] = null;
            }
            return teams[abbrev];
        };

        for (const day of gamesData) {
            for (const game of day.games ?? []) {
                const away = ensureTeam(game.awayTeam.abbrev);
                const home = ensureTeam(game.homeTeam.abbrev);

                away.gamesCount++; away.awayGames++;
                away.schedule[day.date] = { opponent: game.homeTeam.abbrev, isHome: false, gameId: game.id };

                home.gamesCount++; home.homeGames++;
                home.schedule[day.date] = { opponent: game.awayTeam.abbrev, isHome: true, gameId: game.id };
            }
        }

        // Peräkkäisten päivien ottelut (back-to-back) on hyödyllinen tieto fantasyssa.
        for (const team of Object.values(teams)) {
            for (let i = 1; i < allDates.length; i++) {
                if (team.schedule[allDates[i]] && team.schedule[allDates[i - 1]]) team.backToBacks++;
            }
        }

        const sortedTeams = Object.values(teams).sort((a, b) => b.gamesCount - a.gamesCount);

        // Päiväkohtainen otteluluettelo otteluohjelmanäkymälle: vain tarvittavat kentät.
        const dayList = gamesData.map((day) => ({
            date: day.date,
            games: (day.games ?? []).map((g) => ({
                id: g.id,
                gameType: g.gameType,
                gameState: g.gameState,
                gameScheduleState: g.gameScheduleState,
                startTimeUTC: g.startTimeUTC,
                awayTeam: { abbrev: g.awayTeam.abbrev, score: g.awayTeam.score },
                homeTeam: { abbrev: g.homeTeam.abbrev, score: g.homeTeam.score },
                periodDescriptor: g.periodDescriptor,
                gameOutcome: g.gameOutcome,
            })),
        }));

        return { dates: allDates, teams: sortedTeams, days: dayList };
    });

    res.json(result);
}));

// ---------------------------------------------------------------------------
// Sarjataulukko
// ---------------------------------------------------------------------------

/**
 * Sarjataulukko. ?season=20252026 hakee kyseisen kauden lopputilanteen;
 * oletuksena kuluva kausi (ennen avausta edellisen kauden lopputilanne).
 */
router.get('/standings', asyncRoute(async (req, res) => {
    const season = /^\d{8}$/.test(req.query.season ?? '') ? req.query.season : undefined;
    res.json(await getStandings({ season }));
}));

// ---------------------------------------------------------------------------
// Joukkueet
// ---------------------------------------------------------------------------

router.get('/teams', (req, res) => res.json(NHL_TEAMS));

router.get('/team/:abbrev', asyncRoute(async (req, res) => {
    const abbrev = abbrevParam(req);
    const season = getSeasonId();
    const data = await getOrFetch(`clubschedule:${abbrev}:${season}`, TTL.schedule, () =>
        web(`/club-schedule-season/${abbrev}/${season}`),
    );
    res.json(data);
}));

// Vanha frontend käytti kahta eri reittiä samaan asiaan — säilytetään alias yhteensopivuuden vuoksi.
router.get('/team-schedule/:abbrev', asyncRoute(async (req, res) => {
    const abbrev = abbrevParam(req);
    const data = await getOrFetch(`clubschedule:${abbrev}:now`, TTL.schedule, () =>
        web(`/club-schedule-season/${abbrev}/now`),
    );
    res.json(data);
}));

router.get('/roster/:abbrev', asyncRoute(async (req, res) => {
    const abbrev = abbrevParam(req);
    const data = await getOrFetch(`roster:${abbrev}`, TTL.roster, () => web(`/roster/${abbrev}/current`));
    res.json(data);
}));

// ---------------------------------------------------------------------------
// Pelaajat
// ---------------------------------------------------------------------------

router.get('/player/:id', asyncRoute(async (req, res) => {
    const id = req.params.id;
    if (!/^\d{6,9}$/.test(id)) throw badRequest('Virheellinen pelaaja-ID');
    const data = await getOrFetch(`player:${id}`, TTL.player, () => web(`/player/${id}/landing`));
    res.json(data);
}));

/**
 * Monta pelaajaa yhdellä pyynnöllä.
 * Frontend haki aiemmin suosikkipelaajat yksi kerrallaan omassa useEffectissään.
 */
router.get('/players', asyncRoute(async (req, res) => {
    const ids = String(req.query.ids ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter((s) => /^\d{6,9}$/.test(s))
        .slice(0, 40);

    if (ids.length === 0) return res.json([]);

    const results = await mapWithConcurrency(ids, 6, (id) =>
        getOrFetch(`player:${id}`, TTL.player, () => web(`/player/${id}/landing`)),
    );

    res.json(results.filter(Boolean));
}));

/**
 * Aksentit pois. NHL:n hakuindeksi on puhdasta ASCII:ta: "Selänne" ja "Nečas"
 * eivät löydä mitään, vaikka "Selanne" ja "Necas" löytävät. Suomalaiselle
 * käyttäjälle juuri ä ja ö ovat luonnollinen kirjoitusasu, joten kysely on
 * riisuttava ennen lähetystä.
 */
const stripDiacritics = (value) =>
    value.normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Osuvuuspisteet hakutulokselle.
 *
 * Ilman järjestystä NHL palauttaa "aho"-haulla ensin Peter Aholan ja Marko
 * Ahosillan ja vasta kolmantena Sebastian Ahon — ja "mcdavid"-haulla Brian
 * McDavidin ennen Connoria. Pelaava pelaaja ja nimen alusta osuva täsmäys
 * nousevat siksi kärkeen.
 */
function searchScore(name, isActive, query) {
    const haystack = stripDiacritics(String(name ?? '')).toLowerCase();
    let score = isActive ? 1000 : 0;

    if (haystack === query) score += 300;
    else if (haystack.startsWith(query)) score += 200;

    // Sukunimi on tavallisin hakuperuste, joten mikä tahansa sanan alku käy.
    if (haystack.split(/[\s-]+/).some((word) => word.startsWith(query))) score += 150;

    // Lyhyempi nimi on yleensä se, jota haettiin ("Aho" ennen "Ahosiltaa").
    score -= Math.min(haystack.length, 40);

    return score;
}

router.get('/search', asyncRoute(async (req, res) => {
    const raw = String(req.query.q ?? '').trim().toLowerCase();
    if (raw.length < 2) return res.json([]);

    const q = stripDiacritics(raw);

    const results = await getOrFetch(`search:${q}`, TTL.search, async () => {
        const teamResults = NHL_TEAMS
            .filter((t) => {
                const name = stripDiacritics(t.name.toLowerCase());
                const abbrev = t.abbrev.toLowerCase();
                // Lyhenne myös alkuosumana, jotta "tb" löytää TBL:n.
                return name.includes(q) || abbrev.startsWith(q);
            })
            .map((t) => ({ type: 'JOUKKUE', name: t.name, abbrev: t.abbrev }));

        let playerResults = [];
        try {
            const players = await search(`/search/player?culture=en-us&limit=20&q=${encodeURIComponent(q)}`);
            playerResults = (players ?? [])
                .filter((p) => p.playerId)
                .map((p) => ({
                    type: 'PELAAJA',
                    name: p.name,
                    id: Number(p.playerId),
                    abbrev: p.teamAbbrev,
                    position: p.positionCode,
                    active: p.active !== false,
                }))
                .sort((a, b) => searchScore(b.name, b.active, q) - searchScore(a.name, a.active, q));
        } catch {
            // Pelaajahaku on lisäominaisuus — joukkuehaun pitää toimia vaikka se kaatuisi.
        }

        return [...teamResults, ...playerResults];
    });

    res.json(results);
}));

// ---------------------------------------------------------------------------
// Tilastot (entinen "Teksti-TV")
// ---------------------------------------------------------------------------

const LEADER_SORTS = {
    points: 'points',
    goals: 'goals',
    assists: 'assists',
    plusMinus: 'plusMinus',
    shots: 'shots',
    timeOnIcePerGame: 'timeOnIcePerGame',
    penaltyMinutes: 'penaltyMinutes',
};

/**
 * Kärkitilastot. Yhdistää vanhat /tekstitv, /tekstitv-kaikki ja /leaders/:type -reitit.
 *
 * ?region=fi|en|all  ketkä otetaan mukaan
 * ?sort=points|goals|...  mikä on järjestysperuste
 */
router.get('/leaders', asyncRoute(async (req, res) => {
    const region = ['fi', 'en', 'all'].includes(req.query.region) ? req.query.region : 'all';
    const sortKey = LEADER_SORTS[req.query.sort] ?? 'points';
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 100);
    const requestedSeason = /^\d{8}$/.test(req.query.season ?? '') ? req.query.season : null;

    const data = await getOrFetch(
        `leaders:${requestedSeason ?? 'auto'}:${region}:${sortKey}:${limit}`,
        TTL.stats,
        async () => {
            const season = requestedSeason ?? getSeasonId();
            let result = await fetchLeaders(season, region, sortKey, limit);

            // Kesällä ja ennen kauden avausta kuluvalla kaudella ei ole vielä
            // yhtään ottelua. Näytetään silloin edellisen kauden luvut sen sijaan
            // että käyttäjä tuijottaisi tyhjää listaa kaksi kuukautta.
            if (!requestedSeason && result.skaters.length === 0) {
                const previous = getPreviousSeasonId();
                const fallback = await fetchLeaders(previous, region, sortKey, limit);
                if (fallback.skaters.length > 0) {
                    return { ...fallback, season: previous, region, sort: sortKey, isPreviousSeason: true };
                }
            }

            return { ...result, season, region, sort: sortKey, isPreviousSeason: false };
        },
    );

    res.json(data);
}));

async function fetchLeaders(season, region, sortKey, limit) {
    let filter = `seasonId=${season} and gameTypeId=2`;
    if (region === 'fi') filter += ` and nationalityCode='FIN'`;
    if (region === 'en') {
        filter += ` and nationalityCode in (${EURO_NATIONS.map((c) => `'${c}'`).join(',')})`;
    }

    const [skaterRes, goalieRes] = await Promise.all([
        stats('skater/summary', {
            limit,
            sort: [{ property: sortKey, direction: 'DESC' }, { property: 'points', direction: 'DESC' }],
            cayenneExp: filter,
            factCayenneExp: 'gamesPlayed>=1',
        }),
        stats('goalie/summary', {
            limit: Math.min(limit, 25),
            sort: [{ property: 'savePct', direction: 'DESC' }],
            cayenneExp: filter,
            factCayenneExp: 'gamesPlayed>=5',
        }),
    ]);

    const skaters = (skaterRes?.data ?? []).filter((p) => p.gamesPlayed > 0);
    const goalies = goalieRes?.data ?? [];

    // Kansallisuus haetaan erikseen vain jos sitä ei jo tiedetä suodattimesta.
    if (region === 'all' && skaters.length > 0) {
        await attachNationalities(skaters, goalies, season);
    } else {
        const code = region === 'fi' ? 'FIN' : null;
        for (const p of skaters) p.nationalityCode ??= code;
        for (const g of goalies) g.nationalityCode ??= code;
    }

    return { skaters, goalies };
}

async function attachNationalities(skaters, goalies, season) {
    const fetchBios = async (resource, rows) => {
        if (rows.length === 0) return;
        const ids = rows.map((r) => r.playerId).join(',');
        const bios = await stats(resource, {
            limit: -1,
            cayenneExp: `seasonId=${season} and playerId in (${ids})`,
        }).catch(() => null);

        const map = new Map((bios?.data ?? []).map((b) => [b.playerId, b.nationalityCode]));
        for (const row of rows) row.nationalityCode = map.get(row.playerId) ?? 'N/A';
    };

    await Promise.all([
        fetchBios('skater/bios', skaters),
        fetchBios('goalie/bios', goalies),
    ]);
}

export default router;
