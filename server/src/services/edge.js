import { web } from '../lib/nhlApi.js';
import { getOrFetch, TTL } from '../lib/cache.js';
import { getSeasonId, getPreviousSeasonId } from '../lib/season.js';

/**
 * NHL EDGE: pelaaja- ja kiekkoseurannan mittaukset (luistelunopeus,
 * laukausnopeus, luistelumatka, aika hyökkäysalueella).
 *
 * Rajapinta antaa kärkilistat (10 parasta) eikä koko liigaa, joten jokaisesta
 * luokasta haetaan kaksi eri järjestystä ja yhdistetään: esimerkiksi
 * huippunopeuden ja 35 km/h ylittäneiden pyrähdysten kärjet. Luvut
 * muunnetaan metrijärjestelmään jo täällä.
 */

export const EDGE_CATEGORIES = ['speed', 'shot', 'distance', 'zone', 'teams'];
export const EDGE_POSITIONS = ['all', 'F', 'D'];

const TTL_EDGE = 60 * 60_000;
const TTL_PAST = 24 * 60 * 60_000;

/** Kärkilistojen osoitteet: yksi tai kaksi järjestystä per luokka. */
const SOURCES = {
    speed: (pos, season, gt) => [`/edge/skater-speed-top-10/${pos}/max/${season}/${gt}`, `/edge/skater-speed-top-10/${pos}/over-22/${season}/${gt}`],
    shot: (pos, season, gt) => [`/edge/skater-shot-speed-top-10/${pos}/max/${season}/${gt}`],
    distance: (pos, season, gt) => [`/edge/skater-distance-top-10/${pos}/all/total/${season}/${gt}`, `/edge/skater-distance-top-10/${pos}/all/per-60/${season}/${gt}`],
    zone: (pos, season, gt) => [`/edge/skater-zone-time-top-10/${pos}/all/offensive/${season}/${gt}`],
    teams: (_pos, season, gt) => [`/edge/team-skating-speed-top-10/all/max/${season}/${gt}`],
};

const round = (v, d = 1) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 10 ** d) / 10 ** d);

/** Pelaaja-ID kärkilistoissa on vain osoitteen lopussa ("beck-malenstyn-8479359"). */
const idFromSlug = (slug) => {
    const match = /-(\d{7})$/.exec(slug ?? '');
    return match ? Number(match[1]) : null;
};

/** Ottelu, jossa ennätys syntyi: "WSH–BUF 12.3.2026". */
function overlayGame(overlay) {
    if (!overlay?.gameDate) return null;
    return {
        date: overlay.gameDate,
        away: overlay.awayTeam?.abbrev,
        home: overlay.homeTeam?.abbrev,
        period: overlay.periodDescriptor?.number ?? null,
        time: overlay.timeInPeriod ?? null,
    };
}

function normaliseRow(category, item) {
    if (category === 'teams') {
        return {
            id: item.team?.abbrev,
            team: item.team?.abbrev,
            maxSpeed: round(item.maxSkatingSpeed?.metric),
            bursts22: item.burstsOver22,
            bursts20: item.bursts20To22,
            bursts18: item.bursts18To20,
            record: overlayGame(item.maxSkatingSpeed?.overlay),
        };
    }

    const p = item.player ?? {};
    const base = {
        id: idFromSlug(p.slug),
        name: `${p.firstName?.default ?? ''} ${p.lastName?.default ?? ''}`.trim(),
        team: p.team?.abbrev ?? null,
        pos: p.position ?? null,
    };

    switch (category) {
        case 'speed':
            return {
                ...base,
                maxSpeed: round(item.maxSpeed?.metric),
                bursts22: item.burstsOver22,
                bursts20: item.bursts20To22,
                record: overlayGame(item.maxSpeed?.overlay),
            };
        case 'shot':
            return {
                ...base,
                hardest: round(item.hardestShot?.metric),
                over100: item.shotAttemptsOver100,
                s90to100: item.shotAttempts90To100,
                s80to90: item.shotAttempts80To90,
                record: overlayGame(item.hardestShot?.overlay),
            };
        case 'distance':
            return {
                ...base,
                total: round(item.distanceTotal?.metric),
                per60: round(item.distancePer60?.metric, 2),
                maxGame: round(item.distanceMaxPerGame?.metric, 2),
                record: overlayGame(item.distanceMaxPerGame?.overlay),
            };
        case 'zone':
            return {
                ...base,
                oz: item.offensiveZoneTime,
                nz: item.neutralZoneTime,
                dz: item.defensiveZoneTime,
            };
        default:
            return base;
    }
}

async function fetchLeaders(category, pos, season, gameType) {
    const urls = SOURCES[category](pos, season, gameType);
    const lists = await Promise.all(urls.map((u) => web(u).catch(() => [])));
    const seen = new Map();
    for (const list of lists) {
        for (const item of Array.isArray(list) ? list : []) {
            const row = normaliseRow(category, item);
            if (row.id && !seen.has(row.id)) seen.set(row.id, row);
        }
    }
    return [...seen.values()];
}

export async function getEdgeLeaders(category, { pos = 'all', season, gameType = 2 } = {}) {
    const requested = season ?? getSeasonId();
    const ttl = requested === getSeasonId() ? TTL_EDGE : TTL_PAST;

    return getOrFetch(`edge:${category}:${pos}:${requested}:${gameType}:${season ? 'fixed' : 'auto'}`, ttl, async () => {
        let rows = await fetchLeaders(category, pos, requested, gameType);
        let used = requested;
        let isPreviousSeason = false;

        if (rows.length === 0 && !season) {
            const previous = getPreviousSeasonId();
            const fallback = await fetchLeaders(category, pos, previous, gameType);
            if (fallback.length > 0) {
                rows = fallback;
                used = previous;
                isPreviousSeason = true;
            }
        }

        return { category, pos, season: used, gameType, isPreviousSeason, rows };
    });
}

// ---------------------------------------------------------------------------
// Yksittäinen pelaaja
// ---------------------------------------------------------------------------

const metric = (m, d = 1) => (m ? { value: round(m.metric, d), percentile: m.percentile ?? null, avg: round(m.leagueAvg?.metric, d) } : null);

function compactSkater(data, season) {
    const zone = data.zoneTimeDetails ?? {};
    const sog = (data.sogSummary ?? []).find((s) => s.locationCode === 'all');
    return {
        type: 'skater',
        season,
        maxSpeed: metric(data.skatingSpeed?.speedMax),
        bursts20: data.skatingSpeed?.burstsOver20
            ? { value: data.skatingSpeed.burstsOver20.value, percentile: data.skatingSpeed.burstsOver20.percentile, avg: round(data.skatingSpeed.burstsOver20.leagueAvg?.value) }
            : null,
        topShot: metric(data.topShotSpeed),
        distance: metric(data.totalDistanceSkated),
        distanceMaxGame: metric(data.distanceMaxGame, 2),
        ozPct: zone.offensiveZonePctg != null
            ? { value: zone.offensiveZonePctg, percentile: zone.offensiveZonePercentile, avg: zone.offensiveZoneLeagueAvg }
            : null,
        dzPct: zone.defensiveZonePctg != null
            ? { value: zone.defensiveZonePctg, percentile: zone.defensiveZonePercentile, avg: zone.defensiveZoneLeagueAvg }
            : null,
        shots: sog ? { value: sog.shots, percentile: sog.shotsPercentile, avg: round(sog.shotsLeagueAvg) } : null,
    };
}

function compactGoalie(data, season) {
    const s = data.stats ?? {};
    const all = (data.shotLocationSummary ?? []).find((x) => x.locationCode === 'all');
    const high = (data.shotLocationSummary ?? []).find((x) => x.locationCode === 'high');
    const pick = (m) => (m ? { value: m.value, percentile: m.percentile, avg: m.leagueAvg } : null);
    return {
        type: 'goalie',
        season,
        gaa: pick(s.goalsAgainstAvg),
        gamesAbove900: pick(s.gamesAbove900),
        goalSupport: pick(s.goalSupportAvg),
        savePct: all ? { value: all.savePctg, percentile: all.savePctgPercentile, avg: all.savePctgLeagueAvg } : null,
        hdSavePct: high ? { value: high.savePctg, percentile: high.savePctgPercentile, avg: high.savePctgLeagueAvg } : null,
    };
}

/** Pelaajan EDGE-luvut kuluvalta kaudelta, ennen avausta edelliseltä. */
export async function getEdgePlayer(id, isGoalie) {
    const kind = isGoalie ? 'goalie' : 'skater';
    return getOrFetch(`edge-player:${kind}:${id}`, TTL.player, async () => {
        const seasons = [getSeasonId(), getPreviousSeasonId()];
        for (const season of seasons) {
            try {
                const data = await web(`/edge/${kind}-detail/${id}/${season}/2`);
                const compact = isGoalie ? compactGoalie(data, season) : compactSkater(data, season);
                const hasData = isGoalie ? compact.savePct : compact.maxSpeed || compact.topShot;
                if (hasData) return compact;
            } catch {
                // Ei EDGE-dataa tältä kaudelta: kokeillaan edellistä.
            }
        }
        return null;
    });
}
