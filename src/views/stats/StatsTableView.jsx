import React, { useMemo, useState } from 'react';
import { IconInfoCircle, IconRefresh } from '@tabler/icons-react';
import ViewHeader from '../../components/shell/ViewHeader';
import DataTable from '../../components/ui/DataTable';
import Segmented from '../../components/ui/Segmented';
import Chips from '../../components/ui/Chips';
import SearchField from '../../components/ui/SearchField';
import SeasonPicker from '../../components/ui/SeasonPicker';
import { PlayerIdentity, TeamIdentity } from '../../components/table/Identity';
import { useApi } from '../../hooks/useApi';
import { usePersistentState } from '../../hooks/usePersistentState';
import { useSettings } from '../../state/settings';
import { api } from '../../utils/api';
import { seasonLabel } from '../../utils/format';
import { nationPlural } from '../../utils/nations';
import { routeOf } from '../../router/routes';

/** Suhdeluvuissa mukana ne, jotka ovat pelanneet vähintään neljänneksen kärjen otteluista. */
const QUALIFY_SHARE = 0.25;

/** Kirjainkoosta ja aksenteista riippumaton haku: "selanne" löytää Selänteen. */
const normalise = (text) => String(text ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Yleinen tilastonäkymä. Pistepörssi, maalivahdit ja joukkueet ovat tämän
 * asetuksia (tableConfigs.js), eivät omia komponenttejaan — lajittelu,
 * suodatus, haku ja kausivalinta toimivat kaikissa samoin.
 */
export default function StatsTableView({ config, onPlayerClick, onTeamClick, switcher }) {
    const { settings, language, favPlayers, favTeams } = useSettings();
    const lang = language === 'en' ? 'en' : 'fi';
    const fi = lang === 'fi';
    const route = routeOf(config.path);
    const isTeams = config.identity === 'team';

    const [season, setSeason] = useState(null);
    const [gameType, setGameType] = useState(2);
    const [groupId, setGroupId] = usePersistentState(`pucknower_group_${config.id}`, config.groups[0].id);
    const [filter, setFilter] = usePersistentState(`pucknower_filter_${config.id}`, 'all');
    const [search, setSearch] = useState('');

    const { data, error, isLoading, reload } = useApi(
        (signal) => api.statsTable(config.category, { season: season ?? undefined, gameType }, { signal }),
        [config.category, season, gameType],
    );

    const rows = useMemo(() => data?.rows ?? [], [data]);

    // --- Suodattimet: näkymän omat + seuratut kansallisuudet + suosikit ---
    const filters = useMemo(() => {
        const list = config.filters.map((f) => ({ ...f, label: f.label[lang] }));

        if (!isTeams) {
            for (const code of settings.nationalities) {
                list.push({ value: `nat:${code}`, label: nationPlural(code, lang), test: (r) => r.nat === code });
            }
        }

        const favourites = isTeams ? favTeams : favPlayers;
        if (favourites.length > 0) {
            list.push({
                value: 'fav',
                label: fi ? 'Suosikit' : 'Favourites',
                test: isTeams ? (r) => favTeams.includes(r.team) : (r) => favPlayers.includes(r.id),
            });
        }

        return list.map((f) => ({
            ...f,
            count: f.test ? rows.filter(f.test).length : undefined,
        }));
    }, [config.filters, settings.nationalities, favPlayers, favTeams, isTeams, lang, fi, rows]);

    // Tallennettu suodatin voi olla poistunut (esim. suosikit tyhjennetty).
    const activeFilter = filters.find((f) => f.value === filter) ?? filters[0];

    const filtered = useMemo(() => {
        let result = activeFilter?.test ? rows.filter(activeFilter.test) : rows;
        const needle = normalise(search.trim());
        if (needle) result = result.filter((r) => normalise(r.name).includes(needle) || normalise(r.team).includes(needle));
        return result;
    }, [rows, activeFilter, search]);

    const group = config.groups.find((g) => g.id === groupId) ?? config.groups[0];
    const columns = useMemo(
        () => group.columns.map((c) => ({ ...c, label: c.label[lang], title: c.title?.[lang] })),
        [group, lang],
    );

    // Suhdelukujen kelpoisuusraja koko aineiston kärjestä, ei suodatetusta.
    const minGames = useMemo(() => {
        const maxGp = rows.reduce((max, r) => Math.max(max, r.gp ?? 0), 0);
        return Math.max(1, Math.round(maxGp * QUALIFY_SHARE));
    }, [rows]);

    const isQualified = useMemo(() => (row) => (row.gp ?? 0) >= minGames, [minGames]);

    const identity = isTeams
        ? { label: fi ? 'Joukkue' : 'Team', render: (row) => <TeamIdentity row={row} /> }
        : { label: fi ? 'Pelaaja' : 'Player', render: (row) => <PlayerIdentity row={row} language={lang} /> };

    const subtitle = data
        ? `${fi ? 'Kausi' : 'Season'} ${seasonLabel(data.season)} · ${gameType === 3 ? (fi ? 'pudotuspelit' : 'playoffs') : (fi ? 'runkosarja' : 'regular season')}`
        : route.hint?.[lang];

    return (
        <div className="view">
            <ViewHeader icon={route.icon} title={route.label[lang]} subtitle={subtitle}>
                <SeasonPicker
                    season={season}
                    onSeason={setSeason}
                    gameType={gameType}
                    onGameType={setGameType}
                    language={lang}
                />
            </ViewHeader>

            {switcher}

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
                    label={fi ? 'Sarakkeet' : 'Columns'}
                    value={group.id}
                    onChange={setGroupId}
                    options={config.groups.map((g) => ({ value: g.id, label: g.label[lang] }))}
                    size="sm"
                />
                <Chips
                    label={fi ? 'Rajaus' : 'Filter'}
                    value={activeFilter?.value}
                    onChange={setFilter}
                    options={filters}
                />
                {!isTeams && (
                    <div className="toolbar-row">
                        <SearchField
                            value={search}
                            onChange={setSearch}
                            placeholder={fi ? 'Hae pelaajaa tai joukkuetta' : 'Search player or team'}
                        />
                    </div>
                )}
            </div>

            {error && !data && (
                <div className="panel">
                    <p className="panel-hint">{fi ? 'Tilastojen haku epäonnistui.' : 'Could not load stats.'} {error}</p>
                    <button type="button" className="chip" onClick={reload}>
                        <IconRefresh size={14} stroke={2} aria-hidden="true" />
                        {fi ? 'Yritä uudelleen' : 'Try again'}
                    </button>
                </div>
            )}

            {!data && !error && <div className="skeleton" style={{ height: 480 }} aria-label={fi ? 'Ladataan' : 'Loading'} />}

            {data && (
                <>
                    {isLoading && <div className="loading-line" aria-hidden="true" />}
                    <DataTable
                        key={`${group.id}:${config.id}`}
                        rows={filtered}
                        columns={columns}
                        identity={identity}
                        rowKey={(row) => row.id ?? row.team}
                        defaultSort={config.defaultSort}
                        onRowClick={isTeams ? (row) => onTeamClick?.(row.team) : (row) => onPlayerClick?.(row.id)}
                        isHighlighted={isTeams ? (row) => favTeams.includes(row.team) : (row) => favPlayers.includes(row.id)}
                        isQualified={isQualified}
                        qualifierNote={fi
                            ? `Alle ${minGames} ottelua pelanneet eivät ole mukana suhdelukujen kärjessä`
                            : `Players with fewer than ${minGames} games are not ranked on rates`}
                        language={lang}
                        caption={route.label[lang]}
                    />
                    {config.source && (
                        <p className="source-note">
                            {fi ? 'Data' : 'Data'}: <a href={`https://${config.source.toLowerCase()}`} target="_blank" rel="noreferrer">{config.source}</a>
                        </p>
                    )}
                </>
            )}
        </div>
    );
}
