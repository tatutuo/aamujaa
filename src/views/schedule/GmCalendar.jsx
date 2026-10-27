import React, { useEffect, useMemo, useRef, useState } from 'react';
import { IconPin, IconPinFilled } from '@tabler/icons-react';
import Chips from '../../components/ui/Chips';
import { useApi } from '../../hooks/useApi';
import { usePersistentState } from '../../hooks/usePersistentState';
import { api } from '../../utils/api';
import { chartColor } from '../../utils/chartColors';
import { GM_PERIODS, currentPeriod } from '../../utils/hockeyGm';

/**
 * GM-kalenteri: pelipäiväruudukko Hockey GM -vaihtojen suunnitteluun.
 *
 * Rivi per joukkue, sarake per päivä. Solussa vastustaja: vihreä koti,
 * punainen vieras. Valitaan Hockey GM -jakso, ja "Loput jaksosta" näyttää
 * vain tästä päivästä eteenpäin, koska vaihtoja miettiessä ratkaisee se,
 * montako ottelua joukkueella on vielä jäljellä.
 *
 * Mobiilissa joukkuesarake ja otsikkorivi pysyvät paikallaan, ja ruudukko
 * vierii sivuttain valmiiksi tämän päivän kohdalle.
 */

const WEEKDAYS = {
    fi: ['SU', 'MA', 'TI', 'KE', 'TO', 'PE', 'LA'],
    en: ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'],
};

const datesBetween = (start, end) => {
    const out = [];
    const d = new Date(`${start}T12:00:00Z`);
    const last = new Date(`${end}T12:00:00Z`);
    while (d <= last) {
        out.push(d.toISOString().slice(0, 10));
        d.setUTCDate(d.getUTCDate() + 1);
    }
    return out;
};

const isMonday = (iso) => new Date(`${iso}T12:00:00Z`).getUTCDay() === 1;

/**
 * Sarakeleveydet kiinteinä: otsikko ja runko ovat eri taulukoita, joten
 * niiden sarakkeiden on oltava täsmälleen samanlevyiset.
 */
function Cols({ count }) {
    return (
        <colgroup>
            <col className="gmc-col-team" />
            {Array.from({ length: count }, (_, i) => <col key={i} className="gmc-col-day" />)}
        </colgroup>
    );
}

/**
 * NHL:n "tänään" (New Yorkin aika). Etusivun pelipäivä näyttää aamulla vielä
 * yön kierrosta, mutta jäljellä oleviin otteluihin ei saa laskea jo pelattuja.
 */
const nhlToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());

export default function GmCalendar({ lang, favTeams, fantasyTeam, onTeamClick }) {
    const fi = lang === 'fi';
    const today = nhlToday();
    const [periodId, setPeriodId] = useState(() => currentPeriod(today).id);
    const [restOnly, setRestOnly] = useState(true);
    const [filter, setFilter] = useState('all');
    const [pinned, setPinned] = usePersistentState('puckoodi_gm_pinned', []);

    const period = GM_PERIODS.find((p) => p.id === periodId) ?? GM_PERIODS[0];
    const periodStarted = today >= period.start;
    const periodOver = today > period.end;
    // "Loput jaksosta" vain käynnissä olevalle jaksolle.
    const fromToday = restOnly && periodStarted && !periodOver;
    const start = fromToday ? today : period.start;

    const { data, error, reload } = useApi(
        (signal) => api.schedule({ startDate: start, endDate: period.end }, { signal }),
        [start, period.end],
    );

    // Fantasy-pelaajien joukkueet (pelaajakortin tiedoista, välimuistissa palvelimella).
    const fantasyIds = (fantasyTeam ?? []).map((p) => p.id);
    const { data: fantasyPlayers } = useApi(
        (signal) => (fantasyIds.length ? api.players(fantasyIds, { signal }) : Promise.resolve([])),
        [fantasyIds.join(',')],
    );
    const fantasyTeams = useMemo(
        () => [...new Set((fantasyPlayers ?? []).map((p) => p.currentTeamAbbrev).filter(Boolean))],
        [fantasyPlayers],
    );

    const dates = useMemo(() => datesBetween(start, period.end), [start, period.end]);

    const table = useMemo(() => {
        if (!data) return null;
        const gamesByDate = new Map();
        const teams = new Map();
        const team = (abbrev) => {
            if (!teams.has(abbrev)) teams.set(abbrev, { abbrev, days: {}, games: 0, left: 0, home: 0, away: 0 });
            return teams.get(abbrev);
        };
        for (const day of data.days ?? []) {
            // Vain runkosarja ja pudotuspelit: harjoitusotteluista ei saa GM-pisteitä.
            const games = day.games.filter((g) => g.gameType !== 1);
            gamesByDate.set(day.date, games.length);
            for (const g of games) {
                team(g.awayTeam.abbrev).days[day.date] = { opp: g.homeTeam.abbrev, home: false };
                team(g.homeTeam.abbrev).days[day.date] = { opp: g.awayTeam.abbrev, home: true };
            }
        }
        for (const t of teams.values()) {
            dates.forEach((d) => {
                const g = t.days[d];
                if (!g) return;
                t.games += 1;
                if (d >= today) t.left += 1;
                if (g.home) t.home += 1; else t.away += 1;
            });
        }
        return { teams: [...teams.values()], gamesByDate };
    }, [data, dates, today]);

    const rows = useMemo(() => {
        if (!table) return [];
        const show = {
            all: () => true,
            fav: (t) => favTeams.includes(t.abbrev),
            fantasy: (t) => fantasyTeams.includes(t.abbrev),
            pinned: (t) => pinned.includes(t.abbrev),
        }[filter] ?? (() => true);
        return table.teams
            .filter(show)
            .sort((a, b) => b.left - a.left || b.games - a.games || a.abbrev.localeCompare(b.abbrev));
    }, [table, filter, favTeams, fantasyTeams, pinned]);

    /*
     * Vieritys. Runko vierii vain sivuttain; pystysuunnassa vierii sivu itse,
     * jolloin puhelin lukitsee pyyhkäisyn yhteen suuntaan eikä ruudukko
     * heilu vinottain. Päivämäärärivi on oma elementtinsä, joka pysyy sivun
     * yläreunassa ja seuraa rungon vaakavieritystä.
     */
    const scroller = useRef(null);
    const header = useRef(null);
    const syncHeader = () => {
        if (header.current && scroller.current) header.current.scrollLeft = scroller.current.scrollLeft;
    };

    // Avautuu tämän päivän kohdalta.
    useEffect(() => {
        const el = scroller.current;
        if (!el) return;
        const index = dates.indexOf(today);
        const dayWidth = el.querySelector('td.gmc-cell')?.offsetWidth ?? 0;
        el.scrollLeft = index > 0 ? index * dayWidth : 0;
        if (header.current) header.current.scrollLeft = el.scrollLeft;
    }, [table, filter, dates, today]);

    const togglePin = (abbrev) => setPinned((list) => (list.includes(abbrev) ? list.filter((a) => a !== abbrev) : [...list, abbrev]));

    const filterOptions = [
        { value: 'all', label: fi ? 'Kaikki' : 'All' },
        ...(favTeams.length ? [{ value: 'fav', label: fi ? 'Suosikit' : 'Favourites' }] : []),
        ...(fantasyTeams.length ? [{ value: 'fantasy', label: 'Fantasy' }] : []),
        { value: 'pinned', label: fi ? 'Valitut' : 'Pinned', count: pinned.length },
    ];

    const fmtDate = (iso) => `${Number(iso.slice(8, 10))}.${Number(iso.slice(5, 7))}.`;
    const weekday = (iso) => WEEKDAYS[lang === 'en' ? 'en' : 'fi'][new Date(`${iso}T12:00:00Z`).getUTCDay()];

    return (
        <div className="gmc">
            <div className="toolbar">
                <Chips
                    label={fi ? 'Jakso' : 'Period'}
                    value={periodId}
                    onChange={setPeriodId}
                    options={GM_PERIODS.map((p) => ({ value: p.id, label: fi ? `${p.id}. jakso` : `Period ${p.id}` }))}
                />
                <div className="gmc-sub">
                    <span className="gmc-range num">{fmtDate(period.start)}–{fmtDate(period.end)}</span>
                    {periodStarted && !periodOver && (
                        <Chips
                            label={fi ? 'Aikaväli' : 'Range'}
                            value={restOnly ? 'rest' : 'whole'}
                            onChange={(v) => setRestOnly(v === 'rest')}
                            options={[
                                { value: 'rest', label: fi ? 'Loput jaksosta' : 'Rest of period' },
                                { value: 'whole', label: fi ? 'Koko jakso' : 'Whole period' },
                            ]}
                        />
                    )}
                </div>
                <Chips label={fi ? 'Rajaus' : 'Filter'} value={filter} onChange={setFilter} options={filterOptions} />
            </div>

            {error && !data ? (
                <p className="notice">
                    {fi ? 'Otteluohjelman haku epäonnistui.' : 'Could not load the schedule.'}{' '}
                    <button type="button" className="link-button" onClick={reload}>{fi ? 'Yritä uudelleen' : 'Try again'}</button>
                </p>
            ) : !table ? (
                <div className="skeleton" style={{ height: 520 }} />
            ) : rows.length === 0 ? (
                <p className="panel-hint">
                    {filter === 'pinned'
                        ? (fi ? 'Ei valittuja joukkueita. Napauta joukkueen nastaa kalenterissa valitaksesi sen vertailuun.' : 'No pinned teams. Tap a team’s pin to add it to the comparison.')
                        : (fi ? 'Ei joukkueita tällä rajauksella.' : 'No teams with this filter.')}
                </p>
            ) : (
                <div className="gmc-frame" style={{ '--gmc-days': dates.length }}>
                    {/* Päivämäärärivi: sivun yläreunassa pysyvä, vierii rungon mukana. */}
                    <div className="gmc-header" ref={header} aria-hidden="true">
                        <table className="gmc-table">
                            <Cols count={dates.length} />
                            <thead>
                                <tr>
                                    <th className="gmc-team">
                                        <span className="gmc-head-label">{fi ? 'Joukkue' : 'Team'}</span>
                                        <span className="gmc-head-sub">{fromToday ? (fi ? 'jäljellä' : 'left') : (fi ? 'ottelut' : 'games')}</span>
                                    </th>
                                    {dates.map((d) => (
                                        <th key={d} className={`gmc-day ${d === today ? 'is-today' : ''} ${isMonday(d) ? 'is-monday' : ''}`}>
                                            <span className="gmc-wd">{weekday(d)}</span>
                                            <span className="gmc-date num">{fmtDate(d)}</span>
                                            <span className="gmc-count num">{table.gamesByDate.get(d) || '–'}</span>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                        </table>
                    </div>

                    <div className="gmc-scroll" ref={scroller} onScroll={syncHeader}>
                        <table className="gmc-table">
                            <Cols count={dates.length} />
                            <thead className="gmc-sr-head">
                                <tr>
                                    <th scope="col">{fi ? 'Joukkue' : 'Team'}</th>
                                    {dates.map((d) => <th key={d} scope="col">{fmtDate(d)}</th>)}
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((t) => {
                                    const isPinned = pinned.includes(t.abbrev);
                                    return (
                                        <tr key={t.abbrev} className={isPinned ? 'is-pinned' : ''}>
                                            <th className="gmc-team" scope="row">
                                                <span className="gmc-team-line">
                                                    <button type="button" className="gmc-team-name" onClick={() => onTeamClick(t.abbrev)}>
                                                        <span className="dt-dot" style={{ background: chartColor(t.abbrev) }} aria-hidden="true" />
                                                        {t.abbrev}
                                                    </button>
                                                    <strong className="gmc-total num">{fromToday ? t.left : t.games}</strong>
                                                    <button
                                                        type="button"
                                                        className={`gmc-pin ${isPinned ? 'is-on' : ''}`}
                                                        onClick={() => togglePin(t.abbrev)}
                                                        aria-pressed={isPinned}
                                                        aria-label={isPinned ? (fi ? 'Poista valituista' : 'Unpin') : (fi ? 'Lisää valittuihin' : 'Pin')}
                                                    >
                                                        {isPinned ? <IconPinFilled size={13} /> : <IconPin size={13} stroke={2} />}
                                                    </button>
                                                </span>
                                                <span className="gmc-meta num">
                                                    {t.home}{fi ? 'K' : 'H'} {t.away}{fi ? 'V' : 'A'}
                                                </span>
                                            </th>
                                            {dates.map((d) => {
                                                const g = t.days[d];
                                                const cls = `gmc-cell ${g ? (g.home ? 'is-home' : 'is-away') : 'is-off'} ${d === today ? 'is-today' : ''} ${d < today ? 'is-past' : ''} ${isMonday(d) ? 'is-monday' : ''}`;
                                                return (
                                                    <td key={d} className={cls} title={g ? `${g.home ? (fi ? 'Koti' : 'Home') : (fi ? 'Vieras' : 'Away')}: ${g.opp}` : undefined}>
                                                        {g ? g.opp : '–'}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <ul className="gmc-legend">
                <li><span className="gmc-swatch is-home" aria-hidden="true" />{fi ? 'Kotiottelu' : 'Home'}</li>
                <li><span className="gmc-swatch is-away" aria-hidden="true" />{fi ? 'Vierasottelu' : 'Away'}</li>
                <li><IconPin size={13} stroke={2} aria-hidden="true" />{fi ? 'valitse vertailuun' : 'pin to compare'}</li>
            </ul>
            <p className="source-note">
                {fi
                    ? 'Joukkueet on järjestetty jäljellä olevien otteluiden mukaan. K/V = koti- ja vierasottelut. Päivämäärän alla liigan ottelumäärä. Harjoitusotteluita ei lasketa.'
                    : 'Teams are sorted by games left. H/A = home/away games. The number under each date is the league’s game count. Preseason games are not counted.'}
            </p>
        </div>
    );
}
