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

// ---------------------------------------------------------------------------
// Paikat ketjussa
// ---------------------------------------------------------------------------
//
// Nimilistan pelipaikka (L/C/R) kertoo pelaajan tavallisen paikan, ei sitä
// missä hän illalla pelasi: kaksi vasenta laitaa voi pelata samassa ketjussa,
// ja keskushyökkääjä voi pelata laidassa. Siksi:
//
//   - Keskushyökkääjä on ketjun se pelaaja, joka otti eniten aloituksia.
//     Aloitukset ovat ottelun luotettavin vihje: keskushyökkääjä ottaa
//     lähes kaikki oman ketjunsa aloitukset.
//   - Laidat jaetaan "vasemmuuden" mukaan: nimilistan pelipaikka painaa
//     eniten, laukaisukäsi ratkaisee jos pelipaikat ovat samat (vasemmalta
//     laukova pelaa tavallisesti vasenta laitaa).
//   - Puolustajaparissa vasemmalta laukova vasemmalle.

const leftness = (p) => (p.pos === 'L' ? 2 : p.pos === 'R' ? -2 : 0) + (p.shoots === 'L' ? 1 : p.shoots === 'R' ? -1 : 0);

function pickCentre(players) {
    return [...players].sort((a, b) => (b.faceoffs ?? 0) - (a.faceoffs ?? 0)
        || (b.pos === 'C') - (a.pos === 'C'))[0];
}

/** Hyökkääjät paikoilleen: [vasen laita…, keskushyökkääjä, oikea laita…], jokaisella slot. */
export function assignForwardSlots(players) {
    if (players.length === 0) return [];
    if (players.length === 1) return [{ ...players[0], slot: players[0].pos }];

    const centre = pickCentre(players);
    const wings = players.filter((p) => p !== centre).sort((a, b) => leftness(b) - leftness(a));

    if (wings.length === 1) {
        const wing = wings[0];
        return leftness(wing) >= 0
            ? [{ ...wing, slot: 'L' }, { ...centre, slot: 'C' }]
            : [{ ...centre, slot: 'C' }, { ...wing, slot: 'R' }];
    }
    const half = Math.ceil(wings.length / 2);
    return [
        ...wings.slice(0, half).map((p) => ({ ...p, slot: 'L' })),
        { ...centre, slot: 'C' },
        ...wings.slice(half).map((p) => ({ ...p, slot: 'R' })),
    ];
}

/** Puolustajat järjestykseen: vasemmalta laukova vasemmalle. */
export function orderDefence(players) {
    return [...players]
        .sort((a, b) => (a.shoots === 'L' ? 0 : 1) - (b.shoots === 'L' ? 0 : 1))
        .map((p, i, list) => ({ ...p, slot: list.length === 2 ? (i === 0 ? 'LD' : 'RD') : 'D' }));
}

/**
 * Yli- tai alivoimakenttä: hyökkääjät ja puolustajat erikseen. Laitoja ei
 * nimetä, koska erikoistilanteissa ei pelata laitapaikoilla (ylivoiman
 * 1-3-1, alivoiman boksi): vain aloittaja merkitään keskushyökkääjäksi,
 * muut ovat hyökkääjiä (slot F). Järjestys silti vasemmalta oikealle.
 */
export function splitUnit(players) {
    const forwards = assignForwardSlots(players.filter((p) => isForwardCode(p.pos)))
        .map((p) => (p.slot === 'C' ? p : { ...p, slot: 'F' }));
    return {
        forwards,
        defence: orderDefence(players.filter((p) => p.pos === 'D')),
    };
}

/**
 * Alivoimakentät pareista: n:s hyökkääjäpari ja n:s puolustajapari samaan
 * kenttään. Aika on hyökkääjäparin yhteinen alivoima-aika (puolustajaparin
 * oma aika mukana erikseen).
 */
export function penaltyKillUnits(forwardPairs, defencePairs, toPlayers) {
    const count = Math.max(forwardPairs.length, defencePairs.length);
    return Array.from({ length: count }, (_, i) => {
        const f = forwardPairs[i];
        const d = defencePairs[i];
        return {
            seconds: f?.seconds ?? d.seconds,
            defenceSeconds: f && d ? d.seconds : undefined,
            forwards: f ? assignForwardSlots(toPlayers(f.ids)).map((p) => (p.slot === 'C' ? p : { ...p, slot: 'F' })) : [],
            defence: d ? orderDefence(toPlayers(d.ids)) : [],
        };
    });
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
        const pkForwardPairs = new Map();
        const pkDefencePairs = new Map();
        // Pelaajan oma tasakenttäaika: ketjun yhtenäisyys suhteutetaan siihen.
        const evenSeconds = new Map();
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
                    for (const id of ours) evenSeconds.set(id, (evenSeconds.get(id) ?? 0) + 1);
                    // Tasakenttä: yleensä 3 hyökkääjää ja 2 puolustajaa. Poikkeavat
                    // hetket (esim. 4 hyökkääjää) jaetaan kaikkiin yhdistelmiin.
                    if (forwards.length >= 3 && forwards.length <= 4) combinations(forwards, 3).forEach((c) => add(forwardTrios, c));
                    if (defence.length >= 2 && defence.length <= 3) combinations(defence, 2).forEach((c) => add(defencePairs, c));
                } else if (ours.length > them && ours.length <= 5 && them >= 3) {
                    // Ylivoima (5v4, 5v3, 4v3). Kuusi kenttäpelaajaa tarkoittaa
                    // tyhjää maalia tai viivästettyä jäähyä, ei ylivoimaa.
                    add(powerPlay, ours);
                } else if (ours.length < them && ours.length >= 3 && them <= 5) {
                    // Alivoima. Vastustajan kuusi kenttäpelaajaa = maalivahti
                    // pois, sitä ei lasketa. Hyökkääjä- ja puolustajaparit
                    // vaihtuvat alivoimalla eri tahtiin, joten ne lasketaan erikseen.
                    if (forwards.length >= 2 && forwards.length <= 3) combinations(forwards, 2).forEach((c) => add(pkForwardPairs, c));
                    if (defence.length >= 2 && defence.length <= 3) combinations(defence, 2).forEach((c) => add(pkDefencePairs, c));
                }
            }
        }

        const toPlayers = (ids) => ids.map((id) => roster.get(id)).filter(Boolean);
        /**
         * Yhtenäisyys: kuinka suuren osan tasakenttäajastaan ryhmän pelaajat
         * pelasivat juuri tässä kokoonpanossa (keskiarvo). Lähellä 100 %:a =
         * vakiintunut ketju; alle puolet = ketjuja sekoitettiin ottelun aikana.
         */
        const cohesion = (ids, seconds) => {
            const own = ids.map((id) => evenSeconds.get(id) ?? 0).filter((v) => v > 0);
            if (own.length === 0) return null;
            return Math.round((seconds / (own.reduce((a, b) => a + b, 0) / own.length)) * 100) / 100;
        };

        /*
         * Ketjun numero peliajan mukaan: pelaajien koko ottelun peliajat
         * yhteen, eniten pelannut on ykkösketju. Ahne valinta poimii ketjut
         * yhteisen ajan perusteella, mikä ei kerro järjestystä (nelosketju voi
         * pysyä koossa paremmin kuin sekoitettu ykkösketju).
         */
        const byIceTime = (groups) => groups
            .map((g) => ({ ...g, total: g.ids.reduce((sum, id) => sum + (roster.get(id)?.toi ?? 0), 0) }))
            .sort((a, b) => b.total - a.total);

        result[team] = {
            isHome: team === homeId,
            forwards: byIceTime(pickGroups(forwardTrios, 4, 60)).map((g) => ({
                seconds: g.seconds,
                cohesion: cohesion(g.ids, g.seconds),
                players: assignForwardSlots(toPlayers(g.ids)),
            })),
            defence: byIceTime(pickGroups(defencePairs, 3, 60)).map((g) => ({
                seconds: g.seconds,
                cohesion: cohesion(g.ids, g.seconds),
                players: orderDefence(toPlayers(g.ids)),
            })),
            powerPlay: pickGroups(powerPlay, 2, 30).map((g) => ({ seconds: g.seconds, ...splitUnit(toPlayers(g.ids)) })),
            penaltyKill: penaltyKillUnits(pickGroups(pkForwardPairs, 2, 20), pickGroups(pkDefencePairs, 2, 20), toPlayers),
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
        const away = box.awayTeam?.abbrev;
        const home = box.homeTeam?.abbrev;
        const [shiftRes, pbp, awayRoster, homeRoster] = await Promise.all([
            fetch(`https://api.nhle.com/stats/rest/en/shiftcharts?cayenneExp=gameId=${gameId}`),
            web(`/gamecenter/${gameId}/play-by-play`).catch(() => null),
            getOrFetch(`roster:${away}`, TTL.roster, () => web(`/roster/${away}/current`)).catch(() => null),
            getOrFetch(`roster:${home}`, TTL.roster, () => web(`/roster/${home}/current`)).catch(() => null),
        ]);
        const shifts = (await shiftRes.json())?.data ?? [];

        // Aloitukset pelaajittain: keskushyökkääjän tunnistus.
        const faceoffs = new Map();
        for (const play of pbp?.plays ?? []) {
            if (play.typeDescKey !== 'faceoff') continue;
            for (const id of [play.details?.winningPlayerId, play.details?.losingPlayerId]) {
                if (id) faceoffs.set(id, (faceoffs.get(id) ?? 0) + 1);
            }
        }

        // Laukaisukäsi joukkueen kokoonpanosta (laitojen puolen ratkaisuun).
        const shoots = new Map();
        for (const r of [awayRoster, homeRoster]) {
            for (const group of ['forwards', 'defensemen', 'goalies']) {
                for (const p of r?.[group] ?? []) shoots.set(p.id, p.shootsCatches ?? null);
            }
        }

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
                        faceoffs: faceoffs.get(p.playerId) ?? 0,
                        shoots: shoots.get(p.playerId) ?? null,
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
