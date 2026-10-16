import { web } from '../lib/nhlApi.js';
import { getOrFetch, TTL } from '../lib/cache.js';
import { getSeasonId } from '../lib/season.js';

/**
 * Pelaajakortti lähes reaaliajassa.
 *
 * NHL:n pelaajasivu (`/player/{id}/landing`) ja ottelulokit päivittyvät
 * samalla viiveellä kuin tilastorajapinta: noin kaksi tuntia ottelun
 * jälkeen. Ottelupöytäkirja (boxscore) päivittyy sen sijaan ottelun aikana.
 *
 * Kortin luvut täydennetään siksi pöytäkirjoista: joukkueen otteluohjelmasta
 * haetaan pelaajan viimeisimmän kirjatun ottelun jälkeen pelatut ja käynnissä
 * olevat ottelut, ja pelaajan rivi niistä lisätään kauden ja uran lukuihin
 * sekä viimeisiin otteluihin. Kun NHL:n oma data ehtii perään, ottelu on jo
 * viimeisissä otteluissa eikä sitä lisätä toista kertaa.
 */

/** Virallinen pelaajasivu: ei muutu kuin otteluiden jälkeen. */
const TTL_LANDING = 10 * 60_000;
/** Täydennetty versio: lyhyt, jotta käynnissä olevan ottelun pisteet näkyvät. */
const TTL_PATCHED = 60_000;
/** Näin monen päivän takaisia otteluita täydennetään (viive on tunteja). */
const MAX_DAYS_BACK = 3;

const PLAYED = new Set(['LIVE', 'CRIT', 'FINAL', 'OFF']);
const LIVE = new Set(['LIVE', 'CRIT']);

const toSeconds = (mmss) => {
    const [m, s] = String(mmss ?? '').split(':').map(Number);
    return Number.isFinite(m) && Number.isFinite(s) ? m * 60 + s : 0;
};
const mmss = (seconds) => `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')}`;
const add = (a, b) => (a ?? 0) + (b ?? 0);

export function getOfficialLanding(id) {
    return getOrFetch(`player:${id}`, TTL_LANDING, () => web(`/player/${id}/landing`));
}

/**
 * Pelaajan pöytäkirjarivit otteluista, jotka ovat `sinceDate`-päivän jälkeen
 * (tai joita ei ole `knownIds`-joukossa). Uusin ensin. Rivit ovat samaa
 * muotoa kuin NHL:n `last5Games` ja ottelulokin rivit.
 */
export async function recentPlayerGames(playerId, team, sinceDate, knownIds = new Set()) {
    if (!team) return [];
    const season = getSeasonId();
    const schedule = await getOrFetch(`clubschedule:${team}:${season}`, TTL.schedule, () =>
        web(`/club-schedule-season/${team}/${season}`)).catch(() => null);

    const now = Date.now();
    const earliest = now - MAX_DAYS_BACK * 24 * 60 * 60_000;
    const candidates = (schedule?.games ?? []).filter((g) => {
        const start = Date.parse(g.startTimeUTC);
        return (g.gameType === 2 || g.gameType === 3)
            && start <= now && start >= earliest
            && (!sinceDate || g.gameDate > sinceDate)
            && !knownIds.has(g.id);
    });

    const lines = [];
    for (const game of candidates) {
        const box = await getOrFetch(`boxscore:${game.id}`, TTL.boxscore, () => web(`/gamecenter/${game.id}/boxscore`)).catch(() => null);
        if (!box || !PLAYED.has(box.gameState)) continue;

        const side = box.homeTeam?.abbrev === team ? 'homeTeam' : 'awayTeam';
        const other = side === 'homeTeam' ? 'awayTeam' : 'homeTeam';
        const stats = box.playerByGameStats?.[side] ?? {};
        const base = {
            gameId: game.id,
            gameDate: game.gameDate,
            gameTypeId: game.gameType,
            teamAbbrev: team,
            opponentAbbrev: box[other]?.abbrev,
            homeRoadFlag: side === 'homeTeam' ? 'H' : 'R',
            live: LIVE.has(box.gameState),
        };

        const skater = [...(stats.forwards ?? []), ...(stats.defense ?? [])].find((p) => p.playerId === Number(playerId));
        if (skater && toSeconds(skater.toi) > 0) {
            lines.push({
                ...base,
                kind: 'skater',
                goals: skater.goals ?? 0,
                assists: skater.assists ?? 0,
                points: skater.points ?? add(skater.goals, skater.assists),
                plusMinus: skater.plusMinus ?? 0,
                pim: skater.pim ?? 0,
                powerPlayGoals: skater.powerPlayGoals ?? 0,
                shots: skater.sog ?? 0,
                shifts: skater.shifts ?? 0,
                toi: skater.toi,
            });
            continue;
        }

        const goalies = (stats.goalies ?? []).filter((g) => toSeconds(g.toi) > 0);
        const goalie = goalies.find((g) => g.playerId === Number(playerId));
        if (goalie) {
            const extra = ['OT', 'SO'].includes(box.gameOutcome?.lastPeriodType);
            lines.push({
                ...base,
                kind: 'goalie',
                // Ratkaisu kirjataan vasta ottelun päätyttyä.
                decision: base.live ? null : (goalie.decision === 'L' && extra ? 'O' : goalie.decision ?? null),
                // Päättyneen ottelun pöytäkirjasta aloittajatieto voi puuttua.
                gamesStarted: goalie.starter || goalies.length === 1 ? 1 : 0,
                goalsAgainst: goalie.goalsAgainst ?? 0,
                shotsAgainst: goalie.shotsAgainst ?? 0,
                savePctg: goalie.shotsAgainst ? (goalie.saves ?? 0) / goalie.shotsAgainst : null,
                penaltyMins: goalie.pim ?? 0,
                toi: goalie.toi,
                shutout: !base.live && goalie.decision === 'W' && goalie.goalsAgainst === 0 && goalies.length === 1,
            });
        }
    }
    return lines.sort((a, b) => b.gameDate.localeCompare(a.gameDate) || b.gameId - a.gameId);
}

function addSkaterLine(s, line) {
    s.gamesPlayed = add(s.gamesPlayed, 1);
    s.goals = add(s.goals, line.goals);
    s.assists = add(s.assists, line.assists);
    s.points = add(s.points, line.points);
    s.plusMinus = add(s.plusMinus, line.plusMinus);
    s.pim = add(s.pim, line.pim);
    s.powerPlayGoals = add(s.powerPlayGoals, line.powerPlayGoals);
    s.shots = add(s.shots, line.shots);
    s.shootingPctg = s.shots > 0 ? s.goals / s.shots : null;
}

/**
 * Maalivahdin luvut. Kauden ja uran torjunta-% ja päästettyjen keskiarvo
 * lasketaan uudelleen laukauksista ja peliajasta, kun ne ovat tiedossa
 * (kausirivit ja ura). Kärkiluvuissa niitä ei ole, joten ne kopioidaan
 * kauden riviltä jälkikäteen.
 */
function addGoalieLine(s, line) {
    s.gamesPlayed = add(s.gamesPlayed, 1);
    s.gamesStarted = add(s.gamesStarted, line.gamesStarted);
    if (line.decision === 'W') s.wins = add(s.wins, 1);
    if (line.decision === 'L') s.losses = add(s.losses, 1);
    if (line.decision === 'O') s.otLosses = add(s.otLosses, 1);
    if (line.shutout) s.shutouts = add(s.shutouts, 1);
    if (s.shotsAgainst != null && s.goalsAgainst != null) {
        s.goalsAgainst = add(s.goalsAgainst, line.goalsAgainst);
        s.shotsAgainst = add(s.shotsAgainst, line.shotsAgainst);
        s.savePctg = s.shotsAgainst > 0 ? 1 - s.goalsAgainst / s.shotsAgainst : null;
        if (s.timeOnIce) {
            const seconds = toSeconds(s.timeOnIce) + toSeconds(line.toi);
            s.timeOnIce = mmss(seconds);
            s.goalsAgainstAvg = seconds > 0 ? (s.goalsAgainst * 3600) / seconds : null;
        }
    }
}

/** Viimeisten otteluiden rivi; `live` jää mukaan, jotta kortti voi merkitä käynnissä olevan. */
function lastFiveLine({ kind: _kind, shutout: _shutout, ...rest }) {
    return rest;
}

function patchLanding(landing, lines) {
    const out = structuredClone(landing);
    const season = Number(getSeasonId());

    for (const line of [...lines].reverse()) {
        const playoffs = line.gameTypeId === 3;
        const apply = line.kind === 'goalie' ? addGoalieLine : addSkaterLine;

        const featured = out.featuredStats ?? (out.featuredStats = { season });
        const bucket = playoffs ? 'playoffs' : 'regularSeason';
        if (!featured[bucket]) featured[bucket] = {};
        if (!featured[bucket].subSeason) featured[bucket].subSeason = {};
        if (!out.careerTotals) out.careerTotals = {};
        if (!out.careerTotals[bucket]) out.careerTotals[bucket] = {};

        // Kauden rivi; kesken kauden vaihtaneella viimeisin (nykyinen joukkue).
        const seasonEntries = (out.seasonTotals ?? [])
            .filter((s) => s.season === season && s.leagueAbbrev === 'NHL' && s.gameTypeId === line.gameTypeId);
        const seasonEntry = seasonEntries.at(-1);

        apply(featured[bucket].subSeason, line);
        apply(out.careerTotals[bucket], line);
        if (seasonEntry) apply(seasonEntry, line);

        if (line.kind === 'goalie' && seasonEntries.length === 1) {
            featured[bucket].subSeason.savePctg = seasonEntry.savePctg;
            featured[bucket].subSeason.goalsAgainstAvg = seasonEntry.goalsAgainstAvg;
        }
    }

    out.last5Games = [...lines.map(lastFiveLine), ...(out.last5Games ?? [])].slice(0, 5);
    out.provisional = { games: lines.length, live: lines.some((l) => l.live) };
    return out;
}

/** Pelaajasivu täydennettynä viimeisimmillä otteluilla. */
export async function getPlayerLanding(id) {
    return getOrFetch(`player-live:${id}`, TTL_PATCHED, async () => {
        const landing = await getOfficialLanding(id);
        // Kauden vaihteessa kärkiluvut ovat vielä edelliseltä kaudelta: ei täydennetä.
        if (!landing?.isActive || String(landing.featuredStats?.season ?? '') !== getSeasonId()) return landing;

        const known = new Set((landing.last5Games ?? []).map((g) => g.gameId));
        const lines = await recentPlayerGames(id, landing.currentTeamAbbrev, landing.last5Games?.[0]?.gameDate, known)
            .catch(() => []);
        return lines.length ? patchLanding(landing, lines) : landing;
    });
}
