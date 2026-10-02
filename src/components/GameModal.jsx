import React, { useMemo, useState } from 'react';
import { IconPlayerPlayFilled, IconStarFilled, IconMapPin, IconDeviceTv, IconFlag, IconUser, IconCalendar } from '@tabler/icons-react';
import Sheet from './Sheet';
import ShotMap from './ShotMap';
import LinesView from './LinesView';
import TeamBadge from './TeamBadge';
import DataTable from './ui/DataTable';
import Segmented from './ui/Segmented';
import Chips from './ui/Chips';
import { api } from '../utils/api';
import { penaltyName } from '../utils/penalties';
import { useFetchWhenOpen } from '../hooks/useModal';
import { teamColors, DEFAULT_TEAM_COLORS } from '../utils/teamColors';
import { teamNickname } from '../utils/teams';
import { positionLabel } from '../utils/positions';
import { int, pct, signed, clock, shortDate } from '../utils/format';

/**
 * Ottelunäkymä.
 *
 * Tulos ja tila luetaan ottelun omasta datasta eikä avaajan antamasta
 * oliosta. Aamujäässä tulos näkyi vain etusivulta avattaessa: pelaaja- tai
 * joukkuekortista avattu ottelu näytti "– – –", koska niiltä tuli pelkkä
 * tunniste.
 *
 * Pelaajakohtainen tilasto (boxscore) on nyt lajiteltava taulukko eikä
 * nimilappurivistö, ja joukkuetilastot näkyvät vastakkain pylväinä.
 */

const colourOf = (abbrev) => (teamColors[abbrev] ?? DEFAULT_TEAM_COLORS)[0];

const isFinal = (state) => state === 'FINAL' || state === 'OFF';
const isLive = (state) => state === 'LIVE' || state === 'CRIT';
const isPregame = (state) => !state || state === 'FUT' || state === 'PRE';

/** "24:07" -> 1447 sekuntia. */
const toSeconds = (toi) => {
    const [m, s] = String(toi ?? '').split(':').map(Number);
    return Number.isFinite(m) && Number.isFinite(s) ? m * 60 + s : null;
};

const periodName = (descriptor, fi) => {
    if (descriptor?.periodType === 'SO') return fi ? 'Voittolaukaukset' : 'Shootout';
    if (descriptor?.periodType === 'OT') {
        return descriptor.number > 4
            ? (fi ? `${descriptor.number - 3}. jatkoaika` : `OT${descriptor.number - 3}`)
            : (fi ? 'Jatkoaika' : 'Overtime');
    }
    return `${descriptor?.number}. ${fi ? 'erä' : 'period'}`;
};

const periodShort = (descriptor) => {
    if (descriptor?.periodType === 'SO') return 'VL';
    if (descriptor?.periodType === 'OT') return descriptor.number > 4 ? `${descriptor.number - 3}.JA` : 'JA';
    return `${descriptor?.number}.`;
};

/** Maalin erikoistilanne lyhyenä tunnuksena. */
function goalTag(goal, fi) {
    if (goal.goalModifier === 'empty-net') return fi ? 'TM' : 'EN';
    if (goal.goalModifier === 'penalty-shot') return fi ? 'RL' : 'PS';
    if (goal.strength === 'pp') return fi ? 'YV' : 'PP';
    if (goal.strength === 'sh') return fi ? 'AV' : 'SH';
    return null;
}

/** Näissä pienempi luku on parempi, joten korostus kääntyy. */
const LOWER_IS_BETTER = new Set(['pim', 'giveaways']);

const STAT_LABELS = {
    sog: { fi: 'Laukaukset', en: 'Shots on goal' },
    faceoffWinningPctg: { fi: 'Aloitukset', en: 'Faceoffs' },
    powerPlay: { fi: 'Ylivoima', en: 'Power play' },
    pim: { fi: 'Jäähyminuutit', en: 'Penalty minutes' },
    hits: { fi: 'Taklaukset', en: 'Hits' },
    blockedShots: { fi: 'Blokit', en: 'Blocked shots' },
    giveaways: { fi: 'Menetykset', en: 'Giveaways' },
    takeaways: { fi: 'Riistot', en: 'Takeaways' },
};

export default function GameModal({ isOpen, onClose, gameData, onTeamClick, onPlayerClick, language, zIndex = 99000 }) {
    const lang = language === 'en' ? 'en' : 'fi';
    const gameId = gameData?.id;

    const { data, isLoading, error } = useFetchWhenOpen(
        isOpen && Boolean(gameId),
        (signal) => Promise.all([
            api.game(gameId, { signal }),
            api.boxscore(gameId, { signal }).catch(() => null),
        ]).then(([details, box]) => ({ details, box })),
        [gameId],
    );

    if (!isOpen || !gameData) return null;

    const details = data?.details ?? null;
    const awayAbbrev = details?.awayTeam?.abbrev ?? gameData.awayTeam?.abbrev ?? gameData.awayTeam;
    const homeAbbrev = details?.homeTeam?.abbrev ?? gameData.homeTeam?.abbrev ?? gameData.homeTeam;
    const venue = details?.venue?.default ?? gameData.venue?.default;

    return (
        <Sheet
            isOpen={isOpen}
            onClose={onClose}
            zIndex={zIndex}
            size="full"
            accent={colourOf(homeAbbrev)}
            title={`${teamNickname(awayAbbrev)} – ${teamNickname(homeAbbrev)}`}
            subtitle={venue}
        >
            <GameContent
                key={gameId}
                gameData={gameData}
                details={details}
                box={data?.box ?? null}
                isLoading={isLoading}
                error={error}
                awayAbbrev={awayAbbrev}
                homeAbbrev={homeAbbrev}
                lang={lang}
                onTeamClick={onTeamClick}
                onPlayerClick={onPlayerClick}
            />
        </Sheet>
    );
}

function GameContent({ gameData, details, box, isLoading, error, awayAbbrev, homeAbbrev, lang, onTeamClick, onPlayerClick }) {
    const fi = lang === 'fi';
    const game = details ?? gameData;
    const state = game?.gameState ?? gameData?.gameState;
    const pregame = isPregame(state);

    const [tab, setTab] = useState(null);
    const activeTab = tab ?? (pregame ? 'info' : 'events');

    const gameId = gameData.id;
    const wantsExtras = activeTab === 'stats' || activeTab === 'info';

    const { data: extras, isLoading: extrasLoading } = useFetchWhenOpen(
        wantsExtras,
        (signal) => api.gameExtras(gameId, { signal }),
        [gameId],
    );
    const { data: shotData, isLoading: shotsLoading } = useFetchWhenOpen(
        activeTab === 'shots',
        (signal) => api.gameShots(gameId, { signal }),
        [gameId],
    );
    const { data: faceoffs, isLoading: faceoffsLoading } = useFetchWhenOpen(
        activeTab === 'faceoffs',
        (signal) => api.gameFaceoffs(gameId, { signal }),
        [gameId],
    );

    /** Erittäin järjestetyt tapahtumat. */
    const periods = useMemo(() => {
        const summary = details?.summary;
        if (!summary) return [];
        const byPeriod = new Map();
        const ensure = (descriptor) => {
            if (!byPeriod.has(descriptor.number)) byPeriod.set(descriptor.number, { descriptor, events: [] });
            return byPeriod.get(descriptor.number);
        };
        for (const period of summary.scoring ?? []) {
            for (const goal of period.goals ?? []) ensure(period.periodDescriptor).events.push({ type: 'goal', time: goal.timeInPeriod, data: goal });
        }
        for (const period of summary.penalties ?? []) {
            for (const penalty of period.penalties ?? []) ensure(period.periodDescriptor).events.push({ type: 'penalty', time: penalty.timeInPeriod, data: penalty });
        }
        const sorted = [...byPeriod.values()].sort((a, b) => a.descriptor.number - b.descriptor.number);
        for (const period of sorted) period.events.sort((a, b) => a.time.localeCompare(b.time));
        return sorted;
    }, [details]);

    /** Maalit erittäin tulostaululle: [{ label, away, home }]. */
    const periodScores = useMemo(() => {
        const summary = details?.summary;
        if (!summary?.scoring) return [];
        const scoredByHome = (g) => g.isHome ?? g.teamAbbrev?.default === homeAbbrev;
        return summary.scoring
            .filter((p) => p.periodDescriptor?.periodType !== 'SO')
            .map((p) => ({
                label: periodShort(p.periodDescriptor),
                away: (p.goals ?? []).filter((g) => !scoredByHome(g)).length,
                home: (p.goals ?? []).filter(scoredByHome).length,
            }));
    }, [details, homeAbbrev]);

    const tabs = pregame
        ? [
            { value: 'info', label: fi ? 'Tiedot' : 'Info' },
            { value: 'lines', label: fi ? 'Kentälliset' : 'Lines' },
        ]
        : [
            { value: 'events', label: fi ? 'Tapahtumat' : 'Events' },
            { value: 'players', label: fi ? 'Pelaajat' : 'Players' },
            { value: 'lines', label: fi ? 'Kentälliset' : 'Lines' },
            { value: 'stats', label: fi ? 'Tilastot' : 'Stats' },
            { value: 'shots', label: fi ? 'Laukaukset' : 'Shots' },
            { value: 'faceoffs', label: fi ? 'Aloitukset' : 'Faceoffs' },
            { value: 'info', label: fi ? 'Tiedot' : 'Info' },
        ];

    return (
        <div className="gm2">
            <Scoreboard
                game={game}
                gameData={gameData}
                box={box}
                state={state}
                awayAbbrev={awayAbbrev}
                homeAbbrev={homeAbbrev}
                periodScores={periodScores}
                lang={lang}
                onTeamClick={onTeamClick}
            />

            {tabs.length > 1 && (
                <div className="gm2-tabs">
                    <Segmented size="sm" label={fi ? 'Näkymä' : 'View'} value={activeTab} onChange={setTab} options={tabs} />
                </div>
            )}

            <div className="gm2-body">
                {isLoading ? (
                    <div className="skeleton" style={{ height: 320 }} />
                ) : error ? (
                    <p className="panel-hint">{fi ? 'Ottelun tietojen haku epäonnistui.' : 'Could not load the game.'}</p>
                ) : (
                    <>
                        {activeTab === 'events' && (
                            <GameEvents
                                periods={periods}
                                stars={details?.summary?.threeStars ?? []}
                                box={box}
                                awayAbbrev={awayAbbrev}
                                homeAbbrev={homeAbbrev}
                                lang={lang}
                                onPlayerClick={onPlayerClick}
                            />
                        )}
                        {activeTab === 'players' && (
                            <GamePlayers box={box} awayAbbrev={awayAbbrev} homeAbbrev={homeAbbrev} lang={lang} onPlayerClick={onPlayerClick} />
                        )}
                        {activeTab === 'lines' && (
                            <GameLines gameId={gameId} pregame={pregame} awayAbbrev={awayAbbrev} homeAbbrev={homeAbbrev} lang={lang} onPlayerClick={onPlayerClick} />
                        )}
                        {activeTab === 'stats' && (
                            extrasLoading
                                ? <div className="skeleton" style={{ height: 320 }} />
                                : <GameTeamStats extras={extras} awayAbbrev={awayAbbrev} homeAbbrev={homeAbbrev} lang={lang} />
                        )}
                        {activeTab === 'shots' && (
                            shotsLoading
                                ? <div className="skeleton" style={{ height: 260 }} />
                                : <ShotMap data={shotData} language={lang} onPlayerClick={onPlayerClick} />
                        )}
                        {activeTab === 'faceoffs' && (
                            faceoffsLoading
                                ? <div className="skeleton" style={{ height: 320 }} />
                                : <GameFaceoffs faceoffs={faceoffs} awayAbbrev={awayAbbrev} homeAbbrev={homeAbbrev} lang={lang} onPlayerClick={onPlayerClick} />
                        )}
                        {activeTab === 'info' && (
                            <GameInfo
                                game={game}
                                extras={extras}
                                extrasLoading={extrasLoading}
                                pregame={pregame}
                                awayAbbrev={awayAbbrev}
                                homeAbbrev={homeAbbrev}
                                lang={lang}
                                onPlayerClick={onPlayerClick}
                            />
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Tulostaulu
// ---------------------------------------------------------------------------

function Scoreboard({ game, gameData, box, state, awayAbbrev, homeAbbrev, periodScores, lang, onTeamClick }) {
    const fi = lang === 'fi';
    const away = game?.awayTeam ?? {};
    const home = game?.homeTeam ?? {};
    const awayScore = away.score ?? gameData.awayTeam?.score;
    const homeScore = home.score ?? gameData.homeTeam?.score;
    const start = game?.startTimeUTC ? new Date(game.startTimeUTC) : null;
    const outcome = game?.gameOutcome ?? box?.gameOutcome ?? gameData.gameOutcome;

    let status;
    if (isFinal(state)) {
        const extra = outcome?.lastPeriodType;
        status = (fi ? 'Lopputulos' : 'Final') + (extra === 'OT' ? (fi ? ' · JA' : ' · OT') : extra === 'SO' ? (fi ? ' · VL' : ' · SO') : '');
    } else if (isLive(state)) {
        const clockText = game?.clock?.inIntermission
            ? (fi ? 'erätauko' : 'intermission')
            : game?.clock?.timeRemaining;
        status = `LIVE · ${periodName(game?.periodDescriptor, fi)}${clockText ? ` · ${clockText}` : ''}`;
    } else if (start) {
        // Viikonpäivä erikseen: yhdessä päivämäärän kanssa suomi taivuttaa sen ("keskiviikkona").
        const weekday = start.toLocaleDateString(fi ? 'fi-FI' : 'en-US', { weekday: 'long' });
        status = fi
            ? `${weekday} ${start.getDate()}.${start.getMonth() + 1}.`
            : `${weekday}, ${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    }

    const typeLabel = game?.gameType === 1 ? (fi ? 'Harjoitusottelu' : 'Preseason')
        : game?.gameType === 3 ? (fi ? 'Pudotuspelit' : 'Playoffs') : null;

    const winner = isFinal(state) && awayScore !== homeScore ? (awayScore > homeScore ? 'away' : 'home') : null;

    const side = (team, abbrev, key) => (
        <button type="button" className={`gm2-team ${winner && winner !== key ? 'is-loser' : ''}`} onClick={() => onTeamClick(abbrev)}>
            <TeamBadge abbrev={abbrev} size={46} />
            <span className="gm2-team-name">{teamNickname(abbrev)}</span>
            {team.record && <span className="gm2-team-record num">{team.record}</span>}
            {!team.record && team.sog != null && <span className="gm2-team-record num">{team.sog} {fi ? 'laukausta' : 'shots'}</span>}
        </button>
    );

    return (
        <div className={`gm2-board ${isLive(state) ? 'is-live' : ''}`} style={{ '--away': colourOf(awayAbbrev), '--home': colourOf(homeAbbrev) }}>
            {typeLabel && <span className="gm2-type">{typeLabel}</span>}
            <div className="gm2-board-row">
                {side(away, awayAbbrev, 'away')}
                <div className="gm2-center">
                    {isPregame(state) ? (
                        <span className="gm2-time num">
                            {start ? start.toLocaleTimeString(fi ? 'fi-FI' : 'en-GB', { hour: '2-digit', minute: '2-digit' }) : '–'}
                        </span>
                    ) : (
                        <span className="gm2-score num">
                            <span className={winner === 'away' ? 'is-winner' : ''}>{awayScore ?? '–'}</span>
                            <span className="gm2-dash">–</span>
                            <span className={winner === 'home' ? 'is-winner' : ''}>{homeScore ?? '–'}</span>
                        </span>
                    )}
                    {status && <span className={`gm2-status ${isLive(state) ? 'is-live' : ''}`}>{status}</span>}
                </div>
                {side(home, homeAbbrev, 'home')}
            </div>
            {periodScores.length > 0 && (
                <div className="gm2-periods num" aria-label={fi ? 'Maalit erittäin' : 'Goals by period'}>
                    {periodScores.map((p) => (
                        <span key={p.label}><em>{p.label}</em> {p.away}–{p.home}</span>
                    ))}
                </div>
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Tapahtumat
// ---------------------------------------------------------------------------

function GameEvents({ periods, stars, box, awayAbbrev, homeAbbrev, lang, onPlayerClick }) {
    const fi = lang === 'fi';

    /**
     * Pelinumero + joukkue -> pelaajan tunniste. Jäähydatassa ei ole
     * pelaaja-ID:tä, mutta pelinumero on joukkueen sisällä yksikäsitteinen.
     */
    const idByNumber = useMemo(() => {
        const map = new Map();
        for (const [side, abbrev] of [['awayTeam', awayAbbrev], ['homeTeam', homeAbbrev]]) {
            const stats = box?.playerByGameStats?.[side];
            for (const group of ['forwards', 'defense', 'goalies']) {
                for (const p of stats?.[group] ?? []) map.set(`${abbrev}-${p.sweaterNumber}`, p.playerId);
            }
        }
        return map;
    }, [box, awayAbbrev, homeAbbrev]);

    if (periods.length === 0 && stars.length === 0) {
        return <p className="panel-hint">{fi ? 'Ei maaleja eikä jäähyjä.' : 'No goals or penalties.'}</p>;
    }

    const personName = (raw) => raw?.default ?? `${raw?.firstName?.default ?? ''} ${raw?.lastName?.default ?? ''}`.trim();

    return (
        <>
            {stars.length > 0 && (
                <section className="gm2-section">
                    <h3 className="card-section-title">{fi ? 'Ottelun tähdet' : 'Three stars'}</h3>
                    <div className="gm2-stars">
                        {stars.map((s) => (
                            <button key={s.star} type="button" className="gm2-star" onClick={() => onPlayerClick(s.playerId)}>
                                <span className="gm2-star-rank">
                                    {Array.from({ length: 4 - s.star }, (_, i) => <IconStarFilled key={i} size={10} aria-hidden="true" />)}
                                </span>
                                <span className="gm2-star-name">{s.name?.default}</span>
                                <span className="gm2-star-meta">
                                    <span className="dt-dot" style={{ background: colourOf(s.teamAbbrev) }} aria-hidden="true" />
                                    {s.teamAbbrev} · {s.position === 'G'
                                        ? `${pct(s.savePctg, 1, lang)} %`
                                        : `${s.goals ?? 0}+${s.assists ?? 0}`}
                                </span>
                            </button>
                        ))}
                    </div>
                </section>
            )}

            {periods.map((period) => (
                <section key={period.descriptor.number} className="gm2-section">
                    <h3 className="card-section-title">{periodName(period.descriptor, fi)}</h3>
                    <ul className="gm2-events">
                        {period.events.map((event, i) => {
                            if (event.type === 'goal') {
                                const g = event.data;
                                const team = g.teamAbbrev?.default;
                                const tag = goalTag(g, fi);
                                const assists = (g.assists ?? []).filter((a) => a.name?.default);
                                return (
                                    <li key={`g${i}`} className="gm2-event is-goal" style={{ '--team': colourOf(team) }}>
                                        <span className="gm2-event-time num">{event.time}</span>
                                        <span className="gm2-event-main">
                                            <button type="button" className="gm2-event-player" onClick={() => g.playerId && onPlayerClick(g.playerId)}>
                                                {g.name?.default}
                                                {g.goalsToDate != null && <span className="gm2-todate"> ({g.goalsToDate})</span>}
                                            </button>
                                            <span className="gm2-event-sub">
                                                {team}{tag && <span className="dt-tag">{tag}</span>}
                                                {assists.length > 0 ? (
                                                    <>
                                                        {' · '}
                                                        {assists.map((a, k) => (
                                                            <React.Fragment key={a.playerId ?? k}>
                                                                {k > 0 && ', '}
                                                                <button
                                                                    type="button"
                                                                    className="gm2-assist"
                                                                    onClick={() => a.playerId && onPlayerClick(a.playerId)}
                                                                    disabled={!a.playerId}
                                                                >
                                                                    {a.name.default}
                                                                    {a.assistsToDate != null && <span className="gm2-todate"> ({a.assistsToDate})</span>}
                                                                </button>
                                                            </React.Fragment>
                                                        ))}
                                                    </>
                                                ) : (fi ? ' · ilman syöttäjää' : ' · unassisted')}
                                            </span>
                                        </span>
                                        <span className="gm2-event-score num">{g.awayScore}–{g.homeScore}</span>
                                        {g.highlightClipSharingUrl ? (
                                            <a className="gm2-video" href={g.highlightClipSharingUrl} target="_blank" rel="noreferrer" aria-label={fi ? 'Katso maali' : 'Watch goal'}>
                                                <IconPlayerPlayFilled size={12} aria-hidden="true" />
                                            </a>
                                        ) : <span className="gm2-video is-empty" aria-hidden="true" />}
                                    </li>
                                );
                            }

                            const p = event.data;
                            const team = p.teamAbbrev?.default ?? p.teamAbbrev;
                            const raw = p.committedByPlayer ?? p.servedByPlayer;
                            const name = typeof raw === 'string' ? raw : (raw ? personName(raw) : (fi ? 'Joukkue' : 'Team'));
                            const id = raw?.playerId ?? (raw?.sweaterNumber != null ? idByNumber.get(`${team}-${raw.sweaterNumber}`) : null);
                            const drawn = p.drawnBy ? personName(p.drawnBy) : null;
                            return (
                                <li key={`p${i}`} className="gm2-event is-penalty" style={{ '--team': colourOf(team) }}>
                                    <span className="gm2-event-time num">{event.time}</span>
                                    <span className="gm2-event-main">
                                        <button type="button" className="gm2-event-player" onClick={() => id && onPlayerClick(id)} disabled={!id}>
                                            {name}
                                        </button>
                                        <span className="gm2-event-sub">
                                            {team} · {penaltyName(p.descKey, fi)}{drawn && ` · ${fi ? 'kohde' : 'drawn by'} ${drawn}`}
                                        </span>
                                    </span>
                                    <span className="gm2-penalty num">{p.duration ?? 2} min</span>
                                    <span className="gm2-video is-empty" aria-hidden="true" />
                                </li>
                            );
                        })}
                    </ul>
                </section>
            ))}
        </>
    );
}

// ---------------------------------------------------------------------------
// Pelaajat (boxscore)
// ---------------------------------------------------------------------------

function skaterColumns(group, fi, lang) {
    if (group === 'more') {
        return [
            { key: 'sog', label: fi ? 'L' : 'S', title: fi ? 'Laukaukset maalia kohti' : 'Shots on goal', format: int },
            { key: 'hits', label: fi ? 'TA' : 'HIT', title: fi ? 'Taklaukset' : 'Hits', format: int },
            { key: 'blockedShots', label: fi ? 'BL' : 'BLK', title: fi ? 'Blokatut laukaukset' : 'Blocked shots', format: int },
            { key: 'faceoffPct', label: fi ? 'Al%' : 'FO%', title: fi ? 'Aloitusvoitot' : 'Faceoff win %', format: (v) => pct(v, 0, lang) },
            { key: 'pim', label: fi ? 'JM' : 'PIM', title: fi ? 'Jäähyminuutit' : 'Penalty minutes', format: int },
        ];
    }
    return [
        { key: 'goals', label: fi ? 'M' : 'G', title: fi ? 'Maalit' : 'Goals', format: int },
        { key: 'assists', label: fi ? 'S' : 'A', title: fi ? 'Syötöt' : 'Assists', format: int },
        { key: 'points', label: 'P', title: fi ? 'Pisteet' : 'Points', format: int },
        { key: 'plusMinus', label: '+/−', title: fi ? 'Plusmiinus' : 'Plus-minus', format: signed },
        { key: 'toi', label: fi ? 'Aika' : 'TOI', title: fi ? 'Peliaika' : 'Time on ice', format: clock, width: '52px' },
    ];
}

function GamePlayers({ box, awayAbbrev, homeAbbrev, lang, onPlayerClick }) {
    const fi = lang === 'fi';
    const [side, setSide] = useState('awayTeam');
    const [who, setWho] = useState('skaters');
    const [group, setGroup] = useState('basic');

    const stats = box?.playerByGameStats?.[side];
    const abbrev = side === 'homeTeam' ? homeAbbrev : awayAbbrev;

    const rows = useMemo(() => {
        if (!stats) return [];
        if (who === 'goalies') {
            return (stats.goalies ?? [])
                .filter((g) => toSeconds(g.toi) > 0)
                .map((g) => ({
                    id: g.playerId, name: g.name?.default, number: g.sweaterNumber, pos: 'G', decision: g.decision,
                    saves: g.saves, shotsAgainst: g.shotsAgainst, savePct: g.savePctg ?? (g.shotsAgainst ? g.saves / g.shotsAgainst : null),
                    goalsAgainst: g.goalsAgainst, toi: toSeconds(g.toi),
                }));
        }
        return [...(stats.forwards ?? []), ...(stats.defense ?? [])].map((p) => ({
            id: p.playerId, name: p.name?.default, number: p.sweaterNumber, pos: p.position,
            goals: p.goals, assists: p.assists, points: p.points ?? (p.goals + p.assists), plusMinus: p.plusMinus,
            toi: toSeconds(p.toi), sog: p.sog, hits: p.hits, blockedShots: p.blockedShots, pim: p.pim,
            faceoffPct: p.faceoffWinningPctg > 0 ? p.faceoffWinningPctg : null,
        }));
    }, [stats, who]);

    if (!box?.playerByGameStats) return <p className="panel-hint">{fi ? 'Pelaajatilastoja ei ole vielä.' : 'No player stats yet.'}</p>;

    const columns = who === 'goalies'
        ? [
            { key: 'saves', label: fi ? 'TO' : 'SV', title: fi ? 'Torjunnat' : 'Saves', format: int },
            { key: 'shotsAgainst', label: fi ? 'LV' : 'SA', title: fi ? 'Laukaukset vastaan' : 'Shots against', format: int },
            { key: 'savePct', label: fi ? 'T%' : 'SV%', title: fi ? 'Torjuntaprosentti' : 'Save percentage', format: (v) => pct(v, 1, lang) },
            { key: 'goalsAgainst', label: fi ? 'PM' : 'GA', title: fi ? 'Päästetyt maalit' : 'Goals against', format: int, lowerIsBetter: true },
            { key: 'toi', label: fi ? 'Aika' : 'TOI', title: fi ? 'Peliaika' : 'Time on ice', format: clock, width: '52px' },
        ]
        : skaterColumns(group, fi, lang);

    return (
        <>
            <div className="gm2-filters">
                <Chips
                    label={fi ? 'Joukkue' : 'Team'}
                    value={side}
                    onChange={setSide}
                    options={[
                        { value: 'awayTeam', label: awayAbbrev },
                        { value: 'homeTeam', label: homeAbbrev },
                    ]}
                />
                <Chips
                    label={fi ? 'Pelaajat' : 'Players'}
                    value={who === 'goalies' ? 'goalies' : group}
                    onChange={(v) => {
                        if (v === 'goalies') setWho('goalies');
                        else { setWho('skaters'); setGroup(v); }
                    }}
                    options={[
                        { value: 'basic', label: fi ? 'Perus' : 'Basic' },
                        { value: 'more', label: fi ? 'Muut' : 'More' },
                        { value: 'goalies', label: fi ? 'Maalivahdit' : 'Goalies' },
                    ]}
                />
            </div>
            <DataTable
                key={`${side}:${who}:${group}`}
                rows={rows}
                columns={columns}
                identity={{
                    label: fi ? 'Pelaaja' : 'Player',
                    render: (row) => (
                        <span className="dt-person">
                            <span className="dt-dot" style={{ background: colourOf(abbrev) }} aria-hidden="true" />
                            <span className="dt-person-text">
                                <span className="dt-name">
                                    {row.name}
                                    {row.decision && <span className="dt-tag">{row.decision === 'W' ? (fi ? 'V' : 'W') : (fi ? 'H' : 'L')}</span>}
                                </span>
                                <span className="dt-meta">#{row.number ?? '–'} · {positionLabel(row.pos, lang)}</span>
                            </span>
                        </span>
                    ),
                }}
                defaultSort={{ key: who === 'goalies' ? 'toi' : columns[0].key === 'goals' ? 'points' : 'sog', dir: 'desc' }}
                onRowClick={(row) => onPlayerClick(row.id)}
                pageSize={40}
                language={lang}
                caption={fi ? 'Pelaajatilastot' : 'Player stats'}
            />
        </>
    );
}

// ---------------------------------------------------------------------------
// Joukkuetilastot vastakkain
// ---------------------------------------------------------------------------

/** Luku pylvästä varten: "1/3" -> 1, 0.52 -> 52. */
const barValue = (category, v) => {
    if (typeof v === 'string') return Number.parseInt(v, 10) || 0;
    if (category.endsWith('Pctg')) return (v ?? 0) * 100;
    return v ?? 0;
};

const statText = (category, v, lang) => {
    if (v === null || v === undefined) return '–';
    if (category.endsWith('Pctg')) return `${pct(v, 0, lang)} %`;
    return String(v);
};

function GameTeamStats({ extras, awayAbbrev, homeAbbrev, lang }) {
    const fi = lang === 'fi';
    const stats = (extras?.teamStats ?? []).filter((s) => STAT_LABELS[s.category]);
    if (stats.length === 0) return <p className="panel-hint">{fi ? 'Tilastoja ei ole vielä.' : 'No stats yet.'}</p>;

    return (
        <>
            <div className="gm2-compare" style={{ '--away': colourOf(awayAbbrev), '--home': colourOf(homeAbbrev) }}>
                <div className="gm2-compare-head">
                    <span>{awayAbbrev}</span>
                    <span>{homeAbbrev}</span>
                </div>
                {stats.map((s) => {
                    const a = barValue(s.category, s.away);
                    const h = barValue(s.category, s.home);
                    const share = a + h > 0 ? a / (a + h) : 0.5;
                    const awayLeads = LOWER_IS_BETTER.has(s.category) ? a < h : a > h;
                    const homeLeads = LOWER_IS_BETTER.has(s.category) ? h < a : h > a;
                    return (
                        <div key={s.category} className="gm2-compare-row">
                            <div className="gm2-compare-values">
                                <span className={`num ${awayLeads ? 'is-lead' : ''}`}>{statText(s.category, s.away, lang)}</span>
                                <span className="gm2-compare-label">{STAT_LABELS[s.category][lang]}</span>
                                <span className={`num ${homeLeads ? 'is-lead' : ''}`}>{statText(s.category, s.home, lang)}</span>
                            </div>
                            <div className="gm2-compare-bar" aria-hidden="true">
                                <span className="is-away" style={{ flexGrow: share }} />
                                <span className="is-home" style={{ flexGrow: 1 - share }} />
                            </div>
                        </div>
                    );
                })}
            </div>

            {extras?.shotsByPeriod?.length > 0 && (
                <section className="gm2-section">
                    <h3 className="card-section-title">{fi ? 'Laukaukset erittäin' : 'Shots by period'}</h3>
                    <table className="gm2-period-table num">
                        <thead>
                            <tr>
                                <th scope="col"><span className="sr-only">{fi ? 'Joukkue' : 'Team'}</span></th>
                                {extras.shotsByPeriod.map((p) => (
                                    <th key={p.period} scope="col">{periodShort({ number: p.period, periodType: p.periodType })}</th>
                                ))}
                                <th scope="col">{fi ? 'Yht' : 'Tot'}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {[['away', awayAbbrev], ['home', homeAbbrev]].map(([key, abbrev]) => (
                                <tr key={key}>
                                    <th scope="row">
                                        <span className="dt-dot" style={{ background: colourOf(abbrev) }} aria-hidden="true" /> {abbrev}
                                    </th>
                                    {extras.shotsByPeriod.map((p) => <td key={p.period}>{p[key]}</td>)}
                                    <td className="is-total">{extras.shotsByPeriod.reduce((sum, p) => sum + (p[key] ?? 0), 0)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </section>
            )}
        </>
    );
}

// ---------------------------------------------------------------------------
// Aloitukset
// ---------------------------------------------------------------------------

function GameFaceoffs({ faceoffs, awayAbbrev, homeAbbrev, lang, onPlayerClick }) {
    const fi = lang === 'fi';
    const rows = useMemo(() => (faceoffs?.players ?? []).map((p) => ({
        id: p.playerId,
        name: p.name,
        team: p.isHome ? homeAbbrev : awayAbbrev,
        pos: p.position,
        won: p.won,
        total: p.total,
        pct: p.pct,
        oz: p.offensive?.total ? p.offensive.won / p.offensive.total : null,
        dz: p.defensive?.total ? p.defensive.won / p.defensive.total : null,
    })), [faceoffs, awayAbbrev, homeAbbrev]);

    if (rows.length === 0) return <p className="panel-hint">{fi ? 'Aloitustietoja ei ole.' : 'No faceoff data.'}</p>;

    const totals = faceoffs?.totals;
    const zonePct = (v) => pct(v, 0, lang);

    return (
        <>
            {totals && (
                <div className="gm2-compare" style={{ '--away': colourOf(awayAbbrev), '--home': colourOf(homeAbbrev) }}>
                    <div className="gm2-compare-row">
                        <div className="gm2-compare-values">
                            <span className="num">{totals.away.won}/{totals.away.total}</span>
                            <span className="gm2-compare-label">{fi ? 'Aloitukset' : 'Faceoffs'}</span>
                            <span className="num">{totals.home.won}/{totals.home.total}</span>
                        </div>
                        <div className="gm2-compare-bar" aria-hidden="true">
                            <span className="is-away" style={{ flexGrow: totals.away.won }} />
                            <span className="is-home" style={{ flexGrow: totals.home.won }} />
                        </div>
                    </div>
                </div>
            )}
            <DataTable
                rows={rows}
                columns={[
                    { key: 'won', label: fi ? 'V' : 'W', title: fi ? 'Voitetut' : 'Won', format: (v, r) => `${v}/${r.total}` },
                    { key: 'pct', label: '%', title: fi ? 'Voittoprosentti' : 'Win %', format: (v) => pct(v, 0, lang) },
                    { key: 'oz', label: fi ? 'HA%' : 'OZ%', title: fi ? 'Hyökkäysalueella' : 'Offensive zone', format: zonePct },
                    { key: 'dz', label: fi ? 'PA%' : 'DZ%', title: fi ? 'Puolustusalueella' : 'Defensive zone', format: zonePct },
                ]}
                identity={{
                    label: fi ? 'Pelaaja' : 'Player',
                    render: (row) => (
                        <span className="dt-person">
                            <span className="dt-dot" style={{ background: colourOf(row.team) }} aria-hidden="true" />
                            <span className="dt-person-text">
                                <span className="dt-name">{row.name}</span>
                                <span className="dt-meta">{row.team} · {positionLabel(row.pos, lang)}</span>
                            </span>
                        </span>
                    ),
                }}
                defaultSort={{ key: 'won', dir: 'desc' }}
                onRowClick={(row) => onPlayerClick(row.id)}
                language={lang}
                caption={fi ? 'Aloitukset' : 'Faceoffs'}
            />
        </>
    );
}

// ---------------------------------------------------------------------------
// Tiedot
// ---------------------------------------------------------------------------

function GameInfo({ game, extras, extrasLoading, pregame, awayAbbrev, homeAbbrev, lang, onPlayerClick }) {
    const fi = lang === 'fi';
    const start = game?.startTimeUTC ? new Date(game.startTimeUTC) : null;
    const networks = [...new Set((game?.tvBroadcasts ?? []).map((b) => b.network))];
    const referees = (extras?.referees ?? []).filter(Boolean);
    const linesmen = (extras?.linesmen ?? []).filter(Boolean);
    const series = extras?.seasonSeries ?? [];

    return (
        <>
            <div className="facts">
                {start && (
                    <span className="fact"><IconCalendar size={14} stroke={2} aria-hidden="true" />
                        {start.toLocaleDateString(fi ? 'fi-FI' : 'en-US', { weekday: 'short', day: 'numeric', month: 'numeric', year: 'numeric' })}
                        {' '}<strong>{start.toLocaleTimeString(fi ? 'fi-FI' : 'en-GB', { hour: '2-digit', minute: '2-digit' })}</strong>
                    </span>
                )}
                {game?.venue?.default && (
                    <span className="fact"><IconMapPin size={14} stroke={2} aria-hidden="true" />
                        {[game.venue.default, game.venueLocation?.default].filter(Boolean).join(', ')}
                    </span>
                )}
                {networks.length > 0 && (
                    <span className="fact"><IconDeviceTv size={14} stroke={2} aria-hidden="true" />{networks.join(', ')}</span>
                )}
            </div>

            {extrasLoading ? (
                <div className="skeleton" style={{ height: 200, marginTop: 'var(--space-4)' }} />
            ) : (
                <>
                    {(extras?.away?.headCoach || extras?.home?.headCoach) && (
                        <section className="gm2-section">
                            <h3 className="card-section-title">{fi ? 'Päävalmentajat' : 'Head coaches'}</h3>
                            <div className="facts">
                                <span className="fact"><IconUser size={14} stroke={2} aria-hidden="true" />{awayAbbrev} <strong>{extras?.away?.headCoach ?? '–'}</strong></span>
                                <span className="fact"><IconUser size={14} stroke={2} aria-hidden="true" />{homeAbbrev} <strong>{extras?.home?.headCoach ?? '–'}</strong></span>
                            </div>
                        </section>
                    )}

                    {referees.length > 0 && (
                        <section className="gm2-section">
                            <h3 className="card-section-title">{fi ? 'Tuomarit' : 'Officials'}</h3>
                            <div className="facts">
                                <span className="fact"><IconFlag size={14} stroke={2} aria-hidden="true" />{referees.join(', ')}</span>
                                {linesmen.length > 0 && <span className="fact">{fi ? 'Linjat' : 'Linesmen'}: {linesmen.join(', ')}</span>}
                            </div>
                        </section>
                    )}

                    {!pregame && ['away', 'home'].some((s) => extras?.[s]?.scratches?.length) && (
                        <section className="gm2-section">
                            <h3 className="card-section-title">{fi ? 'Ylimääräiset' : 'Scratches'}</h3>
                            {['away', 'home'].map((s) => (
                                <div key={s} className="gm2-scratches">
                                    <span className="gm2-scratch-team">
                                        <span className="dt-dot" style={{ background: colourOf(s === 'home' ? homeAbbrev : awayAbbrev) }} aria-hidden="true" />
                                        {s === 'home' ? homeAbbrev : awayAbbrev}
                                    </span>
                                    <span className="gm2-scratch-list">
                                        {(extras?.[s]?.scratches ?? []).map((p, i) => (
                                            <React.Fragment key={p.id}>
                                                {i > 0 && ', '}
                                                <button type="button" className="link-button" onClick={() => onPlayerClick(p.id)}>{p.name}</button>
                                            </React.Fragment>
                                        ))}
                                    </span>
                                </div>
                            ))}
                        </section>
                    )}

                    {series.length > 0 && (
                        <section className="gm2-section">
                            <div className="card-section-head">
                                <h3 className="card-section-title">{fi ? 'Keskinäiset ottelut' : 'Season series'}</h3>
                                {extras?.seriesWins && (
                                    <span className="pc2-note">{awayAbbrev} {extras.seriesWins.awayTeamWins}–{extras.seriesWins.homeTeamWins} {homeAbbrev}</span>
                                )}
                            </div>
                            <ul className="team-games">
                                {series.map((g) => (
                                    <li key={g.id} className={`gm2-series-row ${g.id === game?.id ? 'is-current' : ''}`}>
                                        <span className="tg-date">{shortDate(g.date, lang)}</span>
                                        <span className="gm2-series-teams">
                                            <span className="dt-dot" style={{ background: colourOf(g.away) }} aria-hidden="true" />{g.away}
                                            <span className="recent-at">@</span>
                                            <span className="dt-dot" style={{ background: colourOf(g.home) }} aria-hidden="true" />{g.home}
                                        </span>
                                        <span className="num gm2-series-score">
                                            {g.awayScore != null ? `${g.awayScore}–${g.homeScore}` : (g.id === game?.id ? (fi ? 'tämä' : 'this') : '–')}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}
                </>
            )}
        </>
    );
}

// ---------------------------------------------------------------------------
// Kentälliset
// ---------------------------------------------------------------------------

/**
 * Pelattu tai käynnissä oleva ottelu: tämän ottelun kentälliset.
 * Tuleva ottelu: kummankin joukkueen edellisen ottelun kentälliset, koska
 * illan kokoonpanoa ei julkaista virallisesti etukäteen.
 */
function GameLines({ gameId, pregame, awayAbbrev, homeAbbrev, lang, onPlayerClick }) {
    const fi = lang === 'fi';
    const [team, setTeam] = useState(awayAbbrev);

    const { data, isLoading, error } = useFetchWhenOpen(
        true,
        (signal) => (pregame
            ? Promise.all([api.teamLines(awayAbbrev, { signal }), api.teamLines(homeAbbrev, { signal })])
                .then(([away, home]) => ({ pregame: true, teams: { [awayAbbrev]: away, [homeAbbrev]: home } }))
            : api.gameLines(gameId, { signal }).then((g) => ({ pregame: false, game: g }))),
        [gameId, pregame],
    );

    const picker = (
        <div className="gm2-filters">
            <Chips
                label={fi ? 'Joukkue' : 'Team'}
                value={team}
                onChange={setTeam}
                options={[{ value: awayAbbrev, label: awayAbbrev }, { value: homeAbbrev, label: homeAbbrev }]}
            />
        </div>
    );

    if (isLoading) return <>{picker}<div className="skeleton" style={{ height: 320 }} /></>;
    if (error || !data) return <p className="panel-hint">{fi ? 'Kentällisten haku epäonnistui.' : 'Could not load lines.'}</p>;

    if (data.pregame) {
        const latest = data.teams[team];
        const injured = new Map((latest?.injured ?? []).map((i) => [i.id, i]));
        return (
            <>
                {picker}
                {latest?.lines ? (
                    <>
                        <p className="ln-context">
                            {fi
                                ? `Edellisen ottelun kentälliset (${shortDate(latest.date, lang)} ${latest.isHome ? 'vs' : '@'} ${latest.opponent}). Illan kokoonpano voi muuttua.`
                                : `Lines from the previous game (${shortDate(latest.date, lang)} ${latest.isHome ? 'vs' : '@'} ${latest.opponent}). Tonight's lineup may change.`}
                        </p>
                        <LinesView lines={latest.lines} lang={lang} injured={injured} onPlayerClick={onPlayerClick} />
                    </>
                ) : (
                    <p className="panel-hint">{fi ? 'Joukkueella ei ole vielä pelattuja otteluita.' : 'No games played yet.'}</p>
                )}
            </>
        );
    }

    if (!data.game?.available) {
        return <p className="panel-hint">{fi ? 'Vaihtotiedot eivät ole vielä saatavilla. Ne päivittyvät ottelun aikana.' : 'Shift data is not available yet.'}</p>;
    }

    return (
        <>
            {picker}
            <LinesView lines={data.game.teams?.[team]} lang={lang} onPlayerClick={onPlayerClick} />
        </>
    );
}
