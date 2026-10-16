import React, { useEffect, useMemo, useState } from 'react';
import { IconChartDots, IconChartBar, IconTrophy, IconTarget, IconArrowsLeftRight, IconChartLine, IconPlayerPlayFilled, IconExternalLink } from '@tabler/icons-react';
import Chips from '../ui/Chips';
import StatTiles from '../ui/StatTiles';
import { useApi } from '../../hooks/useApi';
import { api } from '../../utils/api';
import { int, dec, pct, signed, clock } from '../../utils/format';
import { chartColor } from '../../utils/chartColors';
import { ShotsGoalsScatter, GoalsByPeriod, LeaderBars, GameCompare, ShotTimeline, ShotsByPeriod } from './RoundCharts';

/**
 * Kierroksen data: koko ottelupäivä yhdellä silmäyksellä.
 *
 * Kaikki ottelut: kierros lukuina, laukaukset vs. maalit -kaavio, maalit
 * erittäin, kierroksen kärjet, maalivirta ja ottelut vierekkäin.
 * Yksi ottelu (sirusta): joukkuetilastot, laukauskäyrä, laukaukset
 * erittäin sekä ottelun kärjet ja maalit.
 *
 * Data päivittyy 30 sekunnin välein, kun otteluita on käynnissä ja
 * sovellus on näkyvissä.
 */

const POLL_MS = 30_000;
const LIVE = new Set(['LIVE', 'CRIT']);
const NOT_STARTED = new Set(['FUT', 'PRE']);

const LEADER_CATEGORIES = [
    { value: 'points', fi: 'Pisteet', en: 'Points', skater: true, get: (p) => p.p, display: (p) => `${p.g}+${p.a}`, tie: (p) => p.g },
    { value: 'goals', fi: 'Maalit', en: 'Goals', skater: true, get: (p) => p.g, display: (p) => int(p.g) },
    { value: 'shots', fi: 'Laukaukset', en: 'Shots', skater: true, get: (p) => p.sog, display: (p) => int(p.sog) },
    { value: 'xg', fi: 'xG', en: 'xG', skater: true, get: (p) => p.xg ?? 0, display: (p, lang) => dec(p.xg, 2, lang) },
    { value: 'hits', fi: 'Taklaukset', en: 'Hits', skater: true, get: (p) => p.hit, display: (p) => int(p.hit) },
    { value: 'blocks', fi: 'Blokit', en: 'Blocks', skater: true, get: (p) => p.blk, display: (p) => int(p.blk) },
    { value: 'toi', fi: 'Peliaika', en: 'TOI', skater: true, get: (p) => p.toi, display: (p) => clock(p.toi) },
    { value: 'plusMinus', fi: '+/−', en: '+/−', skater: true, get: (p) => p.pm, display: (p) => signed(p.pm) },
    { value: 'takeaways', fi: 'Riistot', en: 'Takeaways', skater: true, get: (p) => p.tk, display: (p) => int(p.tk) },
    { value: 'saves', fi: 'Torjunnat', en: 'Saves', skater: false, get: (p) => p.sv, display: (p) => `${p.sv}/${p.sa}`, tie: (p) => -p.ga },
    { value: 'savePct', fi: 'Torjunta-%', en: 'Save %', skater: false, minShots: 15, get: (p) => (p.sa ? p.sv / p.sa : 0), display: (p, lang) => `${pct(p.sa ? p.sv / p.sa : null, 1, lang)} %` },
];

const STRENGTH_TAG = { pp: { fi: 'YV', en: 'PP' }, sh: { fi: 'AV', en: 'SH' } };

const gameLabel = (g) => `${g.away.abbrev}–${g.home.abbrev}`;
const parseFraction = (v) => {
    const [a, b] = String(v ?? '').split('/').map(Number);
    return { made: a || 0, tries: b || 0 };
};

function periodLabel(goal, fi) {
    if (goal.periodType === 'OT') return fi ? 'JA' : 'OT';
    if (goal.periodType === 'SO') return fi ? 'VL' : 'SO';
    return fi ? `${goal.period}. erä` : `P${goal.period}`;
}

function Card({ icon, title, meta, children }) {
    const Icon = icon;
    return (
        <section className="rd-card">
            <h3 className="rd-card-title">
                <Icon size={17} stroke={2} aria-hidden="true" />
                {title}
                {meta && <span className="rd-card-meta">{meta}</span>}
            </h3>
            {children}
        </section>
    );
}

export default function RoundView({ date, lang, onGameClick, onPlayerClick }) {
    const fi = lang === 'fi';
    const { data, error, isLoading, reload } = useApi((signal) => api.round(date, { signal }), [date]);
    const [selected, setSelected] = useState('all');
    const [category, setCategory] = useState('points');
    const [showAllGoals, setShowAllGoals] = useState(false);

    // Live-päivitys vain kun otteluita on käynnissä ja sovellus näkyvissä.
    const live = Boolean(data?.hasLiveGames) && data?.date === date;
    useEffect(() => {
        if (!live) return undefined;
        const timer = setInterval(() => {
            if (document.visibilityState === 'visible') reload();
        }, POLL_MS);
        return () => clearInterval(timer);
    }, [live, reload]);

    const round = data?.date === date ? data : null;
    const games = useMemo(() => round?.games ?? [], [round]);
    const started = useMemo(() => games.filter((g) => !NOT_STARTED.has(g.state)), [games]);
    const game = selected === 'all' ? null : started.find((g) => g.id === selected) ?? null;
    const labels = useMemo(() => new Map(games.map((g) => [g.id, gameLabel(g)])), [games]);

    const players = useMemo(
        () => (round?.players ?? []).filter((p) => !game || p.gameId === game.id),
        [round, game],
    );
    const goals = useMemo(
        () => (round?.goals ?? []).filter((g) => !game || g.gameId === game.id),
        [round, game],
    );

    const leaders = useMemo(() => {
        const def = LEADER_CATEGORIES.find((c) => c.value === category) ?? LEADER_CATEGORIES[0];
        return players
            .filter((p) => (def.skater ? p.pos !== 'G' : p.pos === 'G'))
            .filter((p) => !def.minShots || p.sa >= def.minShots)
            .map((p) => ({ ...p, value: def.get(p), display: def.display(p, lang), tieValue: def.tie?.(p) ?? 0 }))
            .filter((p) => p.value > 0)
            .sort((a, b) => b.value - a.value || b.tieValue - a.tieValue)
            .slice(0, 8);
    }, [players, category, lang]);

    if (error && !round) {
        return (
            <div className="panel">
                <p className="panel-hint">{fi ? 'Kierroksen datan haku epäonnistui.' : 'Could not load round data.'}</p>
                <button type="button" className="chip" onClick={reload}>{fi ? 'Yritä uudelleen' : 'Try again'}</button>
            </div>
        );
    }
    if (!round) return <div className="skeleton" style={{ height: 520 }} aria-label={fi ? 'Ladataan' : 'Loading'} />;

    if (games.length === 0) {
        return <p className="empty-state">{fi ? 'Tälle päivälle ei ole otteluita.' : 'No games on this day.'}</p>;
    }
    if (started.length === 0) {
        return (
            <p className="empty-state">
                {fi ? 'Kierros ei ole vielä alkanut. Data täyttyy, kun ensimmäinen ottelu alkaa.' : 'The round has not started yet. Data appears once the first game begins.'}
            </p>
        );
    }

    const gameOptions = [
        { value: 'all', label: fi ? 'Kaikki ottelut' : 'All games' },
        ...started.map((g) => ({
            value: g.id,
            label: `${gameLabel(g)} ${g.away.score}–${g.home.score}${LIVE.has(g.state) ? ' •' : ''}`,
        })),
    ];

    const visibleGoals = showAllGoals ? goals : goals.slice(0, 10);

    return (
        <div className={`rd ${isLoading ? 'is-refreshing' : ''}`}>
            <div className="rd-filter">
                <Chips label={fi ? 'Ottelu' : 'Game'} value={selected} onChange={(v) => { setSelected(v); setShowAllGoals(false); }} options={gameOptions} />
            </div>

            {live && (
                <p className="rd-live">
                    <span className="rd-live-dot" aria-hidden="true" />
                    {fi ? 'Päivittyy 30 sekunnin välein' : 'Updates every 30 seconds'}
                </p>
            )}

            {game ? (
                <SingleGame game={game} lang={lang} onGameClick={onGameClick} updated={round.updated} />
            ) : (
                <AllGames games={started} goals={round.goals} lang={lang} onGameClick={onGameClick} onSelect={setSelected} />
            )}

            <Card icon={IconTrophy} title={game ? (fi ? 'Ottelun kärjet' : 'Game leaders') : (fi ? 'Kierroksen kärjet' : 'Round leaders')}>
                <div className="rd-card-filter">
                    <Chips
                        label={fi ? 'Tilasto' : 'Stat'}
                        value={category}
                        onChange={setCategory}
                        options={LEADER_CATEGORIES.map((c) => ({ value: c.value, label: c[lang === 'fi' ? 'fi' : 'en'] }))}
                    />
                </div>
                {leaders.length > 0
                    ? <LeaderBars rows={leaders} onPlayerClick={onPlayerClick} games={game ? null : labels} />
                    : <p className="panel-hint">{fi ? 'Ei vielä tilastoja tästä.' : 'Nothing here yet.'}</p>}
            </Card>

            <Card icon={IconTarget} title={fi ? 'Maalivirta' : 'Goal feed'} meta={`${goals.length} ${fi ? 'maalia' : 'goals'}`}>
                {goals.length === 0 ? (
                    <p className="panel-hint">{fi ? 'Ei maaleja vielä.' : 'No goals yet.'}</p>
                ) : (
                    <>
                        <ul className="rd-goals">
                            {visibleGoals.map((g) => {
                                const gm = games.find((x) => x.id === g.gameId);
                                const tag = g.emptyNet ? (fi ? 'TM' : 'EN') : STRENGTH_TAG[g.strength]?.[lang === 'fi' ? 'fi' : 'en'];
                                return (
                                    <li key={`${g.gameId}-${g.period}-${g.time}-${g.scorer.id}`} className="rd-goal-row" style={{ '--team': chartColor(g.team) }}>
                                        <span className="rd-goal-when">
                                            <span className="num">{g.time}</span>
                                            <span>{periodLabel(g, fi)}</span>
                                        </span>
                                        <span className="rd-goal-main">
                                            <button type="button" className="rd-goal-scorer" onClick={() => g.scorer.id && onPlayerClick(g.scorer.id)}>
                                                {g.scorer.name}{g.scorer.toDate != null && <span className="gm2-todate"> ({g.scorer.toDate})</span>}
                                            </button>
                                            {tag && <span className="dt-tag">{tag}</span>}
                                            <span className="rd-goal-assists">
                                                {g.assists.length > 0
                                                    ? g.assists.map((a, k) => (
                                                        <React.Fragment key={a.id ?? k}>
                                                            {k > 0 && ', '}
                                                            <button type="button" className="gm2-assist" onClick={() => a.id && onPlayerClick(a.id)}>{a.name}</button>
                                                        </React.Fragment>
                                                    ))
                                                    : (fi ? 'ilman syöttäjää' : 'unassisted')}
                                            </span>
                                        </span>
                                        <button type="button" className="rd-goal-game" onClick={() => gm && onGameClick(toGameRef(gm))}>
                                            <span className="rd-goal-score num">{g.awayScore}–{g.homeScore}</span>
                                            {!game && gm && <span className="rd-goal-label">{gameLabel(gm)}</span>}
                                        </button>
                                        {g.video ? (
                                            <a className="gm2-video" href={g.video} target="_blank" rel="noreferrer" aria-label={fi ? 'Katso maali' : 'Watch goal'}>
                                                <IconPlayerPlayFilled size={12} aria-hidden="true" />
                                            </a>
                                        ) : <span className="gm2-video is-empty" aria-hidden="true" />}
                                    </li>
                                );
                            })}
                        </ul>
                        {goals.length > visibleGoals.length && (
                            <button type="button" className="block-btn" onClick={() => setShowAllGoals(true)}>
                                {fi ? `Näytä kaikki ${goals.length} maalia` : `Show all ${goals.length} goals`}
                            </button>
                        )}
                        {!game && (
                            <p className="source-note">
                                {fi
                                    ? 'Uusin ensin. Eri otteluiden maalien järjestys on arvio ottelun alkuajasta ja pelikellosta.'
                                    : 'Newest first. Order across games is estimated from start times and the game clock.'}
                            </p>
                        )}
                    </>
                )}
            </Card>
        </div>
    );
}

const toGameRef = (g) => ({ id: g.id, awayTeam: { abbrev: g.away.abbrev }, homeTeam: { abbrev: g.home.abbrev } });

/** Joukkuetilastojen rivit vertailupalkkeihin. */
function compareRows(game, fi, full) {
    const s = game.stats ?? {};
    const value = (key, side) => s[key]?.[side];
    const pp = (side) => parseFraction(value('powerPlay', side));
    const rows = [
        ...(game.xg ? [{
            key: 'xg',
            label: fi ? 'Odotetut maalit (xG)' : 'Expected goals (xG)',
            away: game.xg.away,
            home: game.xg.home,
            format: (v, lang) => dec(v, 2, lang),
        }] : []),
        { key: 'sog', label: fi ? 'Laukaukset' : 'Shots', away: value('sog', 'away') ?? game.away.sog, home: value('sog', 'home') ?? game.home.sog },
        { key: 'hits', label: fi ? 'Taklaukset' : 'Hits', away: value('hits', 'away'), home: value('hits', 'home') },
        { key: 'blockedShots', label: fi ? 'Blokit' : 'Blocks', away: value('blockedShots', 'away'), home: value('blockedShots', 'home') },
        {
            key: 'faceoffs',
            label: fi ? 'Aloitukset' : 'Faceoffs',
            away: value('faceoffWinningPctg', 'away'),
            home: value('faceoffWinningPctg', 'home'),
            format: (v, lang) => `${pct(v, 0, lang)} %`,
        },
        {
            key: 'powerPlay',
            label: fi ? 'Ylivoimamaalit' : 'PP goals',
            away: pp('away').made,
            home: pp('home').made,
            awayRaw: value('powerPlay', 'away') ?? '0/0',
            homeRaw: value('powerPlay', 'home') ?? '0/0',
            format: (v) => v,
        },
    ];
    if (full) {
        rows.push(
            { key: 'takeaways', label: fi ? 'Riistot' : 'Takeaways', away: value('takeaways', 'away'), home: value('takeaways', 'home') },
            { key: 'giveaways', label: fi ? 'Menetykset' : 'Giveaways', away: value('giveaways', 'away'), home: value('giveaways', 'home'), lowerIsBetter: true },
            { key: 'pim', label: fi ? 'Jäähyminuutit' : 'PIM', away: value('pim', 'away'), home: value('pim', 'home'), lowerIsBetter: true },
        );
    }
    return rows.filter((r) => r.away != null || r.home != null);
}

function stateText(game, fi) {
    if (LIVE.has(game.state)) {
        if (game.clock?.intermission) return fi ? `${game.period}. erätauko` : `End of P${game.period}`;
        const p = game.periodType === 'OT' ? (fi ? 'JA' : 'OT') : `${game.period}.`;
        return `${p} ${game.clock?.time ?? ''}`.trim();
    }
    if (game.lastPeriodType === 'OT') return fi ? 'Päättynyt · JA' : 'Final · OT';
    if (game.lastPeriodType === 'SO') return fi ? 'Päättynyt · VL' : 'Final · SO';
    return fi ? 'Päättynyt' : 'Final';
}

/** Kierroksen suurimmat erot maalien ja odotettujen välillä: kuka ylitti, kuka jäi alle. */
function XgVerdict({ teams, lang }) {
    const fi = lang === 'fi';
    const rows = teams
        .filter((t) => t.xg != null)
        .map((t) => ({ ...t, diff: t.goals - t.xg }))
        .sort((a, b) => b.diff - a.diff);
    if (rows.length < 2) return null;
    const best = rows[0];
    const worst = rows.at(-1);
    const line = (t) => `${t.team} ${t.goals} ${fi ? 'maalia' : 'goals'} / xG ${dec(t.xg, 1, lang)}`;
    const diff = (v) => `${v >= 0 ? '+' : '−'}${dec(Math.abs(v), 1, lang)}`;
    return (
        <div className="rd-verdict">
            <span className="rd-verdict-item is-over">
                <strong>{fi ? 'Ylitti eniten' : 'Most above'}</strong> {line(best)} ({diff(best.diff)})
            </span>
            <span className="rd-verdict-item is-under">
                <strong>{fi ? 'Jäi eniten alle' : 'Most below'}</strong> {line(worst)} ({diff(worst.diff)})
            </span>
        </div>
    );
}

function AllGames({ games, goals, lang, onGameClick, onSelect }) {
    const fi = lang === 'fi';

    const teams = useMemo(() => games.flatMap((g) => [
        { team: g.away.abbrev, opponent: g.home.abbrev, gameId: g.id, sog: g.stats?.sog?.away ?? g.away.sog, xg: g.xg?.away ?? null, goals: g.away.score, won: !LIVE.has(g.state) && g.away.score > g.home.score },
        { team: g.home.abbrev, opponent: g.away.abbrev, gameId: g.id, sog: g.stats?.sog?.home ?? g.home.sog, xg: g.xg?.home ?? null, goals: g.home.score, won: !LIVE.has(g.state) && g.home.score > g.away.score },
    ]), [games]);

    const totals = useMemo(() => {
        const goalsTotal = games.reduce((s, g) => s + g.away.score + g.home.score, 0);
        const shots = teams.reduce((s, t) => s + (t.sog ?? 0), 0);
        const pp = games.reduce((acc, g) => {
            const a = parseFraction(g.stats?.powerPlay?.away);
            const h = parseFraction(g.stats?.powerPlay?.home);
            return { made: acc.made + a.made + h.made, tries: acc.tries + a.tries + h.tries };
        }, { made: 0, tries: 0 });
        const overtime = games.filter((g) => g.lastPeriodType === 'OT' || g.lastPeriodType === 'SO').length;
        const shootouts = games.filter((g) => g.lastPeriodType === 'SO').length;
        const emptyNet = goals.filter((g) => g.emptyNet).length;
        const xg = games.every((g) => g.xg) ? teams.reduce((s, t) => s + (t.xg ?? 0), 0) : null;
        return { goalsTotal, shots, pp, overtime, shootouts, emptyNet, xg };
    }, [games, teams, goals]);

    const n = games.length;
    const tiles = [
        { label: fi ? 'Maalit' : 'Goals', value: int(totals.goalsTotal), sub: `${(totals.goalsTotal / n).toFixed(1).replace('.', fi ? ',' : '.')} / ${fi ? 'ottelu' : 'game'}`, tone: 'accent' },
        { label: fi ? 'Laukaukset' : 'Shots', value: int(totals.shots), sub: `${totals.shots ? pct(totals.goalsTotal / totals.shots, 1, lang) : '–'} % ${fi ? 'maaliksi' : 'scored'}` },
        { label: fi ? 'Ylivoimamaalit' : 'PP goals', value: `${totals.pp.made}/${totals.pp.tries}`, sub: totals.pp.tries ? `${pct(totals.pp.made / totals.pp.tries, 0, lang)} %` : undefined },
        totals.xg != null
            ? { label: fi ? 'Odotetut maalit' : 'Expected goals', value: dec(totals.xg, 1, lang), sub: `${fi ? 'maaleja' : 'goals'} ${totals.goalsTotal}` }
            : { label: fi ? 'Ottelut' : 'Games', value: int(n), sub: games.some((g) => LIVE.has(g.state)) ? (fi ? `${games.filter((g) => LIVE.has(g.state)).length} käynnissä` : `${games.filter((g) => LIVE.has(g.state)).length} live`) : undefined },
        { label: fi ? 'Jatkoajalle' : 'To OT', value: int(totals.overtime), sub: totals.shootouts ? `${totals.shootouts} ${fi ? 'voittolaukauskisaa' : 'shootouts'}` : undefined },
        { label: fi ? 'Tyhjiin' : 'Empty net', value: int(totals.emptyNet) },
    ];

    return (
        <>
            <section className="rd-card">
                <StatTiles tiles={tiles} />
            </section>

            <Card icon={IconChartDots} title={fi ? 'Laukaukset ja maalit' : 'Shots and goals'}>
                <ShotsGoalsScatter teams={teams} lang={lang} onTeamClick={(t) => onSelect(t.gameId)} />
                <p className="source-note">
                    {fi
                        ? 'Jokainen pallo on joukkue. Katkoviivat ovat laukaisuprosentteja: viivan yläpuolella maaleja tuli laukauksiin nähden paljon. Paksu reuna = voittaja. Pallosta aukeaa ottelu.'
                        : 'Each dot is a team. Dashed lines are shooting percentages: above a line means many goals for the shots. Thick ring = winner. Tap a dot to open the game.'}
                </p>
            </Card>

            {teams.some((t) => t.xg != null) && (
                <Card icon={IconTarget} title={fi ? 'Odotetut maalit vs. maalit' : 'Expected goals vs goals'}>
                    <ShotsGoalsScatter metric="xg" teams={teams.filter((t) => t.xg != null)} lang={lang} onTeamClick={(t) => onSelect(t.gameId)} />
                    <XgVerdict teams={teams} lang={lang} />
                    <p className="source-note">
                        {fi
                            ? 'Odotetut maalit (xG) kertovat, montako maalia joukkueen laukauksista olisi keskimäärin pitänyt syntyä: laukauksen etäisyys, kulma, tyyppi, paluukiekko ja yli-/alivoima. Lävistäjän yläpuolella joukkue teki enemmän maaleja kuin paikat antoivat odottaa (viimeistely tai onni), alapuolella vähemmän (hyvä maalivahti tai huono tuuri). Malli on sovitettu 600 NHL-ottelun 51 000 laukauksesta.'
                            : 'Expected goals (xG) estimate how many goals a team’s shots would produce on average, from distance, angle, shot type, rebounds and strength. Above the diagonal a team scored more than its chances suggested (finishing or luck), below it fewer (good goaltending or bad luck). The model is fitted on 51,000 shots from 600 NHL games.'}
                    </p>
                </Card>
            )}

            <Card icon={IconChartBar} title={fi ? 'Maalit erittäin' : 'Goals by period'}>
                <GoalsByPeriod goals={goals} lang={lang} />
            </Card>

            <Card icon={IconArrowsLeftRight} title={fi ? 'Ottelut vierekkäin' : 'Games side by side'}>
                <div className="rd-games">
                    {games.map((g) => (
                        <div key={g.id} className="rd-game">
                            <button type="button" className="rd-game-head" onClick={() => onSelect(g.id)}>
                                <span className="rd-game-score">
                                    <span style={{ color: chartColor(g.away.abbrev) }}>{g.away.abbrev}</span>
                                    <strong className="num">{g.away.score}–{g.home.score}</strong>
                                    <span style={{ color: chartColor(g.home.abbrev) }}>{g.home.abbrev}</span>
                                </span>
                                <span className={`rd-game-state ${LIVE.has(g.state) ? 'is-live' : ''}`}>{stateText(g, fi)}</span>
                            </button>
                            <GameCompare game={g} rows={compareRows(g, fi, false)} lang={lang} />
                            <button type="button" className="rd-open" onClick={() => onGameClick(toGameRef(g))}>
                                {fi ? 'Ottelukortti' : 'Game card'} <IconExternalLink size={13} stroke={2} aria-hidden="true" />
                            </button>
                        </div>
                    ))}
                </div>
            </Card>
        </>
    );
}

function SingleGame({ game, lang, onGameClick, updated }) {
    const fi = lang === 'fi';
    // Laukauskäyrä tarvitsee ottelun tapahtumat; haetaan uudelleen kun kierros päivittyy.
    const { data: shots } = useApi((signal) => api.gameShots(game.id, { signal }), [game.id, LIVE.has(game.state) ? updated : 'final']);
    const shotData = shots?.gameId === game.id ? shots : null;
    const [timeline, setTimeline] = useState('xg');

    return (
        <>
            <section className="rd-card">
                <button type="button" className="rd-game-head is-large" onClick={() => onGameClick(toGameRef(game))}>
                    <span className="rd-game-score">
                        <span style={{ color: chartColor(game.away.abbrev) }}>{game.away.abbrev}</span>
                        <strong className="num">{game.away.score}–{game.home.score}</strong>
                        <span style={{ color: chartColor(game.home.abbrev) }}>{game.home.abbrev}</span>
                    </span>
                    <span className={`rd-game-state ${LIVE.has(game.state) ? 'is-live' : ''}`}>
                        {stateText(game, fi)} · {fi ? 'avaa ottelukortti' : 'open game card'}
                    </span>
                </button>
                <GameCompare game={game} rows={compareRows(game, fi, true)} lang={lang} />
            </section>

            <Card icon={IconChartLine} title={fi ? 'Ottelun kulku' : 'Game flow'}>
                <div className="rd-card-filter">
                    <Chips
                        label={fi ? 'Käyrä' : 'Curve'}
                        value={timeline}
                        onChange={setTimeline}
                        options={[
                            { value: 'xg', label: fi ? 'Odotetut maalit' : 'Expected goals' },
                            { value: 'shots', label: fi ? 'Laukaukset' : 'Shots' },
                        ]}
                    />
                </div>
                {shotData
                    ? <ShotTimeline shots={shotData.shots} away={game.away.abbrev} home={game.home.abbrev} lang={lang} mode={timeline} />
                    : <div className="skeleton" style={{ height: 200 }} />}
                <p className="source-note">
                    {timeline === 'xg'
                        ? (fi
                            ? 'Odotetut maalit kertyvät jokaisesta torjumattomasta laukauksesta sen maalitodennäköisyyden verran. Käyrä kertoo, kumpi sai paremmat paikat; pallot ovat toteutuneita maaleja.'
                            : 'Expected goals add up from every unblocked shot by its scoring chance. The curve shows who got the better chances; dots are actual goals.')
                        : (fi
                            ? 'Laukaukset maalia kohti ottelun kuluessa. Jyrkkä nousu kertoo painostuksesta, pallot ovat maaleja.'
                            : 'Shots on goal as the game went on. A steep climb means pressure; dots are goals.')}
                </p>
            </Card>

            {game.shotsByPeriod?.length > 0 && (
                <Card icon={IconChartBar} title={fi ? 'Laukaukset erittäin' : 'Shots by period'}>
                    <ShotsByPeriod periods={game.shotsByPeriod} away={game.away.abbrev} home={game.home.abbrev} lang={lang} />
                </Card>
            )}
        </>
    );
}
