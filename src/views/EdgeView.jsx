import React, { useState } from 'react';
import { IconInfoCircle, IconBolt } from '@tabler/icons-react';
import ViewHeader from '../components/shell/ViewHeader';
import DataTable from '../components/ui/DataTable';
import Segmented from '../components/ui/Segmented';
import Chips from '../components/ui/Chips';
import SeasonPicker from '../components/ui/SeasonPicker';
import { TeamIdentity } from '../components/table/Identity';
import { useApi } from '../hooks/useApi';
import { usePersistentState } from '../hooks/usePersistentState';
import { useSettings } from '../state/settings';
import { api } from '../utils/api';
import { int, dec, pct, seasonLabel, shortDate } from '../utils/format';
import { positionLabel } from '../utils/positions';
import { teamColors, DEFAULT_TEAM_COLORS } from '../utils/teamColors';
import { routeOf } from '../router/routes';
import { teamByAbbrev } from '../utils/teams';

/**
 * Nopeudet: NHL EDGE -seurantadata.
 *
 * NHL julkaisee EDGE-luvuista vain kärkilistat, joten taulukossa on kunkin
 * mittarin kymmenen parasta (kahden järjestyksen yhdistelmänä, esim.
 * huippunopeus ja kovien pyrähdysten määrä). Nopeudet ja matkat ovat
 * metrijärjestelmässä; rajat on muunnettu mailereista (22 mph ≈ 35 km/h).
 */

const colourOf = (abbrev) => (teamColors[abbrev] ?? DEFAULT_TEAM_COLORS)[0];

const d1 = (v, _r, l) => dec(v, 1, l);
const d2 = (v, _r, l) => dec(v, 2, l);
const p1 = (v, _r, l) => pct(v, 1, l);

const CATEGORIES = {
    speed: {
        label: { fi: 'Luistelunopeus', en: 'Skating speed' },
        hero: { key: 'maxSpeed', unit: 'km/h', text: { fi: 'Kauden kovin luistelunopeus', en: 'Top skating speed' } },
        columns: [
            { key: 'maxSpeed', label: 'km/h', title: { fi: 'Huippunopeus', en: 'Top speed' }, format: d1 },
            { key: 'bursts22', label: '>35', title: { fi: 'Pyrähdykset yli 35 km/h', en: 'Bursts over 22 mph' }, format: int },
            { key: 'bursts20', label: '32–35', title: { fi: 'Pyrähdykset 32–35 km/h', en: 'Bursts 20–22 mph' }, format: int, width: '52px' },
        ],
        defaultSort: 'maxSpeed',
    },
    shot: {
        label: { fi: 'Laukausnopeus', en: 'Shot speed' },
        hero: { key: 'hardest', unit: 'km/h', text: { fi: 'Kauden kovin laukaus', en: 'Hardest shot' } },
        columns: [
            { key: 'hardest', label: 'km/h', title: { fi: 'Kovin laukaus', en: 'Hardest shot' }, format: d1 },
            { key: 'over100', label: '>160', title: { fi: 'Laukaukset yli 160 km/h', en: 'Shots over 100 mph' }, format: int },
            { key: 's90to100', label: '145–', title: { fi: 'Laukaukset 145–160 km/h', en: 'Shots 90–100 mph' }, format: int },
            { key: 's80to90', label: '129–', title: { fi: 'Laukaukset 129–145 km/h', en: 'Shots 80–90 mph' }, format: int },
        ],
        defaultSort: 'hardest',
    },
    distance: {
        label: { fi: 'Luistelumatka', en: 'Distance' },
        hero: { key: 'total', unit: 'km', text: { fi: 'Eniten luisteltu kaudella', en: 'Most distance skated' } },
        columns: [
            { key: 'total', label: 'km', title: { fi: 'Luisteltu matka yhteensä', en: 'Total distance' }, format: d1 },
            { key: 'per60', label: 'km/60', title: { fi: 'Matka 60 peliminuutissa', en: 'Distance per 60' }, format: d2, width: '54px' },
            { key: 'maxGame', label: 'Max', title: { fi: 'Pisin matka yhdessä ottelussa', en: 'Most in one game' }, format: d2 },
        ],
        defaultSort: 'total',
    },
    zone: {
        label: { fi: 'Hyökkäysalue', en: 'Zone time' },
        hero: { key: 'oz', unit: '%', percent: true, text: { fi: 'Suurin osuus peliajasta hyökkäysalueella', en: 'Highest offensive-zone share' } },
        columns: [
            { key: 'oz', label: 'HA%', title: { fi: 'Osuus peliajasta hyökkäysalueella', en: 'Offensive zone time' }, format: p1 },
            { key: 'nz', label: 'KA%', title: { fi: 'Osuus keskialueella', en: 'Neutral zone time' }, format: p1 },
            { key: 'dz', label: 'PA%', title: { fi: 'Osuus puolustusalueella', en: 'Defensive zone time' }, format: p1, lowerIsBetter: true },
        ],
        defaultSort: 'oz',
    },
    teams: {
        label: { fi: 'Joukkueet', en: 'Teams' },
        hero: { key: 'maxSpeed', unit: 'km/h', text: { fi: 'Nopein luistelija joukkueittain', en: 'Fastest skater by team' } },
        columns: [
            { key: 'maxSpeed', label: 'km/h', title: { fi: 'Joukkueen kovin nopeus', en: 'Top speed' }, format: d1 },
            { key: 'bursts22', label: '>35', title: { fi: 'Pyrähdykset yli 35 km/h', en: 'Bursts over 22 mph' }, format: int },
            { key: 'bursts20', label: '32–35', title: { fi: 'Pyrähdykset 32–35 km/h', en: 'Bursts 20–22 mph' }, format: int, width: '52px' },
            { key: 'bursts18', label: '29–32', title: { fi: 'Pyrähdykset 29–32 km/h', en: 'Bursts 18–20 mph' }, format: int, width: '52px' },
        ],
        defaultSort: 'maxSpeed',
    },
};

export default function EdgeView({ onPlayerClick, onTeamClick }) {
    const { language, favPlayers, favTeams } = useSettings();
    const lang = language === 'en' ? 'en' : 'fi';
    const fi = lang === 'fi';
    const route = routeOf('/tilastot/nopeudet');

    const [category, setCategory] = usePersistentState('pucknower_edge_category', 'speed');
    const [pos, setPos] = useState('all');
    const [season, setSeason] = useState(null);
    const [gameType, setGameType] = useState(2);

    const cat = CATEGORIES[category] ?? CATEGORIES.speed;
    const isTeams = category === 'teams';
    // Ennätysottelun päivä näytetään vain, kun se liittyy taulukon päälukuun.
    const showRecord = category === 'speed' || category === 'shot' || isTeams;

    const { data, error, isLoading, reload } = useApi(
        (signal) => api.edgeLeaders(category, { pos: isTeams ? undefined : pos, season: season ?? undefined, gameType }, { signal }),
        [category, pos, season, gameType],
    );

    const rows = data?.rows ?? [];
    const columns = cat.columns.map((c) => ({ ...c, title: c.title[lang] }));

    const leader = [...rows].sort((a, b) => (b[cat.hero.key] ?? 0) - (a[cat.hero.key] ?? 0))[0];
    const heroValue = leader && (cat.hero.percent ? pct(leader[cat.hero.key], 1, lang) : dec(leader[cat.hero.key], 1, lang));

    const identity = isTeams
        ? { label: fi ? 'Joukkue' : 'Team', render: (row) => <TeamIdentity row={row} /> }
        : {
            label: fi ? 'Pelaaja' : 'Player',
            render: (row) => (
                <span className="dt-person">
                    <span className="dt-dot" style={{ background: colourOf(row.team) }} aria-hidden="true" />
                    <span className="dt-person-text">
                        <span className="dt-name">{row.name}</span>
                        <span className="dt-meta">
                            {[row.team, positionLabel(row.pos, lang), showRecord && row.record && shortDate(row.record.date, lang)].filter(Boolean).join(' · ')}
                        </span>
                    </span>
                </span>
            ),
        };

    return (
        <div className="view">
            <ViewHeader icon={route.icon} title={route.label[lang]} subtitle={data ? `${fi ? 'Kausi' : 'Season'} ${seasonLabel(data.season)} · NHL EDGE` : route.hint[lang]}>
                <SeasonPicker season={season} onSeason={setSeason} gameType={gameType} onGameType={setGameType} language={lang} />
            </ViewHeader>

            {data?.isPreviousSeason && (
                <p className="notice">
                    <IconInfoCircle size={16} stroke={2} aria-hidden="true" />
                    {fi
                        ? `Uusi kausi ei ole vielä alkanut, joten näytetään kausi ${seasonLabel(data.season)}.`
                        : `The new season hasn't started yet, so ${seasonLabel(data.season)} is shown.`}
                </p>
            )}

            <div className="toolbar">
                <Segmented
                    size="sm"
                    label={fi ? 'Mittari' : 'Metric'}
                    value={category}
                    onChange={setCategory}
                    options={Object.entries(CATEGORIES).map(([value, c]) => ({ value, label: c.label[lang] }))}
                />
                {!isTeams && (
                    <Chips
                        label={fi ? 'Pelipaikka' : 'Position'}
                        value={pos}
                        onChange={setPos}
                        options={[
                            { value: 'all', label: fi ? 'Kaikki' : 'All' },
                            { value: 'F', label: fi ? 'Hyökkääjät' : 'Forwards' },
                            { value: 'D', label: fi ? 'Puolustajat' : 'Defence' },
                        ]}
                    />
                )}
            </div>

            {error && !data ? (
                <div className="panel">
                    <p className="panel-hint">{fi ? 'EDGE-datan haku epäonnistui.' : 'Could not load EDGE data.'}</p>
                    <button type="button" className="chip" onClick={reload}>{fi ? 'Yritä uudelleen' : 'Try again'}</button>
                </div>
            ) : !data ? (
                <div className="skeleton" style={{ height: 420 }} />
            ) : rows.length === 0 ? (
                <p className="panel-hint">{fi ? 'Tälle kaudelle ei ole EDGE-lukuja.' : 'No EDGE data for this season.'}</p>
            ) : (
                <>
                    {isLoading && <div className="loading-line" aria-hidden="true" />}
                    {leader && (
                        <button
                            type="button"
                            className="edge-hero"
                            style={{ '--team': colourOf(leader.team) }}
                            onClick={() => (isTeams ? onTeamClick(leader.team) : onPlayerClick(leader.id))}
                        >
                            <IconBolt size={22} stroke={1.8} className="edge-hero-icon" aria-hidden="true" />
                            <span className="edge-hero-text">
                                <span className="edge-hero-label">{cat.hero.text[lang]}</span>
                                <span className="edge-hero-name">{isTeams ? (teamByAbbrev(leader.team)?.name ?? leader.team) : leader.name}</span>
                                {showRecord && leader.record && (
                                    <span className="edge-hero-meta">
                                        {leader.record.away}–{leader.record.home} · {shortDate(leader.record.date, lang)}
                                    </span>
                                )}
                            </span>
                            <span className="edge-hero-value num">
                                {heroValue}<small>{cat.hero.unit === '%' ? ' %' : ` ${cat.hero.unit}`}</small>
                            </span>
                        </button>
                    )}
                    <DataTable
                        key={`${category}:${pos}`}
                        rows={rows}
                        columns={columns}
                        identity={identity}
                        rowKey={(row) => row.id}
                        defaultSort={{ key: cat.defaultSort, dir: 'desc' }}
                        onRowClick={isTeams ? (row) => onTeamClick(row.team) : (row) => onPlayerClick(row.id)}
                        isHighlighted={isTeams ? (row) => favTeams.includes(row.team) : (row) => favPlayers.includes(row.id)}
                        language={lang}
                        caption={cat.label[lang]}
                    />
                    <p className="source-note">
                        {fi
                            ? 'NHL julkaisee EDGE-luvuista vain kärkilistat: taulukossa on kunkin mittarin kymmenen parasta. Data: NHL EDGE.'
                            : 'The NHL only publishes EDGE leaderboards: each metric shows its top ten. Data: NHL EDGE.'}
                    </p>
                </>
            )}
        </div>
    );
}
