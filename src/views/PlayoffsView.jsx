import React, { useMemo, useState } from 'react';
import { IconTrophy, IconInfoCircle, IconChevronDown } from '@tabler/icons-react';
import ViewHeader from '../components/shell/ViewHeader';
import Segmented from '../components/ui/Segmented';
import { useApi } from '../hooks/useApi';
import { useSettings } from '../state/settings';
import { api } from '../utils/api';
import { teamByAbbrev, teamNickname } from '../utils/teams';
import { teamColors, DEFAULT_TEAM_COLORS } from '../utils/teamColors';
import { shortDate } from '../utils/format';
import { routeOf } from '../router/routes';

/**
 * Pudotuspelit: kaavio kierroksittain ja sarjojen ottelut.
 *
 * Puhelimessa perinteinen haarukkakaavio ei mahdu leveyssuunnassa, joten
 * kierrokset ovat välilehtinä ja sarjat kortteina. Kortin avaus näyttää
 * sarjan ottelut, joista pääsee suoraan ottelunäkymään.
 */

const colourOf = (abbrev) => (teamColors[abbrev] ?? DEFAULT_TEAM_COLORS)[0];

const ROUND_NAMES = {
    1: { fi: '1. kierros', en: 'First round' },
    2: { fi: '2. kierros', en: 'Second round' },
    3: { fi: 'Konferenssifinaalit', en: 'Conference finals' },
    4: { fi: 'Finaali', en: 'Final' },
};

const FIRST_YEAR = 2011;

export default function PlayoffsView({ onTeamClick, onGameClick }) {
    const { language, favTeams } = useSettings();
    const lang = language === 'en' ? 'en' : 'fi';
    const fi = lang === 'fi';
    const route = routeOf('/taulukot/pudotuspelit');

    const [year, setYear] = useState(null);
    const [round, setRound] = useState(null);

    const { data, error, reload } = useApi((signal) => api.playoffs(year ?? undefined, { signal }), [year]);

    const series = useMemo(() => data?.series ?? [], [data]);
    const rounds = [...new Set(series.map((s) => s.round))].sort();
    // Oletuksena viimeisin kierros, jolla on sarjoja (käynnissä oleva tai finaali).
    const activeRound = round && rounds.includes(round) ? round : rounds.at(-1);
    const inRound = series.filter((s) => s.round === activeRound);

    const byConference = activeRound === 4
        ? [{ key: 'final', rows: inRound }]
        : ['Eastern', 'Western'].map((conf) => ({
            key: conf,
            label: conf === 'Eastern' ? (fi ? 'Itäinen konferenssi' : 'Eastern Conference') : (fi ? 'Läntinen konferenssi' : 'Western Conference'),
            rows: inRound.filter((s) => teamByAbbrev(s.top?.abbrev ?? s.bottom?.abbrev)?.conference === conf),
        })).filter((g) => g.rows.length > 0);

    const shownYear = data?.year;
    const endYearNow = new Date().getMonth() + 1 >= 8 ? new Date().getFullYear() + 1 : new Date().getFullYear();
    const years = Array.from({ length: endYearNow - FIRST_YEAR + 1 }, (_, i) => endYearNow - i);

    return (
        <div className="view">
            <ViewHeader icon={route.icon} title={route.label[lang]} subtitle={shownYear ? `${shownYear - 1}–${String(shownYear).slice(2)}` : route.hint[lang]}>
                <div className="season-picker">
                    <select
                        className="select"
                        value={year ?? ''}
                        onChange={(e) => { setYear(e.target.value ? Number(e.target.value) : null); setRound(null); }}
                        aria-label={fi ? 'Vuosi' : 'Year'}
                    >
                        <option value="">{fi ? 'Viimeisimmät' : 'Latest'}</option>
                        {years.map((y) => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
            </ViewHeader>

            {data?.isPrevious && (
                <p className="notice">
                    <IconInfoCircle size={16} stroke={2} aria-hidden="true" />
                    {fi ? `Tämän kauden pudotuspelit eivät ole alkaneet, joten näytetään vuosi ${shownYear}.` : `This season's playoffs haven't started, so ${shownYear} is shown.`}
                </p>
            )}

            {error && !data ? (
                <div className="panel">
                    <p className="panel-hint">{fi ? 'Kaavion haku epäonnistui.' : 'Could not load the bracket.'}</p>
                    <button type="button" className="chip" onClick={reload}>{fi ? 'Yritä uudelleen' : 'Try again'}</button>
                </div>
            ) : !data ? (
                <div className="skeleton" style={{ height: 420 }} />
            ) : series.length === 0 ? (
                <p className="panel-hint">{fi ? 'Tältä vuodelta ei ole pudotuspelikaaviota.' : 'No bracket for this year.'}</p>
            ) : (
                <>
                    {data.champion && (
                        <button type="button" className="po-champion" style={{ '--team': colourOf(data.champion) }} onClick={() => onTeamClick(data.champion)}>
                            <IconTrophy size={26} stroke={1.7} aria-hidden="true" />
                            <span>
                                <span className="po-champion-label">Stanley Cup {shownYear}</span>
                                <span className="po-champion-name">{teamByAbbrev(data.champion)?.name ?? data.champion}</span>
                            </span>
                        </button>
                    )}

                    <div className="toolbar">
                        <Segmented
                            size="sm"
                            label={fi ? 'Kierros' : 'Round'}
                            value={activeRound}
                            onChange={setRound}
                            options={rounds.map((r) => ({ value: r, label: ROUND_NAMES[r]?.[lang] ?? r }))}
                        />
                    </div>

                    {byConference.map((g) => (
                        <section key={g.key} className="po-group">
                            {g.label && <h2 className="sched2-day-title"><span>{g.label}</span></h2>}
                            <div className="po-series-list">
                                {g.rows.map((s) => (
                                    <SeriesCard
                                        key={s.letter}
                                        series={s}
                                        season={`${shownYear - 1}${shownYear}`}
                                        lang={lang}
                                        favTeams={favTeams}
                                        onGameClick={onGameClick}
                                    />
                                ))}
                            </div>
                        </section>
                    ))}
                </>
            )}
        </div>
    );
}

function SeriesCard({ series, season, lang, favTeams, onGameClick }) {
    const fi = lang === 'fi';
    const [open, setOpen] = useState(false);
    const { top, bottom, winner } = series;

    let status;
    if (!top || !bottom) status = fi ? 'Odottaa vastustajaa' : 'Awaiting opponent';
    else if (winner) {
        const w = winner === top.abbrev ? top : bottom;
        const l = winner === top.abbrev ? bottom : top;
        status = fi ? `${w.abbrev} voitti ${w.wins}–${l.wins}` : `${w.abbrev} won ${w.wins}–${l.wins}`;
    } else if (top.wins === bottom.wins) {
        status = top.wins === 0 ? (fi ? 'Ei alkanut' : 'Not started') : (fi ? `Tasan ${top.wins}–${bottom.wins}` : `Tied ${top.wins}–${bottom.wins}`);
    } else {
        const lead = top.wins > bottom.wins ? top : bottom;
        const trail = lead === top ? bottom : top;
        status = fi ? `${lead.abbrev} johtaa ${lead.wins}–${trail.wins}` : `${lead.abbrev} leads ${lead.wins}–${trail.wins}`;
    }

    const teamRow = (t) => t && (
        <div className={`po-team ${winner && winner !== t.abbrev ? 'is-out' : ''} ${favTeams.includes(t.abbrev) ? 'is-fav' : ''}`}>
            <span className="po-seed">{t.seed ?? ''}</span>
            <span className="dt-dot" style={{ background: colourOf(t.abbrev) }} aria-hidden="true" />
            <span className="po-abbrev">{t.abbrev}</span>
            <span className="po-name">{teamNickname(t.abbrev)}</span>
            <span className="po-wins num">{t.wins}</span>
        </div>
    );

    return (
        <div className={`po-series ${open ? 'is-open' : ''}`}>
            <button
                type="button"
                className="po-series-head"
                onClick={() => setOpen((o) => !o)}
                aria-expanded={open}
                disabled={!top || !bottom}
            >
                {teamRow(top)}
                {teamRow(bottom)}
                <span className="po-status">
                    {status}
                    {top && bottom && <IconChevronDown size={14} stroke={2} className="po-chevron" aria-hidden="true" />}
                </span>
            </button>
            {open && <SeriesGames season={season} letter={series.letter} lang={lang} onGameClick={onGameClick} />}
        </div>
    );
}

function SeriesGames({ season, letter, lang, onGameClick }) {
    const fi = lang === 'fi';
    const { data, error } = useApi((signal) => api.playoffSeries(season, letter, { signal }), [season, letter]);

    if (error) return <p className="panel-hint">{fi ? 'Otteluiden haku epäonnistui.' : 'Could not load games.'}</p>;
    if (!data) return <div className="loading-line" />;

    return (
        <ul className="po-games">
            {data.games.map((g) => {
                const played = g.gameState === 'FINAL' || g.gameState === 'OFF';
                const live = g.gameState === 'LIVE' || g.gameState === 'CRIT';
                const extra = g.gameOutcome?.lastPeriodType;
                return (
                    <li key={g.id}>
                        <button type="button" className="po-game" onClick={() => onGameClick(g)}>
                            <span className="po-game-no">{fi ? 'Ott.' : 'G'} {g.gameNumber}</span>
                            <span className="po-game-date">{shortDate(new Date(g.startTimeUTC).toLocaleDateString('en-CA'), lang)}</span>
                            <span className="po-game-teams">
                                {g.awayTeam.abbrev} <span className="recent-at">@</span> {g.homeTeam.abbrev}
                            </span>
                            <span className="po-game-score num">
                                {played || live
                                    ? <>{g.awayTeam.score}–{g.homeTeam.score}{extra === 'OT' && <span className="tg-extra">{fi ? ' JA' : ' OT'}</span>}</>
                                    : (g.ifNecessary ? (fi ? 'tarv.' : 'if nec.') : new Date(g.startTimeUTC).toLocaleTimeString(fi ? 'fi-FI' : 'en-GB', { hour: '2-digit', minute: '2-digit' }))}
                            </span>
                        </button>
                    </li>
                );
            })}
        </ul>
    );
}
