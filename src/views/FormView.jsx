import React, { useMemo, useState } from 'react';
import { IconInfoCircle, IconTrendingUp, IconTrendingDown, IconFirstAidKit, IconShieldOff } from '@tabler/icons-react';
import ViewHeader from '../components/shell/ViewHeader';
import DataTable from '../components/ui/DataTable';
import Segmented from '../components/ui/Segmented';
import Chips from '../components/ui/Chips';
import { TeamIdentity } from '../components/table/Identity';
import { useApi } from '../hooks/useApi';
import { usePersistentState } from '../hooks/usePersistentState';
import { useSettings } from '../state/settings';
import { api } from '../utils/api';
import { int, dec, pct, clock, seasonLabel, shortDate } from '../utils/format';
import { positionLabel, isForward } from '../utils/positions';
import { nationPlural } from '../utils/nations';
import { shortenPlayerName } from '../utils/names';
import { teamByAbbrev } from '../utils/teams';
import { teamColors, DEFAULT_TEAM_COLORS } from '../utils/teamColors';
import { routeOf } from '../router/routes';

/**
 * Kunto: kuka pelaa nyt paremmin tai huonommin kuin kauden aikana.
 *
 * Jokaisessa solussa on jakson luku ja sen alla muutos kauden tasoon.
 * Mittarit riippuvat pelipaikasta: hyökkääjiltä katsotaan tehoja ja
 * laukauksia, puolustajilta myös peliaikaa ja kiekonhallintaa, maalivahdeilta
 * torjuntaa. Joukkueista näkyy lisäksi tuuri (PDO) ja poissaolojen vaikutus.
 */

const colourOf = (abbrev) => (teamColors[abbrev] ?? DEFAULT_TEAM_COLORS)[0];

const WINDOWS = [7, 14, 30];

/** Luku ja muutos kauden tasoon. `better` = onko muutos myönteinen. */
function Change({ text, diff, diffText, lowerIsBetter }) {
    const tone = diff == null || Math.abs(diff) < 1e-9 ? '' : (diff > 0) !== Boolean(lowerIsBetter) ? 'is-up' : 'is-down';
    return (
        <span className="fm-cell">
            <span className="fm-value">{text}</span>
            {diffText && <span className={`fm-diff ${tone}`}>{diffText}</span>}
        </span>
    );
}

const signedText = (v, fmt) => {
    if (v == null || !Number.isFinite(v)) return null;
    if (Math.abs(v) < 1e-9) return '±0';
    return `${v > 0 ? '+' : '−'}${fmt(Math.abs(v))}`;
};

/** Sarake, joka näyttää jakson arvon ja muutoksen kauteen. */
function changeColumn(key, label, title, { get, fmt, diffFmt, lowerIsBetter, width } = {}) {
    return {
        key,
        label,
        title,
        width,
        lowerIsBetter,
        value: (row) => get(row.window),
        format: (_v, row) => {
            const w = get(row.window);
            const s = get(row.season);
            const diff = w != null && s != null ? w - s : null;
            return (
                <Change
                    text={w == null ? '–' : fmt(w)}
                    diff={diff}
                    diffText={diff == null ? null : signedText(diff, diffFmt ?? fmt)}
                    lowerIsBetter={lowerIsBetter}
                />
            );
        },
    };
}

function indexColumn(fi, lang) {
    return {
        key: 'formIndex',
        label: 'KI',
        title: fi
            ? 'Kuntoindeksi: jakson muutos kauden tasoon pelipaikan tärkeimmissä mittareissa, suhteutettuna pelaajien väliseen hajontaan. +1 = selvästi kautta parempi, −1 = selvästi heikompi'
            : 'Form index: change versus season in the key metrics for the position, scaled by spread between players',
        value: (row) => row.formIndex,
        format: (v) => (
            <span className={`fm-index ${v > 0.3 ? 'is-up' : v < -0.3 ? 'is-down' : ''}`}>
                {v == null ? '–' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${dec(Math.abs(v), 1, lang)}`}
            </span>
        ),
    };
}

function skaterColumns(group, fi, lang) {
    const d2 = (v) => dec(v, 2, lang);
    const d1 = (v) => dec(v, 1, lang);
    const secs = (v) => `${Math.round(v)} s`;
    const common = {
        ppg: changeColumn('ppg', fi ? 'P/O' : 'P/GP', fi ? 'Pisteet per ottelu jaksolla (alla muutos kauteen)' : 'Points per game in the period', { get: (l) => l.ppg, fmt: d2 }),
        spg: changeColumn('spg', fi ? 'L/O' : 'S/GP', fi ? 'Laukaukset maalia kohti per ottelu' : 'Shots per game', { get: (l) => l.spg, fmt: d1 }),
        pm: changeColumn('pmpg', '+/−', fi ? 'Plusmiinus per ottelu' : 'Plus-minus per game', { get: (l) => l.pmpg, fmt: (v) => (v > 0 ? `+${d2(v)}` : d2(v)), diffFmt: d2 }),
        toi: changeColumn('toi', fi ? 'Aika' : 'TOI', fi ? 'Peliaika per ottelu (muutos sekunteina)' : 'Time on ice per game (change in seconds)', { get: (l) => l.toi, fmt: clock, diffFmt: secs, width: '52px' }),
        cf: changeColumn('cf', 'CF%', fi ? 'Corsi: joukkueen osuus laukaisuyrityksistä pelaajan ollessa jäällä tasakentin' : 'Corsi on-ice share at 5v5', { get: (l) => l.cf, fmt: (v) => pct(v, 1, lang), diffFmt: (v) => pct(v, 1, lang) }),
        phys: changeColumn('physpg', fi ? 'TB/O' : 'HB/GP', fi ? 'Taklaukset ja blokit per ottelu' : 'Hits and blocks per game', { get: (l) => l.physpg, fmt: d1 }),
    };
    return group === 'D'
        ? [indexColumn(fi, lang), common.ppg, common.pm, common.toi, common.cf]
        : [indexColumn(fi, lang), common.ppg, common.spg, common.pm, common.toi];
}

function goalieColumns(fi, lang) {
    return [
        indexColumn(fi, lang),
        changeColumn('svPct', fi ? 'T%' : 'SV%', fi ? 'Torjuntaprosentti' : 'Save percentage', { get: (l) => l.svPct, fmt: (v) => pct(v, 1, lang) }),
        changeColumn('gaa', fi ? 'PÄM' : 'GAA', fi ? 'Päästetyt maalit per ottelu' : 'Goals against average', { get: (l) => l.gaa, fmt: (v) => dec(v, 2, lang), lowerIsBetter: true }),
        { key: 'gp', label: fi ? 'O' : 'GP', title: fi ? 'Ottelut jaksolla' : 'Games in the period', value: (r) => r.window.gp, format: int },
        { key: 'qsPct', label: fi ? 'HO%' : 'QS%', title: fi ? 'Hyvien otteluiden osuus (torjunta-% vähintään liigan keskitaso)' : 'Quality start percentage', value: (r) => r.window.qsPct, format: (v) => pct(v, 0, lang) },
    ];
}

export default function FormView({ onPlayerClick, onTeamClick }) {
    const { language, settings, favPlayers, favTeams } = useSettings();
    const lang = language === 'en' ? 'en' : 'fi';
    const fi = lang === 'fi';
    const route = routeOf('/tilastot/kunto');

    const [tab, setTab] = usePersistentState('pucknower_form_tab', 'players');
    const [days, setDays] = usePersistentState('pucknower_form_days', 14);

    const { data, error, isLoading, reload } = useApi((signal) => api.form(days, { signal }), [days]);

    return (
        <div className="view">
            <ViewHeader
                icon={route.icon}
                title={route.label[lang]}
                subtitle={data
                    ? `${shortDate(data.from, lang)}–${shortDate(data.to, lang)} ${fi ? 'verrattuna kauteen' : 'vs season'} ${seasonLabel(data.season)}`
                    : route.hint[lang]}
            />

            {data?.isPreviousSeason && (
                <p className="notice">
                    <IconInfoCircle size={16} stroke={2} aria-hidden="true" />
                    {fi
                        ? `Kausi on vasta alkanut, joten näytetään kauden ${seasonLabel(data.season)} viimeiset ${data.days} päivää. Poissaolot ovat tämän hetken tilanne.`
                        : `The season has just started, so the last ${data.days} days of ${seasonLabel(data.season)} are shown. Absences are current.`}
                </p>
            )}

            <div className="toolbar">
                <Segmented
                    label={fi ? 'Näkymä' : 'View'}
                    value={tab}
                    onChange={setTab}
                    options={[
                        { value: 'players', label: fi ? 'Pelaajat' : 'Players' },
                        { value: 'teams', label: fi ? 'Joukkueet' : 'Teams' },
                    ]}
                />
                <Chips
                    label={fi ? 'Jakso' : 'Period'}
                    value={days}
                    onChange={setDays}
                    options={WINDOWS.map((d) => ({ value: d, label: fi ? `${d} pv` : `${d} days` }))}
                />
            </div>

            {error && !data ? (
                <div className="panel">
                    <p className="panel-hint">{fi ? 'Kuntotietojen haku epäonnistui.' : 'Could not load form data.'}</p>
                    <button type="button" className="chip" onClick={reload}>{fi ? 'Yritä uudelleen' : 'Try again'}</button>
                </div>
            ) : !data ? (
                <div className="skeleton" style={{ height: 480 }} />
            ) : (
                <>
                    {isLoading && <div className="loading-line" aria-hidden="true" />}
                    {tab === 'players'
                        ? <PlayersTab data={data} lang={lang} settings={settings} favPlayers={favPlayers} onPlayerClick={onPlayerClick} />
                        : <TeamsTab data={data} lang={lang} favTeams={favTeams} onTeamClick={onTeamClick} onPlayerClick={onPlayerClick} />}
                </>
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Pelaajat
// ---------------------------------------------------------------------------

const median = (values) => {
    const list = values.filter((v) => v != null).sort((a, b) => a - b);
    return list.length ? list[Math.floor(list.length / 2)] : 0;
};

function PlayersTab({ data, lang, settings, favPlayers, onPlayerClick }) {
    const fi = lang === 'fi';
    const [group, setGroup] = usePersistentState('pucknower_form_group', 'F');
    const [list, setList] = usePersistentState('pucknower_form_list', 'rising');
    const [filter, setFilter] = useState('all');

    const pool = useMemo(() => {
        if (group === 'G') return data.goalies;
        return data.skaters.filter((p) => (group === 'D' ? p.pos === 'D' : isForward(p.pos)));
    }, [data, group]);

    // Hiipumassa-listalle vain pelaajat, jotka ovat pelanneet kauden aikana hyvin.
    const strongSeason = useMemo(() => {
        const key = group === 'G' ? 'svPct' : 'ppg';
        const cut = median(pool.map((p) => p.season[key]));
        return (p) => (p.season[key] ?? 0) >= cut;
    }, [pool, group]);

    const minGames = data.minGames ?? 4;
    const lists = {
        rising: { label: fi ? 'Nousussa' : 'Rising', test: (p) => p.window.gp >= minGames && p.formIndex > 0.3, sort: { key: 'formIndex', dir: 'desc' } },
        falling: { label: fi ? 'Hiipumassa' : 'Cooling', test: (p) => p.window.gp >= minGames && p.formIndex < -0.3 && strongSeason(p), sort: { key: 'formIndex', dir: 'asc' } },
        hot: { label: fi ? 'Kuumimmat' : 'Hottest', test: (p) => p.window.gp >= minGames, sort: { key: group === 'G' ? 'svPct' : 'ppg', dir: 'desc' } },
        all: { label: fi ? 'Kaikki' : 'All', test: null, sort: { key: 'formIndex', dir: 'desc' } },
    };
    const activeList = lists[list] ?? lists.rising;

    const filters = useMemo(() => {
        const out = [{ value: 'all', label: fi ? 'Kaikki' : 'All', test: null }];
        for (const code of settings.nationalities ?? []) out.push({ value: `nat:${code}`, label: nationPlural(code, lang), test: (p) => p.nat === code });
        if (favPlayers.length) out.push({ value: 'fav', label: fi ? 'Suosikit' : 'Favourites', test: (p) => favPlayers.includes(p.id) });
        return out;
    }, [settings.nationalities, favPlayers, fi, lang]);
    const activeFilter = filters.find((f) => f.value === filter) ?? filters[0];

    const rows = pool.filter((p) => (!activeList.test || activeList.test(p)) && (!activeFilter.test || activeFilter.test(p)));
    const columns = group === 'G' ? goalieColumns(fi, lang) : skaterColumns(group, fi, lang);

    return (
        <>
            <div className="nat-filter">
                <Chips
                    label={fi ? 'Pelipaikka' : 'Position'}
                    value={group}
                    onChange={setGroup}
                    options={[
                        { value: 'F', label: fi ? 'Hyökkääjät' : 'Forwards' },
                        { value: 'D', label: fi ? 'Puolustajat' : 'Defence' },
                        { value: 'G', label: fi ? 'Maalivahdit' : 'Goalies' },
                    ]}
                />
                <Chips
                    label={fi ? 'Lista' : 'List'}
                    value={list}
                    onChange={setList}
                    options={Object.entries(lists).map(([value, l]) => ({ value, label: l.label }))}
                />
                {filters.length > 1 && (
                    <Chips label={fi ? 'Rajaus' : 'Filter'} value={activeFilter.value} onChange={setFilter} options={filters} />
                )}
            </div>

            <DataTable
                key={`${group}:${list}:${activeFilter.value}:${data.days}`}
                rows={rows}
                columns={columns}
                identity={{
                    label: fi ? 'Pelaaja' : 'Player',
                    render: (row) => <FormIdentity row={row} lang={lang} />,
                }}
                defaultSort={activeList.sort}
                isHighlighted={(row) => favPlayers.includes(row.id)}
                onRowClick={(row) => onPlayerClick(row.id)}
                pageSize={40}
                language={lang}
                caption={fi ? 'Pelaajien kunto' : 'Player form'}
            />

            <p className="source-note">
                {fi
                    ? `Solun alarivi on muutos kauden tasoon. Joukkueen nuoli kertoo joukkueen kunnon samalla jaksolla. "Tuuri": maaleja tulee selvästi kautta tiheämmin ilman että laukauksia tulee enempää, joten tahti todennäköisesti hidastuu. "Tulossa": laukauksia on enemmän, mutta maalit puuttuvat. Listoilla vähintään ${minGames} ottelua jaksolla.`
                    : `The second line is the change versus the season. The team arrow shows the team's form in the same period. "Lucky": scoring well above season without more shots. "Due": more shots but no goals. Lists require ${minGames} games.`}
            </p>
        </>
    );
}

function FormIdentity({ row, lang }) {
    const fi = lang === 'fi';
    const teamUp = row.teamFormIndex > 0.3;
    const teamDown = row.teamFormIndex < -0.3;
    return (
        <span className="dt-person">
            <span className="dt-dot" style={{ background: colourOf(row.team) }} aria-hidden="true" />
            <span className="dt-person-text">
                <span className="dt-name" title={row.name}>
                    {shortenPlayerName(row.name)}
                    {row.signal === 'luck' && <span className="dt-tag fm-tag-luck" title={fi ? 'Maaleja kautta tiheämmin ilman lisää laukauksia' : 'Scoring above season without more shots'}>{fi ? 'tuuri' : 'lucky'}</span>}
                    {row.signal === 'due' && <span className="dt-tag fm-tag-due" title={fi ? 'Laukauksia enemmän, maalit puuttuvat' : 'More shots, no goals yet'}>{fi ? 'tulossa' : 'due'}</span>}
                </span>
                <span className="dt-meta fm-meta">
                    {row.team} · {positionLabel(row.pos, lang)} · {row.window.gp} {fi ? 'O' : 'GP'}
                    {(teamUp || teamDown) && (
                        <span className={`fm-team ${teamUp ? 'is-up' : 'is-down'}`} title={fi ? 'Joukkueen kunto jaksolla' : 'Team form in the period'}>
                            {teamUp ? <IconTrendingUp size={12} stroke={2.2} /> : <IconTrendingDown size={12} stroke={2.2} />}
                        </span>
                    )}
                </span>
            </span>
        </span>
    );
}

// ---------------------------------------------------------------------------
// Joukkueet
// ---------------------------------------------------------------------------

function TeamsTab({ data, lang, favTeams, onTeamClick, onPlayerClick }) {
    const fi = lang === 'fi';
    const d2 = (v) => dec(v, 2, lang);

    const columns = [
        indexColumn(fi, lang),
        changeColumn('ptsPct', fi ? 'P%' : 'P%', fi ? 'Pisteprosentti jaksolla (alla muutos kauteen)' : 'Points percentage in the period', { get: (l) => l.ptsPct, fmt: (v) => pct(v, 0, lang) }),
        changeColumn('gdpg', fi ? 'ME/O' : 'GD/GP', fi ? 'Maaliero per ottelu' : 'Goal differential per game', { get: (l) => l.gdpg, fmt: (v) => (v > 0 ? `+${d2(v)}` : d2(v)), diffFmt: d2, width: '50px' }),
        changeColumn('cf', 'CF%', fi ? 'Corsi: osuus laukaisuyrityksistä tasakentin. Yli 50 % = hallitsee kiekkoa' : 'Corsi share at 5v5', { get: (l) => l.cf, fmt: (v) => pct(v, 1, lang) }),
        {
            key: 'pdo',
            label: 'PDO',
            title: fi
                ? 'Tuurimittari: laukaisu-% + torjunta-% tasakentin. Noin 100 on keskitaso; yli 102 kertoo yleensä onnesta ja alle 98 epäonnesta, jotka molemmat tasaantuvat'
                : 'Luck gauge: 5v5 shooting % + save %. About 100 is average',
            value: (r) => r.window.pdo,
            format: (v) => (
                <span className={`fm-pdo ${v > 1.02 ? 'is-lucky' : v < 0.98 ? 'is-unlucky' : ''}`}>{v == null ? '–' : dec(v * 100, 1, lang)}</span>
            ),
        },
    ];

    const injured = [...data.teams]
        .filter((t) => t.injuries.significant.length > 0)
        .sort((a, b) => (b.injuries.goalieOut - a.injuries.goalieOut) || (b.injuries.impact - a.injuries.impact));

    return (
        <>
            <DataTable
                key={`teams:${data.days}`}
                rows={data.teams}
                columns={columns}
                identity={{
                    label: fi ? 'Joukkue' : 'Team',
                    render: (row) => (
                        <span className="dt-person">
                            <TeamIdentity row={row} />
                            {row.injuries.significant.length > 0 && (
                                <span className="fm-injury" title={fi ? 'Merkittäviä poissaoloja' : 'Significant absences'}>
                                    <IconFirstAidKit size={12} stroke={2} aria-hidden="true" />{row.injuries.significant.length}
                                </span>
                            )}
                        </span>
                    ),
                }}
                defaultSort={{ key: 'formIndex', dir: 'desc' }}
                isHighlighted={(row) => favTeams.includes(row.team)}
                onRowClick={(row) => onTeamClick(row.team)}
                pageSize={32}
                language={lang}
                caption={fi ? 'Joukkueiden kunto' : 'Team form'}
            />

            <section className="gm2-section fm-absences">
                <h2 className="sched2-day-title">
                    <span>{fi ? 'Poissaolojen vaikutus' : 'Impact of absences'}</span>
                    <span className="sched2-day-count">{fi ? 'merkittävät pelaajat' : 'key players'}</span>
                </h2>
                {injured.length === 0 ? (
                    <p className="panel-hint">{fi ? 'Ei merkittäviä poissaoloja.' : 'No significant absences.'}</p>
                ) : (
                    <div className="fm-absence-list">
                        {injured.map((t) => (
                            <article key={t.team} className="fm-absence" style={{ '--team': colourOf(t.team) }}>
                                <button type="button" className="fm-absence-head" onClick={() => onTeamClick(t.team)}>
                                    <span className="dt-dot" style={{ background: colourOf(t.team) }} aria-hidden="true" />
                                    <span className="fm-absence-team">{teamByAbbrev(t.team)?.name ?? t.team}</span>
                                    {t.injuries.goalieOut && (
                                        <span className="dt-tag fm-tag-goalie"><IconShieldOff size={11} stroke={2} aria-hidden="true" /> {fi ? 'ykkösvahti' : 'starter'}</span>
                                    )}
                                    <span className="fm-absence-share">
                                        {pct(t.injuries.impact, 0, lang)} %
                                        <span>{fi ? 'pisteistä' : 'of points'}</span>
                                    </span>
                                </button>
                                <ul className="fm-absence-players">
                                    {t.injuries.significant.map((p) => (
                                        <li key={p.name}>
                                            <button type="button" className="link-button" disabled={!p.id} onClick={() => p.id && onPlayerClick(p.id)}>
                                                {p.name}
                                            </button>
                                            <span className="fm-absence-meta">
                                                {p.startShare > 0
                                                    ? `${fi ? 'aloitukset' : 'starts'} ${pct(p.startShare, 0, lang)} %`
                                                    : `${pct(p.pointsShare, 0, lang)} % ${fi ? 'pisteistä' : 'of points'} · ${pct(p.toiShare, 0, lang)} % ${fi ? 'peliajasta' : 'of TOI'}`}
                                                {p.returnDate && ` · ${fi ? 'arvio' : 'est.'} ${shortDate(p.returnDate, lang)}`}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </article>
                        ))}
                    </div>
                )}
                <p className="source-note">
                    {fi
                        ? 'Merkittävä poissaolo: yli 7 % joukkueen pisteistä tai yli 6 % peliajasta, tai ykkösmaalivahti. Prosentti on kaikkien sivussa olevien osuus joukkueen kauden pisteistä. Lähde: ESPN.'
                        : 'Significant: over 7% of team points or 6% of ice time, or the starting goalie. Source: ESPN.'}
                </p>
            </section>
        </>
    );
}
