import React, { useMemo, useState } from 'react';
import { IconInfoCircle, IconRefresh } from '@tabler/icons-react';
import ViewHeader from '../components/shell/ViewHeader';
import DataTable from '../components/ui/DataTable';
import Segmented from '../components/ui/Segmented';
import SeasonPicker from '../components/ui/SeasonPicker';
import { TeamIdentity } from '../components/table/Identity';
import { useApi } from '../hooks/useApi';
import { usePersistentState } from '../hooks/usePersistentState';
import { useSettings } from '../state/settings';
import { api } from '../utils/api';
import { int, pct, signed, seasonLabel } from '../utils/format';
import { routeOf } from '../router/routes';

/**
 * Sarjataulukko.
 *
 * Neljä näkymää: divisioonat (oletus, NHL:n oma esitystapa), konferenssit,
 * villi kortti ja koko liiga. Pudotuspelien raja piirretään katkoviivana
 * silloin, kun taulukko on sarjajärjestyksessä — jos käyttäjä lajittelee
 * esim. maalieron mukaan, raja ei enää tarkoittaisi mitään.
 */

const DIVISIONS = {
    Eastern: ['Atlantic', 'Metropolitan'],
    Western: ['Central', 'Pacific'],
};

const DIVISION_NAMES = {
    Atlantic: { fi: 'Atlantin divisioona', en: 'Atlantic Division' },
    Metropolitan: { fi: 'Metropolitan-divisioona', en: 'Metropolitan Division' },
    Central: { fi: 'Keskinen divisioona', en: 'Central Division' },
    Pacific: { fi: 'Tyynenmeren divisioona', en: 'Pacific Division' },
};

const CONFERENCE_NAMES = {
    Eastern: { fi: 'Itäinen konferenssi', en: 'Eastern Conference' },
    Western: { fi: 'Läntinen konferenssi', en: 'Western Conference' },
};

const CLINCH = {
    x: { fi: 'Pudotuspelipaikka varmistettu', en: 'Clinched playoff berth' },
    y: { fi: 'Divisioonan voitto varmistettu', en: 'Clinched division' },
    z: { fi: 'Konferenssin kärki varmistettu', en: 'Clinched conference' },
    p: { fi: 'Runkosarjan voitto (Presidents’ Trophy)', en: 'Presidents’ Trophy' },
    e: { fi: 'Pudonnut pudotuspeleistä', en: 'Eliminated' },
};

/** Putki lajittelua varten: voittoputki positiivinen, tappioputki negatiivinen. */
const streakValue = (streak) => {
    const match = /^([A-Z]+)(\d+)$/.exec(streak ?? '');
    if (!match) return null;
    const count = Number(match[2]);
    if (match[1] === 'W') return count;
    if (match[1] === 'OT') return -count / 2;
    return -count;
};

const record = (text) => text ?? '–';

const GROUPS = [
    {
        id: 'basic',
        label: { fi: 'Perus', en: 'Basic' },
        columns: [
            { key: 'gp', label: { fi: 'O', en: 'GP' }, title: { fi: 'Ottelut', en: 'Games played' }, format: int },
            { key: 'wins', label: { fi: 'V', en: 'W' }, title: { fi: 'Voitot', en: 'Wins' }, format: int },
            { key: 'losses', label: { fi: 'H', en: 'L' }, title: { fi: 'Häviöt', en: 'Losses' }, format: int, lowerIsBetter: true },
            { key: 'otLosses', label: { fi: 'JAH', en: 'OTL' }, title: { fi: 'Jatkoaika- ja voittolaukaushäviöt', en: 'Overtime losses' }, format: int, lowerIsBetter: true },
            { key: 'points', label: { fi: 'P', en: 'PTS' }, title: { fi: 'Pisteet', en: 'Points' }, format: int },
        ],
    },
    {
        id: 'detail',
        label: { fi: 'Tarkemmin', en: 'Detail' },
        columns: [
            { key: 'pointPct', label: { fi: 'P%', en: 'P%' }, title: { fi: 'Pisteprosentti', en: 'Points percentage' }, format: (v, _r, l) => pct(v, 1, l) },
            { key: 'regWins', label: { fi: 'VV', en: 'RW' }, title: { fi: 'Voitot varsinaisella peliajalla', en: 'Regulation wins' }, format: int },
            { key: 'goalsFor', label: { fi: 'TM', en: 'GF' }, title: { fi: 'Tehdyt maalit', en: 'Goals for' }, format: int },
            { key: 'goalsAgainst', label: { fi: 'PM', en: 'GA' }, title: { fi: 'Päästetyt maalit', en: 'Goals against' }, format: int, lowerIsBetter: true },
            { key: 'goalDiff', label: { fi: 'ME', en: 'DIFF' }, title: { fi: 'Maaliero', en: 'Goal differential' }, format: signed },
        ],
    },
    {
        id: 'form',
        label: { fi: 'Muoto', en: 'Form' },
        columns: [
            { key: 'home', label: { fi: 'Koti', en: 'Home' }, title: { fi: 'Kotiottelut V-H-JAH', en: 'Home W-L-OTL' }, value: (r) => r.homePoints, format: (_v, r) => record(r.home), width: '62px' },
            { key: 'road', label: { fi: 'Vieras', en: 'Away' }, title: { fi: 'Vierasottelut V-H-JAH', en: 'Road W-L-OTL' }, value: (r) => r.roadPoints, format: (_v, r) => record(r.road), width: '62px' },
            { key: 'l10', label: { fi: '10 v.', en: 'L10' }, title: { fi: 'Viimeiset 10 ottelua', en: 'Last 10 games' }, value: (r) => r.l10Points, format: (_v, r) => record(r.l10), width: '56px' },
            { key: 'streak', label: { fi: 'PU', en: 'STK' }, title: { fi: 'Putki: W = voittoja, L = tappioita, OT = jatkoaikatappioita peräkkäin', en: 'Current streak' }, value: (r) => streakValue(r.streak), format: (_v, r) => r.streak ?? '–' },
        ],
    },
];

/** Onko joukkue nyt pudotuspelipaikalla (divisioonan kolme parasta tai kaksi villiä korttia). */
const inPlayoffSpot = (row) => row.divSeq <= 3 || row.wcSeq === 1 || row.wcSeq === 2;

export default function StandingsView({ onTeamClick }) {
    const { language, favTeams } = useSettings();
    const lang = language === 'en' ? 'en' : 'fi';
    const fi = lang === 'fi';
    const route = routeOf('/taulukot/sarjataulukko');

    const [season, setSeason] = useState(null);
    const [mode, setMode] = usePersistentState('pucknower_standings_mode', 'division');
    const [groupId, setGroupId] = usePersistentState('pucknower_standings_group', 'basic');

    const { data, error, isLoading, reload } = useApi(
        (signal) => api.standings(season ?? undefined, { signal }),
        [season],
    );

    const teams = useMemo(() => data?.teams ?? [], [data]);
    const group = GROUPS.find((g) => g.id === groupId) ?? GROUPS[0];
    const columns = useMemo(
        () => group.columns.map((c) => ({ ...c, label: c.label[lang], title: c.title?.[lang] })),
        [group, lang],
    );

    /** Taulukot näkymän mukaan: [{ id, title, rows, divider }]. */
    const tables = useMemo(() => {
        if (teams.length === 0) return [];
        const bySeq = (key) => (a, b) => (a[key] ?? 99) - (b[key] ?? 99);

        if (mode === 'league') {
            return [{ id: 'league', title: null, rows: [...teams].sort(bySeq('leagueSeq')) }];
        }

        const result = [];
        for (const conference of ['Eastern', 'Western']) {
            const inConference = teams.filter((t) => t.conference === conference);

            if (mode === 'conference') {
                result.push({
                    id: conference,
                    title: CONFERENCE_NAMES[conference][lang],
                    rows: [...inConference].sort(bySeq('confSeq')),
                });
                continue;
            }

            for (const division of DIVISIONS[conference]) {
                const inDivision = inConference.filter((t) => t.division === division).sort(bySeq('divSeq'));
                result.push({
                    id: division,
                    conference,
                    title: DIVISION_NAMES[division][lang],
                    // Villin kortin näkymässä divisioonasta vain kolme parasta.
                    rows: mode === 'wildcard' ? inDivision.slice(0, 3) : inDivision,
                    divider: mode === 'division' ? 3 : null,
                });
            }

            if (mode === 'wildcard') {
                result.push({
                    id: `${conference}-wc`,
                    conference,
                    title: fi ? 'Villi kortti' : 'Wild card',
                    rows: inConference.filter((t) => t.divSeq > 3).sort(bySeq('wcSeq')),
                    divider: 2,
                });
            }
        }
        return result;
    }, [teams, mode, lang, fi]);

    const identity = {
        label: fi ? 'Joukkue' : 'Team',
        render: (row) => (
            <TeamIdentity row={row} tag={row.clinch ?? undefined} tagTitle={CLINCH[row.clinch]?.[lang]} />
        ),
    };

    const subtitle = data
        ? `${fi ? 'Kausi' : 'Season'} ${seasonLabel(data.season)}${data.isPreviousSeason ? (fi ? ' · lopputilanne' : ' · final') : ''}`
        : route.hint?.[lang];

    return (
        <div className="view">
            <ViewHeader icon={route.icon} title={route.label[lang]} subtitle={subtitle}>
                <SeasonPicker season={season} onSeason={setSeason} language={lang} />
            </ViewHeader>

            {data?.isPreviousSeason && (
                <p className="notice">
                    <IconInfoCircle size={16} stroke={2} aria-hidden="true" />
                    {fi
                        ? `Uusi kausi ei ole vielä alkanut, joten näytetään kauden ${seasonLabel(data.season)} lopputilanne.`
                        : `The new season hasn't started yet, so the final ${seasonLabel(data.season)} standings are shown.`}
                </p>
            )}

            <div className="toolbar">
                <Segmented
                    label={fi ? 'Näkymä' : 'View'}
                    value={mode}
                    onChange={setMode}
                    options={[
                        { value: 'division', label: fi ? 'Divisioonat' : 'Divisions' },
                        { value: 'wildcard', label: fi ? 'Villi kortti' : 'Wild card' },
                        { value: 'conference', label: fi ? 'Konferenssit' : 'Conferences' },
                        { value: 'league', label: fi ? 'Liiga' : 'League' },
                    ]}
                />
                <Segmented
                    label={fi ? 'Sarakkeet' : 'Columns'}
                    value={group.id}
                    onChange={setGroupId}
                    options={GROUPS.map((g) => ({ value: g.id, label: g.label[lang] }))}
                    size="sm"
                />
            </div>

            {error && !data && (
                <div className="panel">
                    <p className="panel-hint">{fi ? 'Sarjataulukon haku epäonnistui.' : 'Could not load standings.'} {error}</p>
                    <button type="button" className="chip" onClick={reload}>
                        <IconRefresh size={14} stroke={2} aria-hidden="true" />
                        {fi ? 'Yritä uudelleen' : 'Try again'}
                    </button>
                </div>
            )}

            {!data && !error && <div className="skeleton" style={{ height: 520 }} />}

            {isLoading && data && <div className="loading-line" aria-hidden="true" />}

            {tables.map((table, index) => {
                const conferenceStarts = mode !== 'league' && mode !== 'conference'
                    && table.conference && tables[index - 1]?.conference !== table.conference;
                return (
                    <section key={table.id} className="standings-block">
                        {conferenceStarts && (
                            <h2 className="standings-conference">{CONFERENCE_NAMES[table.conference][lang]}</h2>
                        )}
                        {table.title && <h3 className="standings-title">{table.title}</h3>}
                        <DataTable
                            key={`${group.id}:${mode}`}
                            rows={table.rows}
                            columns={columns}
                            identity={identity}
                            rowKey={(row) => row.team}
                            defaultSort={group.id === 'basic' ? { key: 'points', dir: 'desc' } : { key: columns[0].key, dir: 'desc' }}
                            tiesShareRank={false}
                            onRowClick={(row) => onTeamClick?.(row.team)}
                            isHighlighted={(row) => favTeams.includes(row.team)}
                            rowClass={(row) => (mode === 'conference' || mode === 'league') && inPlayoffSpot(row) ? 'is-playoff' : ''}
                            dividerAfter={(_row, i, rows, sort) => (
                                table.divider && i === table.divider - 1 && i < rows.length - 1
                                && sort.key === 'points' && sort.dir === 'desc' ? 'playoff' : null
                            )}
                            pageSize={40}
                            language={lang}
                            caption={table.title ?? route.label[lang]}
                        />
                    </section>
                );
            })}

            {teams.length > 0 && (
                <p className="standings-legend">
                    {(mode === 'conference' || mode === 'league')
                        ? (fi ? 'Korostettu reuna = pudotuspelipaikalla nyt.' : 'Marked edge = currently in a playoff spot.')
                        : (fi ? 'Katkoviiva = pudotuspelien raja.' : 'Dashed line = playoff cut.')}
                    {' '}
                    {fi ? 'x = pudotuspelit varmat, y = divisioonan voitto, z = konferenssin kärki, p = runkosarjan voitto, e = pudonnut.'
                        : 'x = clinched playoffs, y = division, z = conference, p = Presidents’ Trophy, e = eliminated.'}
                </p>
            )}
        </div>
    );
}
