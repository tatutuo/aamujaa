import { stats } from '../lib/nhlApi.js';
import { getOrFetch, TTL } from '../lib/cache.js';
import { getSeasonId, getPreviousSeasonId } from '../lib/season.js';
import { abbrevFromName } from '../lib/teams.js';

/**
 * Tilastotaulukot: kenttäpelaajat, maalivahdit ja joukkueet kokonaisina.
 *
 * Aiempi /leaders palautti valmiiksi lajitellun kärjen (enintään 100).
 * pucknowerin taulukko lajittelee ja suodattaa selaimessa, joten se tarvitsee
 * koko listan: jokainen sarakkeen napautus, suodatinsiru tai haku on silloin
 * välitön eikä vaadi uutta pyyntöä.
 *
 * Kenttäpelaajille yhdistetään kolme NHL:n raporttia pelaaja-ID:n perusteella:
 *   summary  — pisteet, maalit, ylivoima, laukaukset, peliaika
 *   realtime — taklaukset, blokit, riistot, menetykset
 *   bios     — kansallisuus, syntymäaika, draft
 * ja tulokkaat erillisellä isRookie-kyselyllä.
 */

export const CATEGORIES = ['skaters', 'goalies', 'teams'];

/**
 * Aloitusprosentti näytetään vasta tästä määrästä alkaen. Laitahyökkääjän
 * kolme aloitusta antaisi 0 % tai 100 %, mikä näyttää taulukossa virheeltä
 * eikä kerro mitään.
 */
const MIN_FACEOFFS = 50;

/** Päättyneen kauden luvut eivät muutu, joten niitä ei tarvitse hakea uudelleen. */
const TTL_PAST_SEASON = 24 * 60 * 60_000;

const ALL = { limit: -1 };

const expression = (season, gameType, extra = '') =>
    `seasonId=${season} and gameTypeId=${gameType}${extra}`;

/** Viimeinen joukkue, jos pelaaja on vaihtanut kesken kauden ("TOR,DAL" -> "DAL"). */
const currentTeam = (abbrevs) => (abbrevs ? String(abbrevs).split(',').pop().trim() : null);

/** Ikä täysinä vuosina syntymäajasta. */
function ageFrom(birthDate, today = new Date()) {
    if (!birthDate) return null;
    const born = new Date(`${birthDate}T12:00:00Z`);
    let age = today.getUTCFullYear() - born.getUTCFullYear();
    const hadBirthday = today.getUTCMonth() > born.getUTCMonth()
        || (today.getUTCMonth() === born.getUTCMonth() && today.getUTCDate() >= born.getUTCDate());
    if (!hadBirthday) age -= 1;
    return age;
}

const byId = (rows) => new Map((rows ?? []).map((r) => [r.playerId, r]));

async function fetchSkaters(season, gameType) {
    const cayenneExp = expression(season, gameType);
    const [summary, realtime, bios, faceoffs, rookies] = await Promise.all([
        stats('skater/summary', { ...ALL, cayenneExp }),
        stats('skater/realtime', { ...ALL, cayenneExp }).catch(() => null),
        stats('skater/bios', { ...ALL, cayenneExp }).catch(() => null),
        stats('skater/faceoffwins', { ...ALL, cayenneExp }).catch(() => null),
        stats('skater/summary', { ...ALL, cayenneExp: expression(season, gameType, ' and isRookie=1') }).catch(() => null),
    ]);

    const rt = byId(realtime?.data);
    const bio = byId(bios?.data);
    const fo = byId(faceoffs?.data);
    const rookieIds = new Set((rookies?.data ?? []).map((r) => r.playerId));

    return (summary?.data ?? []).map((s) => {
        const r = rt.get(s.playerId) ?? {};
        const b = bio.get(s.playerId) ?? {};
        const f = fo.get(s.playerId) ?? {};
        const totalFaceoffs = f.totalFaceoffs ?? 0;
        return {
            id: s.playerId,
            name: s.skaterFullName,
            team: currentTeam(s.teamAbbrevs),
            pos: s.positionCode,
            nat: b.nationalityCode ?? null,
            age: ageFrom(b.birthDate),
            rookie: rookieIds.has(s.playerId),
            draftYear: b.draftYear ?? null,
            draftOverall: b.draftOverall ?? null,

            gp: s.gamesPlayed,
            goals: s.goals,
            assists: s.assists,
            points: s.points,
            pointsPerGame: s.pointsPerGame,
            plusMinus: s.plusMinus,
            pim: s.penaltyMinutes,
            evGoals: s.evGoals,
            evPoints: s.evPoints,
            ppGoals: s.ppGoals,
            ppPoints: s.ppPoints,
            shGoals: s.shGoals,
            shPoints: s.shPoints,
            gwg: s.gameWinningGoals,
            otGoals: s.otGoals,
            shots: s.shots,
            shootingPct: s.shootingPct,
            toi: s.timeOnIcePerGame,
            faceoffs: totalFaceoffs,
            faceoffPct: totalFaceoffs >= MIN_FACEOFFS ? (f.faceoffWinPct ?? s.faceoffWinPct) : null,

            hits: r.hits ?? null,
            blocks: r.blockedShots ?? null,
            takeaways: r.takeaways ?? null,
            giveaways: r.giveaways ?? null,
            shotAttempts: r.totalShotAttempts ?? null,
            missedShots: r.missedShots ?? null,
            posts: (r.missedShotGoalpost ?? 0) + (r.missedShotCrossbar ?? 0),
            firstGoals: r.firstGoals ?? null,
            emptyNetGoals: r.emptyNetGoals ?? null,
        };
    });
}

async function fetchGoalies(season, gameType) {
    const cayenneExp = expression(season, gameType);
    const [summary, bios, rookies] = await Promise.all([
        stats('goalie/summary', { ...ALL, cayenneExp }),
        stats('goalie/bios', { ...ALL, cayenneExp }).catch(() => null),
        stats('goalie/summary', { ...ALL, cayenneExp: expression(season, gameType, ' and isRookie=1') }).catch(() => null),
    ]);

    const bio = byId(bios?.data);
    const rookieIds = new Set((rookies?.data ?? []).map((r) => r.playerId));

    return (summary?.data ?? []).map((g) => {
        const b = bio.get(g.playerId) ?? {};
        return {
            id: g.playerId,
            name: g.goalieFullName,
            team: currentTeam(g.teamAbbrevs),
            pos: 'G',
            nat: b.nationalityCode ?? null,
            age: ageFrom(b.birthDate),
            rookie: rookieIds.has(g.playerId),

            gp: g.gamesPlayed,
            gs: g.gamesStarted,
            wins: g.wins,
            losses: g.losses,
            otLosses: g.otLosses,
            savePct: g.savePct,
            gaa: g.goalsAgainstAverage,
            shutouts: g.shutouts,
            saves: g.saves,
            shotsAgainst: g.shotsAgainst,
            goalsAgainst: g.goalsAgainst,
            // Kokonaispeliaika sekunteina; selain laskee siitä minuutit per ottelu.
            toiTotal: g.timeOnIce,
            goals: g.goals,
            assists: g.assists,
            points: g.points,
            pim: g.penaltyMinutes,
        };
    });
}

async function fetchTeams(season, gameType) {
    const cayenneExp = expression(season, gameType);
    const [summary, realtime] = await Promise.all([
        stats('team/summary', { ...ALL, cayenneExp }),
        stats('team/realtime', { ...ALL, cayenneExp }).catch(() => null),
    ]);

    const rt = new Map((realtime?.data ?? []).map((r) => [r.teamId, r]));

    return (summary?.data ?? []).map((t) => {
        const r = rt.get(t.teamId) ?? {};
        return {
            id: t.teamId,
            team: abbrevFromName(t.teamFullName),
            name: t.teamFullName,

            gp: t.gamesPlayed,
            wins: t.wins,
            losses: t.losses,
            otLosses: t.otLosses,
            points: t.points,
            pointPct: t.pointPct,
            regWins: t.winsInRegulation,
            rowWins: t.regulationAndOtWins,
            soWins: t.winsInShootout,
            goalsFor: t.goalsFor,
            goalsAgainst: t.goalsAgainst,
            goalDiff: (t.goalsFor ?? 0) - (t.goalsAgainst ?? 0),
            gfPerGame: t.goalsForPerGame,
            gaPerGame: t.goalsAgainstPerGame,
            ppPct: t.powerPlayPct,
            pkPct: t.penaltyKillPct,
            ppNetPct: t.powerPlayNetPct,
            pkNetPct: t.penaltyKillNetPct,
            shotsForPerGame: t.shotsForPerGame,
            shotsAgainstPerGame: t.shotsAgainstPerGame,
            faceoffPct: t.faceoffWinPct,
            shutouts: t.teamShutouts,

            hits: r.hits ?? null,
            blocks: r.blockedShots ?? null,
            takeaways: r.takeaways ?? null,
            giveaways: r.giveaways ?? null,
            corsiPct: r.satPct ?? null,
        };
    });
}

const FETCHERS = { skaters: fetchSkaters, goalies: fetchGoalies, teams: fetchTeams };

/**
 * @param {'skaters'|'goalies'|'teams'} category
 * @param {{season?: string, gameType?: 2|3}} options
 */
export async function getStatsTable(category, { season, gameType = 2 } = {}) {
    const fetcher = FETCHERS[category];
    if (!fetcher) {
        const err = new Error('Tuntematon tilastoluokka');
        err.status = 400;
        throw err;
    }

    const requested = season ?? getSeasonId();
    const isCurrent = requested === getSeasonId();
    const ttl = isCurrent ? TTL.stats : TTL_PAST_SEASON;

    return getOrFetch(`statsTable:${category}:${requested}:${gameType}:${season ? 'fixed' : 'auto'}`, ttl, async () => {
        let rows = await fetcher(requested, gameType);
        let used = requested;
        let isPreviousSeason = false;

        // Ennen kauden avausta kuluvalla kaudella ei ole otteluita. Näytetään
        // silloin edellinen kausi eikä tyhjää taulukkoa — mutta vain jos
        // käyttäjä ei pyytänyt tiettyä kautta.
        if (rows.length === 0 && !season) {
            const previous = getPreviousSeasonId();
            const fallback = await fetcher(previous, gameType);
            if (fallback.length > 0) {
                rows = fallback;
                used = previous;
                isPreviousSeason = true;
            }
        }

        return { category, season: used, gameType, isPreviousSeason, rows };
    });
}
