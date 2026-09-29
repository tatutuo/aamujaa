import { web } from '../lib/nhlApi.js';
import { getOrFetch, TTL } from '../lib/cache.js';

/**
 * Laukauskartta ottelun tapahtumista.
 *
 * NHL:n play-by-play sisältää jokaiselle laukaukselle sijainnin kaukalossa,
 * laukaustyypin, ampujan ja maalivahdin. Sovellus haki tätä dataa jo, mutta
 * käytti siitä vain tapahtumalistaa — koordinaatit jäivät hyödyntämättä.
 *
 * Kaukalon koordinaatisto: x välillä −100…100 (pituus), y välillä −42,5…42,5
 * (leveys). Maalit ovat kohdissa x = ±89.
 */

/** Maaliviiva keskipisteestä mitattuna. */
const GOAL_LINE_X = 89;

const SHOT_EVENTS = new Set(['shot-on-goal', 'goal', 'missed-shot', 'blocked-shot']);

/** Tapahtumatyyppi käyttöliittymän ymmärtämään muotoon. */
const RESULT = {
    'goal': 'goal',
    'shot-on-goal': 'save',
    'missed-shot': 'miss',
    'blocked-shot': 'blocked',
};

/**
 * Etäisyys ja kulma maaliin.
 *
 * Nämä kertovat laukauksen laadusta enemmän kuin pelkkä sijainti: 10 metrin
 * laukaus suoraan edestä on aivan eri asia kuin 10 metrin laukaus kulmasta.
 */
function shotGeometry(x, y) {
    const dx = GOAL_LINE_X - x;
    const distance = Math.sqrt(dx * dx + y * y);
    // 0° = suoraan maalin edestä, 90° = maaliviivan suunnasta.
    const angle = Math.abs((Math.atan2(y, dx) * 180) / Math.PI);
    return {
        distance: Math.round(distance),
        angle: Math.round(angle),
    };
}

/**
 * Laukaukset yhdestä ottelusta, koordinaatit normalisoituna.
 *
 * Joukkueet vaihtavat päätyä joka erä, joten raakadatassa saman joukkueen
 * laukaukset ovat vuoroin kaukalon eri päissä. Normalisoinnin jälkeen
 * kotijoukkue hyökkää aina oikealle ja vieras vasemmalle — vasta silloin
 * kartta on luettava.
 */
export async function getGameShots(gameId) {
    return getOrFetch(`shots:${gameId}`, TTL.boxscore, async () => {
        const pbp = await web(`/gamecenter/${gameId}/play-by-play`);

        const homeTeamId = pbp.homeTeam?.id;
        const players = new Map(
            (pbp.rosterSpots ?? []).map((p) => [
                p.playerId,
                {
                    name: `${p.firstName?.default ?? ''} ${p.lastName?.default ?? ''}`.trim(),
                    sweaterNumber: p.sweaterNumber,
                    position: p.positionCode,
                },
            ]),
        );

        const shots = [];

        for (const play of pbp.plays ?? []) {
            if (!SHOT_EVENTS.has(play.typeDescKey)) continue;

            // Voittolaukauskilpailu jätetään pois: kaikki yritykset lähtevät
            // keskiympyrästä, joten ne vääristäisivät kartan. Näin myös
            // laukausmäärät vastaavat virallista tilastoa.
            if (play.periodDescriptor?.periodType === 'SO') continue;

            const d = play.details ?? {};
            if (d.xCoord === undefined || d.yCoord === undefined) continue;

            const isHome = d.eventOwnerTeamId === homeTeamId;

            // Kotijoukkue hyökkää oikealle silloin kun se puolustaa vasenta päätyä.
            // Jos näin ei ole, koko erän koordinaatit peilataan.
            const homeAttacksRight = play.homeTeamDefendingSide === 'left';
            const flip = !homeAttacksRight;

            const x = flip ? -d.xCoord : d.xCoord;
            const y = flip ? -d.yCoord : d.yCoord;

            // Geometria lasketaan aina hyökättävään maaliin päin, joten
            // vierasjoukkueen laukaukset peilataan laskentaa varten.
            const geometry = shotGeometry(isHome ? x : -x, isHome ? y : -y);

            const shooterId = d.shootingPlayerId ?? d.scoringPlayerId;
            const shooter = players.get(shooterId);

            shots.push({
                eventId: play.eventId,
                period: play.periodDescriptor?.number,
                periodType: play.periodDescriptor?.periodType,
                time: play.timeInPeriod,
                result: RESULT[play.typeDescKey],
                isHome,
                x,
                y,
                ...geometry,
                shotType: d.shotType ?? null,
                shooterId: shooterId ?? null,
                shooterName: shooter?.name ?? null,
                goalieId: d.goalieInNetId ?? null,
                // Maalikooste on valmiina datassa — ei tarvita erillistä hakua.
                highlightUrl: d.highlightClipSharingUrl ?? null,
                assists: play.typeDescKey === 'goal'
                    ? [d.assist1PlayerId, d.assist2PlayerId]
                        .filter(Boolean)
                        .map((id) => players.get(id)?.name ?? null)
                        .filter(Boolean)
                    : undefined,
            });
        }

        const laske = (ehto) => shots.filter(ehto).length;

        return {
            gameId: Number(gameId),
            homeTeam: pbp.homeTeam?.abbrev,
            awayTeam: pbp.awayTeam?.abbrev,
            shots,
            summary: {
                home: {
                    goals: laske((s) => s.isHome && s.result === 'goal'),
                    onGoal: laske((s) => s.isHome && (s.result === 'goal' || s.result === 'save')),
                    missed: laske((s) => s.isHome && s.result === 'miss'),
                    blocked: laske((s) => s.isHome && s.result === 'blocked'),
                },
                away: {
                    goals: laske((s) => !s.isHome && s.result === 'goal'),
                    onGoal: laske((s) => !s.isHome && (s.result === 'goal' || s.result === 'save')),
                    missed: laske((s) => !s.isHome && s.result === 'miss'),
                    blocked: laske((s) => !s.isHome && s.result === 'blocked'),
                },
            },
        };
    });
}

/**
 * Aloitustilastot pelaajittain play-by-playsta.
 *
 * Boxscore antaa vain prosentin, ja laitahyökkääjillä se on aina 0 — he eivät
 * ota aloituksia. Jos prosentti näytetään kaikille, se näyttää siltä kuin
 * data olisi rikki.
 *
 * Play-by-play sisältää jokaisen aloituksen voittajan, häviäjän ja
 * vyöhykkeen, joten tarkat lukemat voi laskea itse — ja mukaan tulee myös
 * vyöhykejakauma, jota rajapinta ei ottelutasolla anna lainkaan.
 */
export async function getGameFaceoffs(gameId) {
    return getOrFetch(`faceoffs:${gameId}`, TTL.boxscore, async () => {
        const pbp = await web(`/gamecenter/${gameId}/play-by-play`);
        const homeTeamId = pbp.homeTeam?.id;

        const players = new Map(
            (pbp.rosterSpots ?? []).map((p) => [
                p.playerId,
                {
                    name: `${p.firstName?.default ?? ''} ${p.lastName?.default ?? ''}`.trim(),
                    position: p.positionCode,
                    teamId: p.teamId,
                },
            ]),
        );

        const byPlayer = new Map();

        const record = (playerId, won, zone, isHomeZoneOwner) => {
            if (!playerId) return;
            const entry = byPlayer.get(playerId) ?? {
                won: 0, total: 0,
                offensive: { won: 0, total: 0 },
                defensive: { won: 0, total: 0 },
                neutral: { won: 0, total: 0 },
            };

            entry.total += 1;
            entry.won += won;

            // Vyöhyke on merkitty kotijoukkueen näkökulmasta, joten vieraalle
            // hyökkäys- ja puolustusvyöhyke menevät päinvastoin.
            let bucket = 'neutral';
            if (zone === 'O') bucket = isHomeZoneOwner ? 'offensive' : 'defensive';
            else if (zone === 'D') bucket = isHomeZoneOwner ? 'defensive' : 'offensive';

            entry[bucket].total += 1;
            entry[bucket].won += won;

            byPlayer.set(playerId, entry);
        };

        for (const play of pbp.plays ?? []) {
            if (play.typeDescKey !== 'faceoff') continue;
            const d = play.details ?? {};

            for (const [id, won] of [[d.winningPlayerId, 1], [d.losingPlayerId, 0]]) {
                const player = players.get(id);
                if (!player) continue;
                record(id, won, d.zoneCode, player.teamId === homeTeamId);
            }
        }

        const toEntry = ([id, stats]) => {
            const player = players.get(id);
            return {
                playerId: id,
                name: player?.name ?? null,
                position: player?.position ?? null,
                isHome: player?.teamId === homeTeamId,
                won: stats.won,
                total: stats.total,
                pct: stats.total > 0 ? stats.won / stats.total : null,
                offensive: stats.offensive,
                defensive: stats.defensive,
                neutral: stats.neutral,
            };
        };

        const entries = [...byPlayer]
            .map(toEntry)
            // Vain oikeasti aloituksia ottaneet — muuten lista täyttyy nollista.
            .filter((e) => e.total > 0)
            .sort((a, b) => b.total - a.total);

        const teamTotals = (isHome) => {
            const list = entries.filter((e) => e.isHome === isHome);
            const won = list.reduce((sum, e) => sum + e.won, 0);
            const total = list.reduce((sum, e) => sum + e.total, 0);
            return { won, total, pct: total > 0 ? won / total : null };
        };

        return {
            gameId: Number(gameId),
            homeTeam: pbp.homeTeam?.abbrev,
            awayTeam: pbp.awayTeam?.abbrev,
            players: entries,
            totals: { home: teamTotals(true), away: teamTotals(false) },
        };
    });
}

/**
 * Ottelun taustatiedot: tuomarit, päävalmentajat, ylimääräiset pelaajat,
 * laukaukset erittäin ja keskinäiset kohtaamiset.
 *
 * Kaikki tulee yhdestä `right-rail`-vastauksesta, jota sovellus ei aiemmin
 * käyttänyt lainkaan.
 *
 * Ylimääräiset (scratches) ovat myös paras saatavilla oleva vihje
 * loukkaantumisista: NHL:llä ei ole julkista loukkaantumisrajapintaa, joten
 * useassa peräkkäisessä ottelussa sivussa ollut pelaaja on todennäköisesti
 * joko loukkaantunut tai pudonnut kokoonpanosta. Tätä ei pidä esittää
 * varmana tietona.
 */
export async function getGameExtras(gameId) {
    return getOrFetch(`extras:${gameId}`, TTL.boxscore, async () => {
        const rail = await web(`/gamecenter/${gameId}/right-rail`);

        const side = (team) => ({
            headCoach: team?.headCoach?.default ?? null,
            scratches: (team?.scratches ?? []).map((p) => ({
                id: p.id,
                name: `${p.firstName?.default ?? ''} ${p.lastName?.default ?? ''}`.trim(),
            })),
        });

        return {
            gameId: Number(gameId),
            referees: (rail.gameInfo?.referees ?? []).map((r) => r.default),
            linesmen: (rail.gameInfo?.linesmen ?? []).map((r) => r.default),
            home: side(rail.gameInfo?.homeTeam),
            away: side(rail.gameInfo?.awayTeam),
            shotsByPeriod: (rail.shotsByPeriod ?? []).map((p) => ({
                period: p.periodDescriptor?.number,
                periodType: p.periodDescriptor?.periodType,
                home: p.home,
                away: p.away,
            })),
            scoreByPeriod: (rail.linescore?.byPeriod ?? []).map((p) => ({
                period: p.periodDescriptor?.number,
                periodType: p.periodDescriptor?.periodType,
                home: p.home,
                away: p.away,
            })),
            teamStats: (rail.teamGameStats ?? []).map((s) => ({
                category: s.category,
                home: s.homeValue,
                away: s.awayValue,
            })),
            seasonSeries: (rail.seasonSeries ?? []).map((g) => ({
                id: g.id,
                date: g.gameDate,
                state: g.gameState,
                home: g.homeTeam?.abbrev,
                away: g.awayTeam?.abbrev,
                homeScore: g.homeTeam?.score ?? null,
                awayScore: g.awayTeam?.score ?? null,
            })),
            seriesWins: rail.seasonSeriesWins ?? null,
        };
    });
}
