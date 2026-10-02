import { web } from '../lib/nhlApi.js';
import { getOrFetch, TTL } from '../lib/cache.js';
import { getSeasonId, getPreviousSeasonId } from '../lib/season.js';
import { getInjuries } from './injuries.js';

/**
 * Kentälliset ottelun vaihdoista.
 *
 * NHL ei julkaise ketjuja, mutta se julkaisee jokaisen vaihdon (shift chart):
 * kuka oli jäällä, milloin ja kuinka pitkään. Siitä lasketaan sekunti
 * sekunnilta, ketkä kenttäpelaajat olivat yhtä aikaa jäällä:
 *
 *   - Ketjut ja puolustajaparit tasakentin (5v5): eniten yhteistä aikaa
 *     pelannut kolmikko on ensimmäinen ketju, sen pelaajat poistetaan, ja
 *     sama toistetaan. Puolustajapareille sama kahden pelaajan yhdistelmillä.
 *   - Ylivoima- ja alivoimakentät: samat yhdistelmät tilanteista, joissa
 *     joukkueella oli jäällä enemmän tai vähemmän kenttäpelaajia kuin
 *     vastustajalla.
 *
 * Tulos kertoo, miten ottelussa oikeasti pelattiin. Illan kokoonpanoa ei
 * julkaise kukaan virallisesti etukäteen, joten tulevaan otteluun näytetään
 * joukkueen edellisen ottelun kentälliset.
 */

const TTL_FINAL = 24 * 60 * 60_000;
const TTL_LIVE = 60_000;

const toSeconds = (mmss) => {
    const [m, s] = String(mmss ?? '').split(':').map(Number);
    return Number.isFinite(m) && Number.isFinite(s) ? m * 60 + s : null;
};

const isForwardCode = (pos) => pos === 'C' || pos === 'L' || pos === 'R';

/** Kaikki k:n kokoiset osajoukot (pienille joukoille: enintään 6 pelaajaa). */
function combinations(items, k) {
    const out = [];
    const walk = (start, picked) => {
        if (picked.length === k) { out.push(picked); return; }
        for (let i = start; i < items.length; i++) walk(i + 1, [...picked, items[i]]);
    };
    walk(0, []);
    return out;
}

/**
 * Ahne valinta: eniten aikaa saanut yhdistelmä ensin, sen pelaajat pois,
 * sitten seuraava. Palauttaa enintään `limit` yhdistelmää.
 */
function pickGroups(times, limit, minSeconds) {
    const sorted = [...times.entries()].sort((a, b) => b[1] - a[1]);
    const used = new Set();
    const picked = [];
    for (const [key, seconds] of sorted) {
        if (picked.length >= limit || seconds < minSeconds) break;
        const ids = key.split('-').map(Number);
        if (ids.some((id) => used.has(id))) continue;
        ids.forEach((id) => used.add(id));
        picked.push({ ids, seconds });
    }
    return picked;
}

/** Hyökkääjät järjestykseen vasen laita – keskushyökkääjä – oikea laita. */
function orderForwards(players) {
    const rank = { L: 0, C: 1, R: 2 };
    return [...players].sort((a, b) => (rank[a.pos] ?? 1) - (rank[b.pos] ?? 1));
}

function computeLines(shifts, roster, homeId) {
    // jäällä[joukkue][erä] = taulukko sekunneittain, jokaisessa kenttäpelaajien joukko
    const onIce = new Map();
    const ensure = (team, period, length) => {
        if (!onIce.has(team)) onIce.set(team, new Map());
        const byPeriod = onIce.get(team);
        if (!byPeriod.has(period)) byPeriod.set(period, Array.from({ length }, () => []));
        return byPeriod.get(period);
    };

    const maxSecond = new Map();
    for (const s of shifts) {
        const end = toSeconds(s.endTime);
        if (end == null) continue;
        maxSecond.set(s.period, Math.max(maxSecond.get(s.period) ?? 0, end));
    }

    for (const s of shifts) {
        const player = roster.get(s.playerId);
        if (!player || player.pos === 'G') continue;
        const start = toSeconds(s.startTime);
        const end = toSeconds(s.endTime);
        if (start == null || end == null || end <= start) continue;
        const seconds = ensure(s.teamId, s.period, (maxSecond.get(s.period) ?? 1200) + 1);
        for (let t = start; t < end && t < seconds.length; t++) seconds[t].push(s.playerId);
    }

    const teams = [...onIce.keys()];
    const result = {};

    for (const team of teams) {
        const opponent = teams.find((t) => t !== team);
        const forwardTrios = new Map();
        const defencePairs = new Map();
        const powerPlay = new Map();
        const penaltyKill = new Map();
        const add = (map, ids) => {
            const key = [...ids].sort((a, b) => a - b).join('-');
            map.set(key, (map.get(key) ?? 0) + 1);
        };

        for (const [period, seconds] of onIce.get(team)) {
            const theirs = onIce.get(opponent)?.get(period) ?? [];
            for (let t = 0; t < seconds.length; t++) {
                const ours = [...new Set(seconds[t])];
                const them = new Set(theirs[t] ?? []).size;
                if (ours.length === 0) continue;

                const forwards = ours.filter((id) => isForwardCode(roster.get(id)?.pos));
                const defence = ours.filter((id) => roster.get(id)?.pos === 'D');

                if (ours.length === 5 && them === 5) {
                    // Tasakenttä: yleensä 3 hyökkääjää ja 2 puolustajaa. Poikkeavat
                    // hetket (esim. 4 hyökkääjää) jaetaan kaikkiin yhdistelmiin.
                    if (forwards.length >= 3 && forwards.length <= 4) combinations(forwards, 3).forEach((c) => add(forwardTrios, c));
                    if (defence.length >= 2 && defence.length <= 3) combinations(defence, 2).forEach((c) => add(defencePairs, c));
                } else if (ours.length > them && them >= 3 && ours.length <= 6) {
                    add(powerPlay, ours);
                } else if (ours.length < them && ours.length >= 3) {
                    add(penaltyKill, ours);
                }
            }
        }

        const toPlayers = (ids) => ids.map((id) => roster.get(id)).filter(Boolean);
        result[team] = {
            isHome: team === homeId,
            forwards: pickGroups(forwardTrios, 4, 60).map((g) => ({ seconds: g.seconds, players: orderForwards(toPlayers(g.ids)) })),
            defence: pickGroups(defencePairs, 3, 60).map((g) => ({ seconds: g.seconds, players: toPlayers(g.ids) })),
            powerPlay: pickGroups(powerPlay, 2, 30).map((g) => ({ seconds: g.seconds, players: toPlayers(g.ids) })),
            penaltyKill: pickGroups(penaltyKill, 2, 30).map((g) => ({ seconds: g.seconds, players: toPlayers(g.ids) })),
        };
    }

    return result;
}

/** Ottelun kentälliset kummallekin joukkueelle. */
export async function getGameLines(gameId) {
    const box = await web(`/gamecenter/${gameId}/boxscore`);
    const state = box.gameState;
    if (state === 'FUT' || state === 'PRE') return { gameId: Number(gameId), available: false, teams: {} };

    const ttl = state === 'FINAL' || state === 'OFF' ? TTL_FINAL : TTL_LIVE;
    return getOrFetch(`lines:${gameId}`, ttl, async () => {
        const res = await fetch(`https://api.nhle.com/stats/rest/en/shiftcharts?cayenneExp=gameId=${gameId}`);
        const shifts = (await res.json())?.data ?? [];

        const roster = new Map();
        for (const side of ['awayTeam', 'homeTeam']) {
            const team = box[side];
            const stats = box.playerByGameStats?.[side] ?? {};
            for (const group of ['forwards', 'defense', 'goalies']) {
                for (const p of stats[group] ?? []) {
                    roster.set(p.playerId, {
                        id: p.playerId,
                        name: p.name?.default,
                        number: p.sweaterNumber ?? null,
                        pos: group === 'goalies' ? 'G' : group === 'defense' ? 'D' : (p.position ?? 'C'),
                        team: team.abbrev,
                        toi: toSeconds(p.toi),
                    });
                }
            }
        }

        // Vaihdot, joilla on kesto (tyypin 517 rivit; maalitapahtumat ovat omia rivejään).
        const realShifts = shifts.filter((s) => s.typeCode === 517 && s.duration);
        const byTeamId = computeLines(realShifts, roster, box.homeTeam?.id);

        const teams = {};
        for (const side of ['awayTeam', 'homeTeam']) {
            const t = box[side];
            if (byTeamId[t.id]) teams[t.abbrev] = byTeamId[t.id];
        }

        // Maalivahdit erikseen: aloittaja ja varamies.
        for (const side of ['awayTeam', 'homeTeam']) {
            const abbrev = box[side]?.abbrev;
            if (!teams[abbrev]) continue;
            teams[abbrev].goalies = (box.playerByGameStats?.[side]?.goalies ?? [])
                .map((g) => ({ ...roster.get(g.playerId), starter: Boolean(g.starter) }))
                .sort((a, b) => (b.toi ?? 0) - (a.toi ?? 0));
        }

        return {
            gameId: Number(gameId),
            available: realShifts.length > 0,
            gameState: state,
            date: box.gameDate,
            away: box.awayTeam?.abbrev,
            home: box.homeTeam?.abbrev,
            teams,
        };
    });
}

/**
 * Joukkueen viimeisimmän pelatun ottelun kentälliset ja tieto siitä, kuka
 * niistä on nyt loukkaantuneena. Harjoitusotteluita ei käytetä: niissä
 * kokoonpanot ovat kokeiluja.
 */
export async function getLatestLines(abbrev) {
    return getOrFetch(`lines-latest:${abbrev}`, 15 * 60_000, async () => {
        let game = null;
        for (const season of [getSeasonId(), getPreviousSeasonId()]) {
            const schedule = await web(`/club-schedule-season/${abbrev}/${season}`).catch(() => null);
            const played = (schedule?.games ?? [])
                .filter((g) => (g.gameState === 'FINAL' || g.gameState === 'OFF') && g.gameType !== 1)
                .sort((a, b) => b.startTimeUTC.localeCompare(a.startTimeUTC));
            if (played.length) { game = played[0]; break; }
        }
        if (!game) return { abbrev, available: false };

        const [lines, injuries] = await Promise.all([
            getGameLines(game.id),
            getInjuries().catch(() => ({ rows: [] })),
        ]);
        const injured = (injuries.rows ?? [])
            .filter((r) => r.team === abbrev && r.id)
            .map((r) => ({ id: r.id, status: r.status, statusCode: r.statusCode, returnDate: r.returnDate }));

        const opponent = game.homeTeam.abbrev === abbrev ? game.awayTeam.abbrev : game.homeTeam.abbrev;
        return {
            abbrev,
            available: lines.available,
            gameId: game.id,
            date: game.gameDate,
            opponent,
            isHome: game.homeTeam.abbrev === abbrev,
            lines: lines.teams?.[abbrev] ?? null,
            injured,
        };
    });
}

export const LINES_TTL = { final: TTL_FINAL, live: TTL_LIVE, roster: TTL.roster };
