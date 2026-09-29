import React, { useMemo, useState } from 'react';
import ViewHeader from '../components/shell/ViewHeader';
import DataTable from '../components/ui/DataTable';
import Segmented from '../components/ui/Segmented';
import Chips from '../components/ui/Chips';
import { useApi } from '../hooks/useApi';
import { usePersistentState } from '../hooks/usePersistentState';
import { useSettings } from '../state/settings';
import { api } from '../utils/api';
import { int } from '../utils/format';
import { nationPlural, countryName, normaliseNation } from '../utils/nations';
import { teamColors, DEFAULT_TEAM_COLORS } from '../utils/teamColors';
import { routeOf } from '../router/routes';
import { positionLabel } from '../utils/positions';

/** Draftin pelipaikat (LW, RW) NHL:n koodeiksi. */
const posOf = (code, lang) => positionLabel({ LW: 'L', RW: 'R' }[code] ?? code, lang);

/**
 * Draft ja lupaukset: varaustilaisuuden valinnat ja NHL Central Scoutingin
 * rankingit. Seuratun maan pelaajat saa rajattua yhdellä napautuksella.
 */

const colourOf = (abbrev) => (teamColors[abbrev] ?? DEFAULT_TEAM_COLORS)[0];

/** Amatöörijoukkueet tulevat SUURAAKKOSIN ("PENN STATE"); muutetaan luettavaksi. */
const tidy = (text) => (text && text === text.toUpperCase()
    ? text.toLowerCase().replace(/(^|[\s(/-])\p{L}/gu, (m) => m.toUpperCase())
    : text);

/** Draftin maakoodit ovat samoja ISO-koodeja kuin muualla (FIN, CHE, DEU …). */
const natOf = (code) => normaliseNation(code);

const RANKING_CATEGORIES = [
    { value: 1, label: { fi: 'P-Am. kenttä', en: 'NA skaters' } },
    { value: 2, label: { fi: 'Eur. kenttä', en: 'Intl skaters' } },
    { value: 3, label: { fi: 'P-Am. MV', en: 'NA goalies' } },
    { value: 4, label: { fi: 'Eur. MV', en: 'Intl goalies' } },
];

export default function DraftView() {
    const { language } = useSettings();
    const lang = language === 'en' ? 'en' : 'fi';
    const fi = lang === 'fi';
    const route = routeOf('/lisaa/draft');
    const [tab, setTab] = usePersistentState('pucknower_draft_tab', 'picks');

    return (
        <div className="view">
            <ViewHeader icon={route.icon} title={route.label[lang]} subtitle={route.hint[lang]} />
            <div className="toolbar">
                <Segmented
                    size="sm"
                    label={fi ? 'Näkymä' : 'View'}
                    value={tab}
                    onChange={setTab}
                    options={[
                        { value: 'picks', label: fi ? 'Varaukset' : 'Picks' },
                        { value: 'rankings', label: fi ? 'Ranking' : 'Rankings' },
                    ]}
                />
            </div>
            {tab === 'picks' ? <PicksTab lang={lang} /> : <RankingsTab lang={lang} />}
        </div>
    );
}

function useNationFilter(rows, lang) {
    const { settings, favTeams } = useSettings();
    const fi = lang === 'fi';
    const [filter, setFilter] = useState('all');

    const options = useMemo(() => {
        const list = [{ value: 'all', label: fi ? 'Kaikki' : 'All', test: null }];
        for (const code of settings.nationalities ?? []) {
            list.push({ value: `nat:${code}`, label: nationPlural(code, lang), test: (r) => natOf(r.nat) === code });
        }
        if (favTeams.length) list.push({ value: 'fav', label: fi ? 'Suosikkijoukkueet' : 'Favourite teams', test: (r) => favTeams.includes(r.team) });
        return list.map((o) => ({ ...o, count: o.test ? rows.filter(o.test).length : rows.length }));
    }, [rows, settings.nationalities, favTeams, fi, lang]);

    const active = options.find((o) => o.value === filter) ?? options[0];
    const filtered = active.test ? rows.filter(active.test) : rows;
    return { options, active, setFilter, filtered };
}

function PicksTab({ lang }) {
    const fi = lang === 'fi';
    const [year, setYear] = useState(null);
    const [round, setRound] = useState('all');
    const { data, error } = useApi((signal) => api.draftPicks(year ?? undefined, { signal }), [year]);

    const picks = useMemo(() => data?.picks ?? [], [data]);
    const inRound = useMemo(() => (round === 'all' ? picks : picks.filter((p) => p.round === round)), [picks, round]);
    const { options, active, setFilter, filtered } = useNationFilter(inRound, lang);
    const rounds = [...new Set(picks.map((p) => p.round))];

    if (error && !data) return <p className="panel-hint">{fi ? 'Varausten haku epäonnistui.' : 'Could not load picks.'}</p>;
    if (!data) return <div className="skeleton" style={{ height: 480 }} />;

    const years = [...(data.years ?? [])].sort((a, b) => b - a);

    return (
        <>
            <div className="nat-filter">
                <div className="season-picker">
                    <select className="select" value={year ?? data.year} onChange={(e) => { setYear(Number(e.target.value)); setRound('all'); }} aria-label={fi ? 'Vuosi' : 'Year'}>
                        {years.map((y) => <option key={y} value={y}>{fi ? `Draft ${y}` : `${y} draft`}</option>)}
                    </select>
                </div>
                <Chips
                    label={fi ? 'Kierros' : 'Round'}
                    value={round}
                    onChange={setRound}
                    options={[{ value: 'all', label: fi ? 'Kaikki kierrokset' : 'All rounds' }, ...rounds.map((r) => ({ value: r, label: `${r}.` }))]}
                />
                <Chips label={fi ? 'Rajaus' : 'Filter'} value={active.value} onChange={setFilter} options={options} />
            </div>
            <DataTable
                key={`${data.year}:${round}:${active.value}`}
                rows={filtered}
                columns={[
                    { key: 'overall', label: '#', title: fi ? 'Varausnumero' : 'Overall pick', format: int, lowerIsBetter: true },
                    { key: 'height', label: 'cm', title: fi ? 'Pituus' : 'Height', format: int },
                    { key: 'weight', label: 'kg', title: fi ? 'Paino' : 'Weight', format: int },
                ]}
                identity={{
                    label: fi ? 'Pelaaja' : 'Player',
                    render: (row) => (
                        <span className="dt-person">
                            <span className="dt-dot" style={{ background: colourOf(row.team) }} aria-hidden="true" />
                            <span className="dt-person-text">
                                <span className="dt-name">{row.name}</span>
                                <span className="dt-meta">
                                    {[row.team, posOf(row.pos, lang), countryName(natOf(row.nat), lang), tidy(row.club)].filter(Boolean).join(' · ')}
                                </span>
                            </span>
                        </span>
                    ),
                }}
                defaultSort={{ key: 'overall', dir: 'asc' }}
                showRank={false}
                pageSize={64}
                language={lang}
                caption={fi ? 'Varaukset' : 'Draft picks'}
            />
        </>
    );
}

function RankingsTab({ lang }) {
    const fi = lang === 'fi';
    const [category, setCategory] = usePersistentState('pucknower_draft_category', 2);
    const { data, error } = useApi((signal) => api.draftRankings(undefined, category, { signal }), [category]);
    const rows = useMemo(() => data?.rankings ?? [], [data]);
    const { options, active, setFilter, filtered } = useNationFilter(rows, lang);

    return (
        <>
            <div className="nat-filter">
                <Chips
                    label={fi ? 'Luokka' : 'Category'}
                    value={category}
                    onChange={setCategory}
                    options={RANKING_CATEGORIES.map((c) => ({ value: c.value, label: c.label[lang] }))}
                />
                {data && <Chips label={fi ? 'Rajaus' : 'Filter'} value={active.value} onChange={setFilter} options={options} />}
            </div>

            {error && !data ? (
                <p className="panel-hint">{fi ? 'Rankingin haku epäonnistui.' : 'Could not load rankings.'}</p>
            ) : !data ? (
                <div className="skeleton" style={{ height: 480 }} />
            ) : rows.length === 0 ? (
                <p className="panel-hint">{fi ? 'Rankingia ei ole vielä julkaistu.' : 'Rankings not published yet.'}</p>
            ) : (
                <>
                    <p className="source-note">
                        {fi ? `NHL Central Scouting, draft ${data.year}. Lopullinen ranking ja väliranking (VR).` : `NHL Central Scouting, ${data.year} draft. Final and midterm (MT) rank.`}
                    </p>
                    <DataTable
                        key={`${category}:${active.value}`}
                        rows={filtered}
                        columns={[
                            { key: 'rank', label: '#', title: fi ? 'Lopullinen ranking' : 'Final rank', format: int, lowerIsBetter: true },
                            { key: 'midterm', label: fi ? 'VR' : 'MT', title: fi ? 'Väliranking' : 'Midterm rank', format: int, lowerIsBetter: true },
                            { key: 'height', label: 'cm', title: fi ? 'Pituus' : 'Height', format: int },
                            { key: 'weight', label: 'kg', title: fi ? 'Paino' : 'Weight', format: int },
                        ]}
                        identity={{
                            label: fi ? 'Pelaaja' : 'Player',
                            render: (row) => (
                                <span className="dt-person-text">
                                    <span className="dt-name">{row.name}</span>
                                    <span className="dt-meta">
                                        {[posOf(row.pos, lang), countryName(natOf(row.nat), lang), tidy(row.club)].filter(Boolean).join(' · ')}
                                    </span>
                                </span>
                            ),
                        }}
                        defaultSort={{ key: 'rank', dir: 'asc' }}
                        showRank={false}
                        pageSize={60}
                        language={lang}
                        caption={fi ? 'Draft-ranking' : 'Draft rankings'}
                    />
                </>
            )}
        </>
    );
}
