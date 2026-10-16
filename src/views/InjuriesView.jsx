import React, { useMemo, useState } from 'react';
import { IconInfoCircle, IconChevronRight } from '@tabler/icons-react';
import ViewHeader from '../components/shell/ViewHeader';
import Segmented from '../components/ui/Segmented';
import Chips from '../components/ui/Chips';
import SearchField from '../components/ui/SearchField';
import { useApi } from '../hooks/useApi';
import { usePersistentState } from '../hooks/usePersistentState';
import { useSettings } from '../state/settings';
import { api } from '../utils/api';
import { nationPlural } from '../utils/nations';
import { teamByAbbrev } from '../utils/teams';
import { teamColors, DEFAULT_TEAM_COLORS } from '../utils/teamColors';
import { routeOf } from '../router/routes';
import { InjuryRow } from '../components/Injuries';
import { statusOf } from '../utils/injuries';

/** Loukkaantumiset koko liigasta. Rivit ja tilat: components/Injuries.jsx. */

const colourOf = (abbrev) => (teamColors[abbrev] ?? DEFAULT_TEAM_COLORS)[0];

export default function InjuriesView({ onPlayerClick, onTeamClick }) {
    const { language, settings, favTeams, favPlayers } = useSettings();
    const lang = language === 'en' ? 'en' : 'fi';
    const fi = lang === 'fi';
    const route = routeOf('/taulukot/loukkaantumiset');

    const [order, setOrder] = usePersistentState('pucknower_injuries_order', 'team');
    const [filter, setFilter] = useState('all');
    const [search, setSearch] = useState('');

    const { data, error, reload } = useApi((signal) => api.injuries({ signal }), []);
    const rows = useMemo(() => data?.rows ?? [], [data]);

    const filters = useMemo(() => {
        const list = [{ value: 'all', label: fi ? 'Kaikki' : 'All', test: null }];
        const fav = (r) => favTeams.includes(r.team) || favPlayers.includes(r.id);
        if (favTeams.length || favPlayers.length) list.push({ value: 'fav', label: fi ? 'Suosikit' : 'Favourites', test: fav });
        for (const code of settings.nationalities) {
            list.push({ value: `nat:${code}`, label: nationPlural(code, lang), test: (r) => r.nat === code });
        }
        list.push({ value: 'long', label: fi ? 'Pitkäaikaiset' : 'Long-term', test: (r) => statusOf(r, lang).tone === 'long' });
        return list.map((f) => ({ ...f, count: f.test ? rows.filter(f.test).length : rows.length }));
    }, [rows, favTeams, favPlayers, settings.nationalities, fi, lang]);

    const active = filters.find((f) => f.value === filter) ?? filters[0];

    const visible = useMemo(() => {
        const needle = search.trim().toLowerCase();
        let list = active.test ? rows.filter(active.test) : rows;
        if (needle) list = list.filter((r) => r.name.toLowerCase().includes(needle) || r.team.toLowerCase().includes(needle));
        return list;
    }, [rows, active, search]);

    const groups = useMemo(() => {
        if (order === 'return') {
            const sorted = [...visible].sort((a, b) => (a.returnDate ?? '9999').localeCompare(b.returnDate ?? '9999'));
            return [{ key: 'all', rows: sorted }];
        }
        const byTeam = new Map();
        for (const r of visible) {
            if (!byTeam.has(r.team)) byTeam.set(r.team, []);
            byTeam.get(r.team).push(r);
        }
        return [...byTeam.entries()]
            .sort(([a], [b]) => (teamByAbbrev(a)?.name ?? a).localeCompare(teamByAbbrev(b)?.name ?? b))
            .map(([team, list]) => ({ key: team, team, rows: list }));
    }, [visible, order]);

    const updated = data?.updated ? new Date(data.updated) : null;

    return (
        <div className="view">
            <ViewHeader
                icon={route.icon}
                title={route.label[lang]}
                subtitle={data ? `${rows.length} ${fi ? 'pelaajaa sivussa' : 'players out'}` : route.hint[lang]}
            />

            <div className="toolbar">
                <Segmented
                    size="sm"
                    label={fi ? 'Järjestys' : 'Order'}
                    value={order}
                    onChange={setOrder}
                    options={[
                        { value: 'team', label: fi ? 'Joukkueittain' : 'By team' },
                        { value: 'return', label: fi ? 'Paluuarvion mukaan' : 'By return' },
                    ]}
                />
                <Chips label={fi ? 'Rajaus' : 'Filter'} value={active.value} onChange={setFilter} options={filters} />
                <div className="toolbar-row">
                    <SearchField value={search} onChange={setSearch} placeholder={fi ? 'Hae pelaajaa tai joukkuetta' : 'Search player or team'} />
                </div>
            </div>

            {error && !data ? (
                <div className="panel">
                    <p className="panel-hint">{fi ? 'Loukkaantumistietojen haku epäonnistui.' : 'Could not load injuries.'}</p>
                    <button type="button" className="chip" onClick={reload}>{fi ? 'Yritä uudelleen' : 'Try again'}</button>
                </div>
            ) : !data ? (
                <div className="skeleton" style={{ height: 480 }} />
            ) : visible.length === 0 ? (
                <p className="panel-hint">{fi ? 'Ei loukkaantuneita näillä valinnoilla.' : 'No injuries with these filters.'}</p>
            ) : (
                groups.map((g) => (
                    <section key={g.key} className="inj-group">
                        {g.team && (
                            <button type="button" className="inj-team" onClick={() => onTeamClick(g.team)}>
                                <span className="dt-dot" style={{ background: colourOf(g.team) }} aria-hidden="true" />
                                <span className="inj-team-name">{teamByAbbrev(g.team)?.name ?? g.team}</span>
                                <span className="inj-team-count">{g.rows.length}</span>
                                <IconChevronRight size={14} stroke={2} aria-hidden="true" />
                            </button>
                        )}
                        <ul className="team-games">
                            {g.rows.map((r) => (
                                <li key={`${r.team}:${r.name}`}>
                                    <InjuryRow row={r} lang={lang} showTeam={order === 'return'} onClick={r.id ? () => onPlayerClick(r.id) : undefined} />
                                </li>
                            ))}
                        </ul>
                    </section>
                ))
            )}

            {data && (
                <p className="source-note">
                    <IconInfoCircle size={13} stroke={2} aria-hidden="true" />{' '}
                    {fi
                        ? 'NHL ei julkaise loukkaantumistietoja. Lähde: ESPN (epävirallinen), paluupäivät ovat arvioita.'
                        : 'The NHL publishes no injury data. Source: ESPN (unofficial); return dates are estimates.'}
                    {updated && ` ${fi ? 'Päivitetty' : 'Updated'} ${updated.toLocaleString(fi ? 'fi-FI' : 'en-GB', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}.`}
                </p>
            )}
        </div>
    );
}
