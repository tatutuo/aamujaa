import { web, mapWithConcurrency } from '../lib/nhlApi.js';
import { getOrFetch, TTL } from '../lib/cache.js';
import { getSeasonId } from '../lib/season.js';
import { getPlayersByRegion } from './nationality.js';

/**
 * Yhden ottelupäivän kooste: ottelut + kaikkien pelanneiden pelaajatilastot.
 *
 * Tämä on uusi endpoint, joka korvaa frontendin pahimman suorituskykyongelman.
 * Vanha HomePage.jsx haki jokaiselle ottelulle erikseen boxscoren JA landing-datan
 * suoraan selaimesta: 16 ottelun iltana 32 rinnakkaista pyyntöä joka sivulatauksella
 * ja uudestaan joka maalin jälkeen. Mobiiliverkossa se on useita sekunteja
 * odotusta ja iso osa siitä turhaa dataa.
 *
 * Nyt palvelin tekee haut kerran, välimuistittaa tuloksen ja lähettää selaimelle
 * vain sen mitä käyttöliittymä oikeasti näyttää.
 */

const LIVE_STATES = new Set(['LIVE', 'CRIT']);
const FINISHED_STATES = new Set(['FINAL', 'OFF']);
const NOT_STARTED_STATES = new Set(['FUT', 'PRE']);

function playerName(p) {
    if (typeof p?.name === 'object') return p.name.default;
    if (typeof p?.name === 'string') return p.name;
    const first = p?.firstName?.default ?? p?.firstName ?? '';
    const last = p?.lastName?.default ?? p?.lastName ?? '';
    return `${first} ${last}`.trim();
}

function headshotUrl(playerId) {
    return `https://assets.nhle.com/mugs/nhl/latest/backgroundless/256/${playerId}.png`;
}

/** Poimii yhden pelaajan tilastot boxscoresta yhtenäiseen muotoon. */
function normalizePlayer(p, teamAbbrev, isGoalie) {
    const s = p.stats ?? {};
    const pick = (...keys) => {
        for (const k of keys) {
            if (p[k] !== undefined && p[k] !== null) return p[k];
            if (s[k] !== undefined && s[k] !== null) return s[k];
        }
        return 0;
    };

    // Peliaika kuuluu stats-objektiin: käyttöliittymä päättelee siitä, onko
    // pelaaja oikeasti ollut jäällä vai onko hän vasta odottamassa ottelua.
    const toi = p.toi || s.toi || '0:00';

    const base = {
        id: p.playerId,
        name: playerName(p),
        team: teamAbbrev,
        position: p.position || (isGoalie ? 'G' : 'F'),
        sweaterNumber: p.sweaterNumber ?? null,
        headshot: headshotUrl(p.playerId),
        toi,
    };

    if (isGoalie) {
        const shotsAgainst = Number(pick('shotsAgainst')) || 0;
        const saves = Number(pick('saves')) || 0;
        return {
            ...base,
            stats: {
                toi,
                saves,
                shotsAgainst,
                goalsAgainst: Number(pick('goalsAgainst')) || 0,
                savePctg: shotsAgainst > 0 ? saves / shotsAgainst : 0,
                decision: p.decision ?? null,
            },
        };
    }

    const goals = Number(pick('goals')) || 0;
    const assists = Number(pick('assists')) || 0;

    return {
        ...base,
        stats: {
            toi,
            goals,
            assists,
            points: Number(pick('points')) || goals + assists,
            plusMinus: Number(pick('plusMinus')) || 0,
            shots: Number(pick('sog', 'shots')) || 0,
            hits: Number(pick('hits')) || 0,
            pim: Number(pick('pim')) || 0,
            blocked: Number(pick('blockedShots')) || 0,
            faceoffWinningPctg: Number(pick('faceoffWinningPctg')) || 0,
        },
    };
}

function extractPlayers(boxscore, game) {
    const byGame = boxscore?.playerByGameStats;
    if (!byGame) return [];

    const out = [];
    const sides = [
        ['awayTeam', game.awayTeam.abbrev],
        ['homeTeam', game.homeTeam.abbrev],
    ];

    for (const [side, abbrev] of sides) {
        const teamStats = byGame[side];
        if (!teamStats) continue;

        for (const group of ['forwards', 'defense']) {
            for (const p of teamStats[group] ?? []) {
                out.push({ ...normalizePlayer(p, abbrev, false), gameId: game.id });
            }
        }
        for (const p of teamStats.goalies ?? []) {
            out.push({ ...normalizePlayer(p, abbrev, true), gameId: game.id });
        }
    }

    return out;
}

/** Onko pelaajan suoritus "tulikuuma" — sama sääntö palvelimella kaikille asiakkaille. */
function isHot(player) {
    if (player.position === 'G') {
        const { saves, shotsAgainst, savePctg } = player.stats;
        return shotsAgainst >= 20 && saves >= 25 && savePctg >= 0.935;
    }
    return player.stats.points >= 3;
}

async function fetchBoxscores(games) {
    const active = games.filter((g) => !NOT_STARTED_STATES.has(g.gameState));

    const boxscores = await mapWithConcurrency(active, 6, (game) =>
        web(`/gamecenter/${game.id}/boxscore`),
    );

    const players = [];
    active.forEach((game, i) => {
        if (boxscores[i]) players.push(...extractPlayers(boxscores[i], game));
    });

    return players;
}

/** Alkamattomien otteluiden joukkueiden kokoonpanot, jotta seurattavat pelaajat näkyvät etukäteen. */
async function fetchUpcomingRosters(games) {
    const upcoming = games.filter((g) => NOT_STARTED_STATES.has(g.gameState));
    if (upcoming.length === 0) return [];

    const abbrevs = [...new Set(upcoming.flatMap((g) => [g.awayTeam.abbrev, g.homeTeam.abbrev]))];

    const rosters = await mapWithConcurrency(abbrevs, 6, (abbrev) =>
        getOrFetch(`roster:${abbrev}`, TTL.roster, () => web(`/roster/${abbrev}/current`)),
    );

    const out = [];
    abbrevs.forEach((abbrev, i) => {
        const roster = rosters[i];
        if (!roster) return;

        for (const [group, position] of [['forwards', 'F'], ['defensemen', 'D'], ['goalies', 'G']]) {
            for (const p of roster[group] ?? []) {
                out.push({
                    id: p.id,
                    name: `${p.firstName?.default ?? ''} ${p.lastName?.default ?? ''}`.trim(),
                    team: abbrev,
                    position: p.positionCode || position,
                    sweaterNumber: p.sweaterNumber ?? null,
                    headshot: p.headshot || headshotUrl(p.id),
                    playing: false,
                    stats: position === 'G'
                        ? { saves: 0, shotsAgainst: 0, goalsAgainst: 0, savePctg: 0 }
                        : { goals: 0, assists: 0, points: 0, plusMinus: 0, shots: 0 },
                });
            }
        }
    });

    return out;
}


/**
 * Etsii seuraavan päivän jolla on otteluita.
 *
 * NHL:n kalenteri palauttaa viikon kerrallaan ja kertoo seuraavan viikon
 * alkupäivän. Kesätauolla peräkkäisiä tyhjiä viikkoja on paljon, joten
 * hakukertoja rajoitetaan — kauden avaus löytyy silti, koska rajapinta
 * hyppää suoraan seuraavaan otteluviikkoon.
 */
async function findNextGameDay(fromDate) {
    return getOrFetch(`nextgameday:${fromDate}`, TTL.schedule, async () => {
        let cursor = fromDate;

        for (let i = 0; i < 8; i++) {
            const data = await web(`/schedule/${cursor}`);
            const days = data.gameWeek ?? [];

            const day = days.find((d) => d.date > fromDate && (d.games?.length ?? 0) > 0);
            if (day) {
                return {
                    date: day.date,
                    gameCount: day.games.length,
                    games: day.games.slice(0, 6).map((g) => ({
                        id: g.id,
                        startTimeUTC: g.startTimeUTC,
                        home: g.homeTeam.abbrev,
                        away: g.awayTeam.abbrev,
                    })),
                };
            }

            if (!data.nextStartDate || data.nextStartDate <= cursor) break;
            cursor = data.nextStartDate;
        }

        return null;
    });
}

/**
 * Päivän kooste. Yksi kutsu, yksi välimuistiavain.
 *
 * @param {string} date  YYYY-MM-DD
 * @param {string} region 'fi' = suomalaiset, 'en' = eurooppalaiset
 */
export async function getGameDay(date, region = 'fi') {
    return getOrFetch(`gameday:${date}:${region}`, TTL.scores, async () => {
        const score = await web(`/score/${date}`);
        const games = score?.games ?? [];

        if (games.length === 0) {
            // Kesätauolla ja pelittöminä päivinä kerrotaan milloin seuraavaksi
            // pelataan. Pelkkä "ei otteluita" jättää käyttäjän pimentoon —
            // ja kausi on tauolla neljä kuukautta vuodessa.
            const next = await findNextGameDay(date).catch(() => null);
            return { date, games: [], hot: [], tracked: [], hasLiveGames: false, next };
        }

        // Kansallisuudet haetaan sen kauden mukaan johon päivä kuuluu, ei
        // nykyhetken mukaan — muuten menneiden päivien selaus ei löydä pelaajia.
        const season = getSeasonId(new Date(`${date}T12:00:00Z`));

        const [played, upcoming, regionPlayers] = await Promise.all([
            fetchBoxscores(games),
            fetchUpcomingRosters(games),
            getPlayersByRegion(region, season).catch(() => new Map()),
        ]);

        const playedWithFlag = played.map((p) => ({ ...p, playing: true }));
        const all = [...playedWithFlag, ...upcoming];

        // Seurattavan alueen pelaajat (suomalaiset / eurooppalaiset)
        const tracked = all
            .filter((p) => regionPlayers.has(p.id))
            .map((p) => ({ ...p, nationality: regionPlayers.get(p.id).nationality }));

        const hot = playedWithFlag.filter(isHot);

        const sortByPoints = (a, b) => {
            if (a.playing !== b.playing) return a.playing ? -1 : 1;
            const pa = a.position === 'G' ? a.stats.saves : a.stats.points;
            const pb = b.position === 'G' ? b.stats.saves : b.stats.points;
            return pb - pa;
        };

        return {
            date,
            games,
            hot: hot.sort(sortByPoints),
            tracked: tracked.sort(sortByPoints),
            hasLiveGames: games.some((g) => LIVE_STATES.has(g.gameState)),
            allFinished: games.every((g) => FINISHED_STATES.has(g.gameState)),
        };
    });
}

/** Yksittäisen ottelun pelaajatilastot valmiiksi normalisoituna. */
export async function getGamePlayers(gameId) {
    return getOrFetch(`gameplayers:${gameId}`, TTL.boxscore, async () => {
        const boxscore = await web(`/gamecenter/${gameId}/boxscore`);
        const game = {
            id: gameId,
            awayTeam: { abbrev: boxscore?.awayTeam?.abbrev ?? 'AWAY' },
            homeTeam: { abbrev: boxscore?.homeTeam?.abbrev ?? 'HOME' },
        };
        return { gameId, players: extractPlayers(boxscore, game) };
    });
}
