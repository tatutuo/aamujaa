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
import { shortDate } from '../utils/format';
import { nationPlural } from '../utils/nations';
import { teamByAbbrev, teamNickname } from '../utils/teams';
import { teamColors, DEFAULT_TEAM_COLORS } from '../utils/teamColors';
import { routeOf } from '../router/routes';
import { positionLabel } from '../utils/positions';

/** ESPN:n pelipaikat NHL:n koodeiksi. */
const ESPN_POSITIONS = { LW: 'L', RW: 'R', C: 'C', D: 'D', G: 'G', F: 'C' };

/**
 * Loukkaantumiset.
 *
 * NHL ei julkaise loukkaantumistietoja, joten lähde on ESPN. Tiedot eivät
 * ole virallisia, ja paluuarviot ovat arvioita — siksi ne näytetään
 * "arvio"-sanalla eikä varmana päivänä.
 */

const colourOf = (abbrev) => (teamColors[abbrev] ?? DEFAULT_TEAM_COLORS)[0];

const STATUS = {
    'IR-LT': { fi: 'Pitkäaikainen IR', en: 'Long-term IR', tone: 'long' },
    IR: { fi: 'Loukkaantuneiden lista', en: 'Injured reserve', tone: 'long' },
    'IR-NR': { fi: 'Loukkaantuneiden lista', en: 'Injured reserve', tone: 'long' },
    'Day-To-Day': { fi: 'Päivä kerrallaan', en: 'Day-to-day', tone: 'short' },
    OUT: { fi: 'Sivussa', en: 'Out', tone: 'out' },
};

const INJURY_TYPES = {
    'Lower Body': 'Alavartalo', 'Upper Body': 'Ylävartalo', Undisclosed: 'Ei kerrottu', Knee: 'Polvi',
    Shoulder: 'Olkapää', Hip: 'Lonkka', Abdomen: 'Vatsa', Concussion: 'Aivotärähdys', Foot: 'Jalkaterä',
    Personal: 'Henkilökohtainen syy', 'Lower Leg': 'Sääri', Groin: 'Nivus', Pectoral: 'Rintalihas', Hand: 'Käsi',
    Back: 'Selkä', Ankle: 'Nilkka', Wrist: 'Ranne', Illness: 'Sairaus', Head: 'Pää', Leg: 'Jalka',
    Achilles: 'Akillesjänne', Elbow: 'Kyynärpää', Neck: 'Niska', Face: 'Kasvot', Hamstring: 'Takareisi',
    Thumb: 'Peukalo', Finger: 'Sormi', Rib: 'Kylkiluu', Oblique: 'Kylki', Calf: 'Pohje', Arm: 'Käsivarsi',
    Eye: 'Silmä', Jaw: 'Leuka', Collarbone: 'Solisluu', Chest: 'Rintakehä', Quadriceps: 'Etureisi',
    Suspension: 'Pelikielto', 'Contract Dispute': 'Sopimuskiista', 'Not Injury Related': 'Muu kuin loukkaantuminen',
    Heel: 'Kantapää', Toe: 'Varvas', Forearm: 'Kyynärvarsi', Spleen: 'Perna', Lung: 'Keuhko', Nose: 'Nenä',
};

function statusOf(row, lang) {
    if (row.status === 'Suspension') return { label: lang === 'en' ? 'Suspended' : 'Pelikielto', tone: 'out' };
    const s = STATUS[row.statusCode] ?? STATUS[row.status];
    return s ? { label: s[lang], tone: s.tone } : { label: row.status, tone: 'out' };
}

const typeOf = (row, lang) => {
    // Pelikielto näkyy jo tilassa; ei toisteta sitä vammana.
    if (!row.type || row.status === 'Suspension') return null;
    return lang === 'en' ? row.type : (INJURY_TYPES[row.type] ?? row.type);
};

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

function InjuryRow({ row, lang, showTeam, onClick }) {
    const fi = lang === 'fi';
    const status = statusOf(row, lang);
    const type = typeOf(row, lang);
    const Tag = onClick ? 'button' : 'div';

    return (
        <Tag type={onClick ? 'button' : undefined} className="inj-row" onClick={onClick}>
            <span className="dt-person-text">
                <span className="dt-name">{row.name}</span>
                <span className="dt-meta">
                    {[showTeam && `${row.team} ${teamNickname(row.team)}`, positionLabel(ESPN_POSITIONS[row.pos] ?? row.pos, lang), type].filter(Boolean).join(' · ')}
                </span>
            </span>
            <span className="inj-side">
                <span className={`inj-status tone-${status.tone}`}>{status.label}</span>
                <span className="inj-return">
                    {row.returnDate ? `${fi ? 'arvio' : 'est.'} ${shortDate(row.returnDate, lang)}` : (fi ? 'ei arviota' : 'no estimate')}
                </span>
            </span>
        </Tag>
    );
}
