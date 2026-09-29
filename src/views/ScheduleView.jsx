import React, { useMemo, useState } from 'react';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import ViewHeader from '../components/shell/ViewHeader';
import DataTable from '../components/ui/DataTable';
import Segmented from '../components/ui/Segmented';
import Chips from '../components/ui/Chips';
import { useApi } from '../hooks/useApi';
import { usePersistentState } from '../hooks/usePersistentState';
import { useSettings } from '../state/settings';
import { api } from '../utils/api';
import { toApiDate, getGameDayDate, addDays } from '../utils/dates';
import { teamColors, DEFAULT_TEAM_COLORS } from '../utils/teamColors';
import { int } from '../utils/format';
import { routeOf } from '../router/routes';

/**
 * Otteluohjelma.
 *
 * Aamujään "kalenteri" oli fantasy-työkalu: jokaiselle joukkueelle rivi
 * päiväruutuja emojeineen. Nyt näkymässä on kaksi tilaa:
 *
 *   - Päivittäin: tulevat (ja jo pelatut) ottelut kierroksittain, suosikit
 *     korostettuina. Rivin napautus avaa ottelun.
 *   - Joukkueittain: lajiteltava taulukko ottelumääristä, koti- ja
 *     vierasotteluista ja peräkkäisistä pelipäivistä.
 */

const RANGES = [7, 14, 28];

const colourOf = (abbrev) => (teamColors[abbrev] ?? DEFAULT_TEAM_COLORS)[0];

const isFinal = (state) => state === 'FINAL' || state === 'OFF';
const isLive = (state) => state === 'LIVE' || state === 'CRIT';

function dayLabel(iso, lang) {
    const d = new Date(`${iso}T12:00:00`);
    const weekday = d.toLocaleDateString(lang === 'en' ? 'en-US' : 'fi-FI', { weekday: 'long' });
    return lang === 'en'
        ? `${weekday}, ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
        : `${weekday} ${d.getDate()}.${d.getMonth() + 1}.`;
}

export default function ScheduleView({ onTeamClick, onGameClick }) {
    const { language, favTeams } = useSettings();
    const lang = language === 'en' ? 'en' : 'fi';
    const fi = lang === 'fi';
    const route = routeOf('/taulukot/ohjelma');

    const [mode, setMode] = usePersistentState('pucknower_schedule_mode', 'days');
    const [range, setRange] = usePersistentState('pucknower_schedule_range', 7);
    const [offset, setOffset] = useState(0);
    const [onlyFavs, setOnlyFavs] = useState(false);

    const start = useMemo(() => addDays(getGameDayDate(), offset), [offset]);
    const startDate = toApiDate(start);

    const { data, error, reload } = useApi(
        (signal) => api.schedule({ startDate, days: range }, { signal }),
        [startDate, range],
    );

    const endDate = data?.dates?.at(-1);
    const periodLabel = endDate
        ? `${dayLabel(startDate, lang).split(' ').slice(1).join(' ')} – ${dayLabel(endDate, lang).split(' ').slice(1).join(' ')}`
        : '';

    return (
        <div className="view">
            <ViewHeader icon={route.icon} title={route.label[lang]} subtitle={route.hint[lang]} />

            <div className="toolbar">
                <Segmented
                    label={fi ? 'Näkymä' : 'View'}
                    value={mode}
                    onChange={setMode}
                    options={[
                        { value: 'days', label: fi ? 'Päivittäin' : 'By day' },
                        { value: 'teams', label: fi ? 'Joukkueittain' : 'By team' },
                    ]}
                />
                <div className="sched2-range">
                    <button
                        type="button"
                        className="icon-toggle"
                        onClick={() => setOffset((o) => o - range)}
                        aria-label={fi ? 'Edellinen jakso' : 'Previous period'}
                    >
                        <IconChevronLeft size={18} stroke={2} />
                    </button>
                    <span className="sched2-period num">{periodLabel || '…'}</span>
                    <button
                        type="button"
                        className="icon-toggle"
                        onClick={() => setOffset((o) => o + range)}
                        aria-label={fi ? 'Seuraava jakso' : 'Next period'}
                    >
                        <IconChevronRight size={18} stroke={2} />
                    </button>
                </div>
                <Chips
                    label={fi ? 'Jakso' : 'Range'}
                    value={range}
                    onChange={(v) => { setRange(v); setOffset(0); }}
                    options={[
                        ...RANGES.map((r) => ({ value: r, label: fi ? `${r} pv` : `${r} days` })),
                    ]}
                />
                {offset !== 0 && (
                    <button type="button" className="chip" onClick={() => setOffset(0)}>{fi ? 'Tästä päivästä' : 'From today'}</button>
                )}
            </div>

            {error ? (
                <p className="notice">
                    {fi ? 'Otteluohjelman haku epäonnistui.' : 'Could not load the schedule.'}{' '}
                    <button type="button" className="link-button" onClick={reload}>{fi ? 'Yritä uudelleen' : 'Try again'}</button>
                </p>
            ) : !data ? (
                <div className="skeleton" style={{ height: 480 }} />
            ) : mode === 'teams' ? (
                <TeamsTable data={data} lang={lang} favTeams={favTeams} onTeamClick={onTeamClick} />
            ) : (
                <>
                    {favTeams.length > 0 && (
                        <div className="sched2-filter">
                            <Chips
                                label={fi ? 'Rajaus' : 'Filter'}
                                value={onlyFavs ? 'fav' : 'all'}
                                onChange={(v) => setOnlyFavs(v === 'fav')}
                                options={[
                                    { value: 'all', label: fi ? 'Kaikki ottelut' : 'All games' },
                                    { value: 'fav', label: fi ? 'Suosikit' : 'Favourites' },
                                ]}
                            />
                        </div>
                    )}
                    <DayList data={data} lang={lang} favTeams={favTeams} onlyFavs={onlyFavs} onGameClick={onGameClick} />
                </>
            )}
        </div>
    );
}

function DayList({ data, lang, favTeams, onlyFavs, onGameClick }) {
    const fi = lang === 'fi';
    const isFavGame = (g) => favTeams.includes(g.awayTeam.abbrev) || favTeams.includes(g.homeTeam.abbrev);

    const days = (data.days ?? [])
        .map((day) => ({ ...day, games: onlyFavs ? day.games.filter(isFavGame) : day.games }))
        .filter((day) => day.games.length > 0);

    if (days.length === 0) {
        return <p className="panel-hint">{onlyFavs ? (fi ? 'Suosikeilla ei ole otteluita tällä jaksolla.' : 'No favourite games in this period.') : (fi ? 'Ei otteluita tällä jaksolla.' : 'No games in this period.')}</p>;
    }

    return days.map((day) => (
        <section key={day.date} className="sched2-day">
            <h2 className="sched2-day-title">
                <span>{dayLabel(day.date, lang)}</span>
                <span className="sched2-day-count">{day.games.length} {fi ? (day.games.length === 1 ? 'ottelu' : 'ottelua') : (day.games.length === 1 ? 'game' : 'games')}</span>
            </h2>
            <ul className="team-games">
                {day.games.map((g) => (
                    <li key={g.id}>
                        <ScheduleRow game={g} lang={lang} isFav={isFavGame(g)} favTeams={favTeams} onClick={() => onGameClick(g)} />
                    </li>
                ))}
            </ul>
        </section>
    ));
}

function ScheduleRow({ game, lang, isFav, favTeams, onClick }) {
    const fi = lang === 'fi';
    const away = game.awayTeam;
    const home = game.homeTeam;
    const final = isFinal(game.gameState);
    const live = isLive(game.gameState);
    const winner = final ? ((away.score ?? 0) > (home.score ?? 0) ? 'away' : 'home') : null;
    const extra = game.gameOutcome?.lastPeriodType;

    const team = (t, side) => (
        <span className={`sched2-team ${winner && winner !== side ? 'is-loser' : ''} ${favTeams.includes(t.abbrev) ? 'is-fav' : ''}`}>
            <span className="dt-dot" style={{ background: colourOf(t.abbrev) }} aria-hidden="true" />
            {t.abbrev}
        </span>
    );

    let right;
    if (final || live) {
        right = (
            <span className={`sched2-score num ${live ? 'is-live' : ''}`}>
                {live && <span className="gc-live-dot" aria-hidden="true" />}
                {away.score ?? 0}–{home.score ?? 0}
                {final && (extra === 'OT' || extra === 'SO') && <span className="tg-extra">{extra === 'OT' ? (fi ? 'JA' : 'OT') : (fi ? 'VL' : 'SO')}</span>}
            </span>
        );
    } else if (game.gameScheduleState === 'PPD') {
        right = <span className="tg-time">{fi ? 'Siirretty' : 'Postponed'}</span>;
    } else {
        right = (
            <span className="tg-time num">
                {new Date(game.startTimeUTC).toLocaleTimeString(fi ? 'fi-FI' : 'en-GB', { hour: '2-digit', minute: '2-digit' })}
            </span>
        );
    }

    return (
        <button type="button" className={`team-game sched2-row ${isFav ? 'is-fav' : ''}`} onClick={onClick}>
            <span className="sched2-teams">
                {team(away, 'away')}
                <span className="recent-at">@</span>
                {team(home, 'home')}
                {game.gameType === 1 && <span className="dt-tag" title={fi ? 'Harjoitusottelu' : 'Preseason'}>{fi ? 'HO' : 'PRE'}</span>}
            </span>
            {right}
        </button>
    );
}

function TeamsTable({ data, lang, favTeams, onTeamClick }) {
    const fi = lang === 'fi';
    const rows = useMemo(() => (data.teams ?? []).map((t) => ({
        id: t.abbrev,
        team: t.abbrev,
        games: t.gamesCount,
        home: t.homeGames,
        away: t.awayGames,
        b2b: t.backToBacks,
        // Seuraavat vastustajat meta-riville.
        next: data.dates.map((d) => t.schedule[d]).filter(Boolean).slice(0, 4)
            .map((g) => `${g.isHome ? 'vs' : '@'} ${g.opponent}`).join(' · '),
    })), [data]);

    const columns = [
        { key: 'games', label: fi ? 'O' : 'GP', title: fi ? 'Otteluita jaksolla' : 'Games in period', format: int },
        { key: 'home', label: fi ? 'Koti' : 'Home', title: fi ? 'Kotiottelut' : 'Home games', format: int },
        { key: 'away', label: fi ? 'Vier' : 'Road', title: fi ? 'Vierasottelut' : 'Road games', format: int },
        { key: 'b2b', label: 'B2B', title: fi ? 'Peräkkäiset pelipäivät' : 'Back-to-backs', format: int, lowerIsBetter: true },
    ];

    return (
        <DataTable
            rows={rows}
            columns={columns}
            identity={{
                label: fi ? 'Joukkue' : 'Team',
                // Lempinimen tilalla seuraavat vastustajat: niistä näkee heti, mitä tulossa.
                render: (row) => (
                    <span className="dt-person">
                        <span className="dt-dot" style={{ background: colourOf(row.team) }} aria-hidden="true" />
                        <span className="dt-person-text">
                            <span className="dt-name">{row.team}</span>
                            <span className="dt-meta">{row.next || '–'}</span>
                        </span>
                    </span>
                ),
            }}
            defaultSort={{ key: 'games', dir: 'desc' }}
            isHighlighted={(row) => favTeams.includes(row.team)}
            onRowClick={(row) => onTeamClick(row.team)}
            pageSize={40}
            language={lang}
            caption={fi ? 'Ottelumäärät joukkueittain' : 'Games by team'}
        />
    );
}
