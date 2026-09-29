import React, { useMemo, useState } from 'react';
import { IconTrophy, IconChevronRight } from '@tabler/icons-react';
import ViewHeader from '../components/shell/ViewHeader';
import Segmented from '../components/ui/Segmented';
import Chips from '../components/ui/Chips';
import { useApi } from '../hooks/useApi';
import { usePersistentState } from '../hooks/usePersistentState';
import { useSettings } from '../state/settings';
import { api } from '../utils/api';
import { seasonLabel } from '../utils/format';
import { nationPlural } from '../utils/nations';
import { teamColors, DEFAULT_TEAM_COLORS } from '../utils/teamColors';
import { routeOf } from '../router/routes';

/**
 * Historia: Stanley Cup -mestarit ja yksilöpalkintojen voittajat.
 *
 * Palkintolistassa seurattujen maiden pelaajat merkitään, jolloin näkee
 * yhdellä silmäyksellä esimerkiksi suomalaisten Selke- ja Vezina-palkinnot.
 */

const colourOf = (abbrev) => (teamColors[abbrev] ?? DEFAULT_TEAM_COLORS)[0];

export default function HistoryView({ onPlayerClick, onTeamClick }) {
    const { language } = useSettings();
    const lang = language === 'en' ? 'en' : 'fi';
    const fi = lang === 'fi';
    const route = routeOf('/lisaa/historia');
    const [tab, setTab] = usePersistentState('pucknower_history_tab', 'cup');

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
                        { value: 'cup', label: 'Stanley Cup' },
                        { value: 'awards', label: fi ? 'Palkinnot' : 'Awards' },
                    ]}
                />
            </div>
            {tab === 'cup' ? <CupTab lang={lang} onTeamClick={onTeamClick} /> : <AwardsTab lang={lang} onPlayerClick={onPlayerClick} />}
            <p className="source-note">{fi ? 'Lähde: records.nhl.com' : 'Source: records.nhl.com'}</p>
        </div>
    );
}

function CupTab({ lang, onTeamClick }) {
    const fi = lang === 'fi';
    const { favTeams } = useSettings();
    const { data, error } = useApi((signal) => api.cupHistory({ signal }), []);

    const leaders = useMemo(() => {
        const counts = new Map();
        for (const s of data ?? []) {
            const key = s.winner.abbrev ?? s.winner.name;
            counts.set(key, { name: s.winner.name, abbrev: s.winner.abbrev, count: (counts.get(key)?.count ?? 0) + 1 });
        }
        return [...counts.values()].filter((c) => c.abbrev).sort((a, b) => b.count - a.count).slice(0, 6);
    }, [data]);

    if (error && !data) return <p className="panel-hint">{fi ? 'Historian haku epäonnistui.' : 'Could not load history.'}</p>;
    if (!data) return <div className="skeleton" style={{ height: 480 }} />;

    return (
        <>
            <div className="award-counts">
                {leaders.map((c) => (
                    <button key={c.abbrev} type="button" className="award" onClick={() => onTeamClick(c.abbrev)}>
                        <span className="dt-dot" style={{ background: colourOf(c.abbrev) }} aria-hidden="true" />
                        {c.abbrev} <strong>{c.count}</strong>
                    </button>
                ))}
            </div>
            <ul className="team-games">
                {data.map((s) => {
                    const fav = favTeams.includes(s.winner.abbrev);
                    return (
                        <li key={s.season}>
                            <div className={`cup-row ${fav ? 'is-fav' : ''}`}>
                                <span className="tg-date">{seasonLabel(s.season)}</span>
                                <span className="dt-person-text">
                                    <span className="dt-name cup-winner">
                                        {s.winner.abbrev && <span className="dt-dot" style={{ background: colourOf(s.winner.abbrev) }} aria-hidden="true" />}
                                        {s.winner.abbrev
                                            ? <button type="button" className="link-button" onClick={() => onTeamClick(s.winner.abbrev)}>{s.winner.name}</button>
                                            : s.winner.name}
                                    </span>
                                    {s.runnerUp && (
                                        <span className="dt-meta">{fi ? 'Finaalissa' : 'Final vs'} {s.runnerUp.name}</span>
                                    )}
                                </span>
                                <IconTrophy size={16} stroke={1.8} className="cup-icon" aria-hidden="true" />
                            </div>
                        </li>
                    );
                })}
            </ul>
        </>
    );
}

function AwardsTab({ lang, onPlayerClick }) {
    const fi = lang === 'fi';
    const { settings } = useSettings();
    const nations = settings.nationalities?.length ? settings.nationalities : ['FIN'];
    const [trophyKey, setTrophyKey] = usePersistentState('pucknower_history_trophy', 'hart');

    const { data: trophies } = useApi((signal) => api.trophies({ signal }), []);
    const trophy = trophies?.find((t) => t.key === trophyKey) ?? trophies?.[0];

    const { data: winners, error } = useApi(
        (signal) => (trophy ? api.awardWinners(trophy.id, { signal }) : Promise.resolve(null)),
        [trophy?.id],
    );

    // Seurattujen maiden palkitut: palkinto + kausi -> maakoodi.
    const { data: marks } = useApi(
        (signal) => Promise.all(nations.map((code) => api.nationAwards(code, { signal })
            .then((list) => list.map((a) => [`${a.trophy}-${a.season}`, code]))
            .catch(() => [])))
            .then((lists) => new Map(lists.flat())),
        [nations.join(',')],
    );

    const [onlyMarked, setOnlyMarked] = useState(false);
    const list = (winners ?? []).filter((w) => !onlyMarked || marks?.has(`${trophy?.key}-${w.season}`));

    return (
        <>
            {trophies && (
                <div className="nat-filter">
                    <Chips
                        label={fi ? 'Palkinto' : 'Award'}
                        value={trophy?.key}
                        onChange={setTrophyKey}
                        options={trophies.map((t) => ({ value: t.key, label: t.name.replace(/^(Maurice “Rocket” |James |Frank J\. |Bill |Lady )/, '').replace(/ (Memorial )?(Trophy|Award)$/, '') }))}
                    />
                    <Chips
                        label={fi ? 'Rajaus' : 'Filter'}
                        value={onlyMarked ? 'marked' : 'all'}
                        onChange={(v) => setOnlyMarked(v === 'marked')}
                        options={[
                            { value: 'all', label: fi ? 'Kaikki voittajat' : 'All winners' },
                            { value: 'marked', label: nations.length === 1 ? nationPlural(nations[0], lang) : (fi ? 'Seuratut maat' : 'Followed countries') },
                        ]}
                    />
                </div>
            )}

            {trophy && (
                <p className="history-trophy">
                    <IconTrophy size={16} stroke={1.8} aria-hidden="true" />
                    <strong>{trophy.name}</strong>{fi && ` · ${trophy.fi}`}
                </p>
            )}

            {error && !winners ? (
                <p className="panel-hint">{fi ? 'Voittajien haku epäonnistui.' : 'Could not load winners.'}</p>
            ) : !winners ? (
                <div className="skeleton" style={{ height: 420 }} />
            ) : list.length === 0 ? (
                <p className="panel-hint">{fi ? 'Ei voittajia tällä rajauksella.' : 'No winners with this filter.'}</p>
            ) : (
                <ul className="team-games">
                    {list.map((w) => {
                        const nat = marks?.get(`${trophy.key}-${w.season}`);
                        return (
                            <li key={w.season}>
                                <button type="button" className={`team-game award-row ${nat ? 'is-marked' : ''}`} onClick={() => onPlayerClick(w.id)}>
                                    <span className="tg-date">{seasonLabel(w.season)}</span>
                                    <span className="dt-person-text">
                                        <span className="dt-name">
                                            {w.name}
                                            {nat && <span className="dt-tag">{nat}</span>}
                                        </span>
                                    </span>
                                    <IconChevronRight size={16} stroke={2} className="search2-chevron" aria-hidden="true" />
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}
        </>
    );
}
