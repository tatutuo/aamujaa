import React, { useMemo, useState } from 'react';
import { IconInfoCircle, IconTrophy, IconChevronRight } from '@tabler/icons-react';
import ViewHeader from '../components/shell/ViewHeader';
import DataTable from '../components/ui/DataTable';
import Segmented from '../components/ui/Segmented';
import Chips from '../components/ui/Chips';
import StatTiles from '../components/ui/StatTiles';
import { PlayerIdentity } from '../components/table/Identity';
import { useApi } from '../hooks/useApi';
import { usePersistentState } from '../hooks/usePersistentState';
import { useSettings } from '../state/settings';
import { api } from '../utils/api';
import { int, dec, pct, signed, seasonLabel } from '../utils/format';
import { nationPlural, countryName } from '../utils/nations';
import { positionLabel } from '../utils/positions';
import { routeOf } from '../router/routes';

/**
 * Kansalliset: seuratun maan pelaajat kuluvalla kaudella, kaikkien aikojen
 * uratilastot ja NHL-palkinnot.
 *
 * Uratilastot lasketaan palvelimella NHL:n koostekyselyllä, joten mukana on
 * jokainen maan NHL:ssä pelannut pelaaja — Suomesta yli 270.
 */

const SKATER_COLUMNS = (fi, lang) => [
    { key: 'gp', label: fi ? 'O' : 'GP', title: fi ? 'Ottelut' : 'Games', format: int },
    { key: 'goals', label: fi ? 'M' : 'G', title: fi ? 'Maalit' : 'Goals', format: int },
    { key: 'assists', label: fi ? 'S' : 'A', title: fi ? 'Syötöt' : 'Assists', format: int },
    { key: 'points', label: 'P', title: fi ? 'Pisteet' : 'Points', format: int },
    { key: 'pointsPerGame', label: fi ? 'P/O' : 'P/GP', title: fi ? 'Pisteet per ottelu' : 'Points per game', format: (v) => dec(v, 2, lang), rate: true },
];

const SEASON_SKATER_COLUMNS = (fi) => [
    { key: 'gp', label: fi ? 'O' : 'GP', title: fi ? 'Ottelut' : 'Games', format: int },
    { key: 'goals', label: fi ? 'M' : 'G', title: fi ? 'Maalit' : 'Goals', format: int },
    { key: 'assists', label: fi ? 'S' : 'A', title: fi ? 'Syötöt' : 'Assists', format: int },
    { key: 'points', label: 'P', title: fi ? 'Pisteet' : 'Points', format: int },
    { key: 'plusMinus', label: '+/−', title: fi ? 'Plusmiinus' : 'Plus-minus', format: signed },
];

const GOALIE_COLUMNS = (fi, lang) => [
    { key: 'gp', label: fi ? 'O' : 'GP', title: fi ? 'Ottelut' : 'Games', format: int },
    { key: 'wins', label: fi ? 'V' : 'W', title: fi ? 'Voitot' : 'Wins', format: int },
    { key: 'savePct', label: fi ? 'T%' : 'SV%', title: fi ? 'Torjuntaprosentti' : 'Save percentage', format: (v) => pct(v, 1, lang), rate: true },
    { key: 'gaa', label: fi ? 'PÄM' : 'GAA', title: fi ? 'Päästetyt maalit per ottelu' : 'Goals against average', format: (v) => dec(v, 2, lang), rate: true, lowerIsBetter: true },
    { key: 'shutouts', label: fi ? 'NP' : 'SO', title: fi ? 'Nollapelit' : 'Shutouts', format: int },
];

export default function NationsView({ onPlayerClick }) {
    const { language, settings, favPlayers } = useSettings();
    const lang = language === 'en' ? 'en' : 'fi';
    const fi = lang === 'fi';
    const route = routeOf('/tilastot/kansalliset');

    const nations = settings.nationalities?.length ? settings.nationalities : ['FIN'];
    const [nationChoice, setNation] = usePersistentState('pucknower_nation', nations[0]);
    const nation = nations.includes(nationChoice) ? nationChoice : nations[0];
    const [tab, setTab] = usePersistentState('pucknower_nation_tab', 'season');

    return (
        <div className="view">
            <ViewHeader icon={route.icon} title={nationPlural(nation, lang)} subtitle={fi ? `${countryName(nation, lang)} NHL:ssä` : `${countryName(nation, lang)} in the NHL`} />

            <div className="toolbar">
                <Segmented
                    size="sm"
                    label={fi ? 'Näkymä' : 'View'}
                    value={tab}
                    onChange={setTab}
                    options={[
                        { value: 'season', label: fi ? 'Kausi' : 'Season' },
                        { value: 'alltime', label: fi ? 'Kaikkien aikojen' : 'All-time' },
                        { value: 'awards', label: fi ? 'Palkinnot' : 'Awards' },
                    ]}
                />
                {nations.length > 1 && (
                    <Chips
                        label={fi ? 'Maa' : 'Country'}
                        value={nation}
                        onChange={setNation}
                        options={nations.map((code) => ({ value: code, label: nationPlural(code, lang) }))}
                    />
                )}
            </div>

            {tab === 'season' && <SeasonTab key={nation} nation={nation} lang={lang} favPlayers={favPlayers} onPlayerClick={onPlayerClick} />}
            {tab === 'alltime' && <AllTimeTab key={nation} nation={nation} lang={lang} favPlayers={favPlayers} onPlayerClick={onPlayerClick} />}
            {tab === 'awards' && <AwardsTab key={nation} nation={nation} lang={lang} onPlayerClick={onPlayerClick} />}

            {nations.length === 1 && (
                <p className="source-note">
                    {fi ? 'Muita maita voi seurata asetuksista.' : 'Follow more countries in Settings.'}
                </p>
            )}
        </div>
    );
}

function SeasonTab({ nation, lang, favPlayers, onPlayerClick }) {
    const fi = lang === 'fi';
    const [who, setWho] = useState('skaters');
    const { data, error } = useApi(
        (signal) => Promise.all([api.statsTable('skaters', {}, { signal }), api.statsTable('goalies', {}, { signal })])
            .then(([skaters, goalies]) => ({ skaters, goalies })),
        [],
    );

    const skaters = useMemo(() => (data?.skaters.rows ?? []).filter((r) => r.nat === nation), [data, nation]);
    const goalies = useMemo(() => (data?.goalies.rows ?? []).filter((r) => r.nat === nation), [data, nation]);

    if (error && !data) return <p className="panel-hint">{fi ? 'Tilastojen haku epäonnistui.' : 'Could not load stats.'}</p>;
    if (!data) return <div className="skeleton" style={{ height: 420 }} />;

    const season = data.skaters.season;
    const totals = skaters.reduce((acc, r) => ({ goals: acc.goals + (r.goals ?? 0), points: acc.points + (r.points ?? 0) }), { goals: 0, points: 0 });

    return (
        <>
            {data.skaters.isPreviousSeason && (
                <p className="notice">
                    <IconInfoCircle size={16} stroke={2} aria-hidden="true" />
                    {fi ? `Uusi kausi ei ole vielä alkanut, joten näytetään kausi ${seasonLabel(season)}.` : `Showing ${seasonLabel(season)}.`}
                </p>
            )}
            <StatTiles
                tiles={[
                    { label: fi ? 'Pelaajia' : 'Players', value: int(skaters.length + goalies.length) },
                    { label: fi ? 'Maalit' : 'Goals', value: int(totals.goals), tone: 'accent' },
                    { label: fi ? 'Pisteet' : 'Points', value: int(totals.points) },
                ]}
            />
            <div className="nat-filter">
                <Chips
                    label={fi ? 'Pelaajat' : 'Players'}
                    value={who}
                    onChange={setWho}
                    options={[
                        { value: 'skaters', label: fi ? 'Kenttäpelaajat' : 'Skaters', count: skaters.length },
                        { value: 'goalies', label: fi ? 'Maalivahdit' : 'Goalies', count: goalies.length },
                    ]}
                />
            </div>
            <DataTable
                key={who}
                rows={who === 'skaters' ? skaters : goalies}
                columns={who === 'skaters' ? SEASON_SKATER_COLUMNS(fi) : GOALIE_COLUMNS(fi, lang)}
                identity={{ label: fi ? 'Pelaaja' : 'Player', render: (row) => <PlayerIdentity row={row} language={lang} /> }}
                defaultSort={{ key: who === 'skaters' ? 'points' : 'wins', dir: 'desc' }}
                isQualified={(row) => row.gp >= 10}
                qualifierNote={fi ? 'Alle 10 ottelua' : 'Fewer than 10 games'}
                isHighlighted={(row) => favPlayers.includes(row.id)}
                onRowClick={(row) => onPlayerClick(row.id)}
                language={lang}
                caption={fi ? 'Kauden tilastot' : 'Season stats'}
            />
        </>
    );
}

function AllTimeTab({ nation, lang, favPlayers, onPlayerClick }) {
    const fi = lang === 'fi';
    const [gameType, setGameType] = useState(2);
    const [who, setWho] = useState('skaters');
    const { data, error } = useApi((signal) => api.nationCareers(nation, gameType, { signal }), [nation, gameType]);

    if (error && !data) return <p className="panel-hint">{fi ? 'Uratilastojen haku epäonnistui.' : 'Could not load careers.'}</p>;
    if (!data) return <div className="skeleton" style={{ height: 420 }} />;

    const rows = who === 'skaters' ? data.skaters : data.goalies;
    const all = [...data.skaters, ...data.goalies];
    const games = all.reduce((sum, p) => sum + (p.gp ?? 0), 0);
    const points = data.skaters.reduce((sum, p) => sum + (p.points ?? 0), 0);

    return (
        <>
            <StatTiles
                tiles={[
                    { label: fi ? 'Pelaajia' : 'Players', value: int(all.length), sub: fi ? `${all.filter((p) => p.active).length} viime kaudella` : `${all.filter((p) => p.active).length} last season` },
                    { label: fi ? 'Ottelut' : 'Games', value: games.toLocaleString(fi ? 'fi-FI' : 'en-US') },
                    { label: fi ? 'Pisteet' : 'Points', value: points.toLocaleString(fi ? 'fi-FI' : 'en-US'), tone: 'accent' },
                ]}
            />
            <div className="nat-filter">
                <Chips
                    label={fi ? 'Ottelutyyppi' : 'Game type'}
                    value={gameType}
                    onChange={setGameType}
                    options={[
                        { value: 2, label: fi ? 'Runkosarja' : 'Regular season' },
                        { value: 3, label: fi ? 'Pudotuspelit' : 'Playoffs' },
                    ]}
                />
                <Chips
                    label={fi ? 'Pelaajat' : 'Players'}
                    value={who}
                    onChange={setWho}
                    options={[
                        { value: 'skaters', label: fi ? 'Kenttäpelaajat' : 'Skaters', count: data.skaters.length },
                        { value: 'goalies', label: fi ? 'Maalivahdit' : 'Goalies', count: data.goalies.length },
                    ]}
                />
            </div>
            <DataTable
                key={`${who}:${gameType}`}
                rows={rows}
                columns={who === 'skaters' ? SKATER_COLUMNS(fi, lang) : GOALIE_COLUMNS(fi, lang)}
                identity={{
                    label: fi ? 'Pelaaja' : 'Player',
                    render: (row) => (
                        <span className="dt-person-text">
                            <span className="dt-name">
                                {row.name}
                                {row.active && <span className="dt-tag" title={fi ? 'Pelasi viime kaudella' : 'Played last season'}>{fi ? 'akt.' : 'act.'}</span>}
                            </span>
                            <span className="dt-meta">{positionLabel(row.pos, lang)}</span>
                        </span>
                    ),
                }}
                defaultSort={{ key: who === 'skaters' ? 'points' : 'wins', dir: 'desc' }}
                isQualified={(row) => row.gp >= (gameType === 3 ? 20 : 100)}
                qualifierNote={fi ? `Alle ${gameType === 3 ? 20 : 100} ottelua` : `Fewer than ${gameType === 3 ? 20 : 100} games`}
                isHighlighted={(row) => favPlayers.includes(row.id)}
                onRowClick={(row) => onPlayerClick(row.id)}
                language={lang}
                caption={fi ? 'Kaikkien aikojen tilastot' : 'All-time stats'}
            />
        </>
    );
}

function AwardsTab({ nation, lang, onPlayerClick }) {
    const fi = lang === 'fi';
    const { data, error } = useApi(
        (signal) => Promise.all([api.nationAwards(nation, { signal }), api.trophies({ signal })])
            .then(([awards, trophies]) => ({ awards, trophies })),
        [nation],
    );

    if (error && !data) return <p className="panel-hint">{fi ? 'Palkintojen haku epäonnistui.' : 'Could not load awards.'}</p>;
    if (!data) return <div className="skeleton" style={{ height: 320 }} />;

    const trophyByKey = new Map(data.trophies.map((t) => [t.key, t]));
    const counts = data.trophies
        .map((t) => ({ ...t, count: data.awards.filter((a) => a.trophy === t.key).length }))
        .filter((t) => t.count > 0);

    if (data.awards.length === 0) {
        return <p className="panel-hint">{fi ? 'Ei yksilöpalkintoja.' : 'No individual awards.'}</p>;
    }

    return (
        <>
            <div className="award-counts">
                {counts.map((t) => (
                    <span key={t.key} className="award" title={t.name}>
                        <IconTrophy size={14} stroke={2} aria-hidden="true" />
                        {t.name.replace(/ (Memorial )?(Trophy|Award)$/, '')} <strong>{t.count}</strong>
                    </span>
                ))}
            </div>
            <ul className="team-games">
                {data.awards.map((a) => {
                    const trophy = trophyByKey.get(a.trophy);
                    return (
                        <li key={`${a.trophy}-${a.season}`}>
                            <button type="button" className="team-game award-row" onClick={() => onPlayerClick(a.id)}>
                                <span className="tg-date">{seasonLabel(a.season)}</span>
                                <span className="dt-person-text">
                                    <span className="dt-name">{a.name}</span>
                                    <span className="dt-meta">{trophy?.name}{fi && trophy?.fi ? ` · ${trophy.fi.toLowerCase()}` : ''}</span>
                                </span>
                                <IconChevronRight size={16} stroke={2} className="search2-chevron" aria-hidden="true" />
                            </button>
                        </li>
                    );
                })}
            </ul>
            <p className="source-note">{fi ? 'Lähde: records.nhl.com' : 'Source: records.nhl.com'}</p>
        </>
    );
}
