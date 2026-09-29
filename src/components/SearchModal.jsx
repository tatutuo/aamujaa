import React, { useEffect, useState } from 'react';
import { IconSearch, IconX, IconClock, IconChevronRight } from '@tabler/icons-react';
import Sheet from './Sheet';
import { api } from '../utils/api';
import { usePersistentState } from '../hooks/usePersistentState';
import { teamColors, DEFAULT_TEAM_COLORS } from '../utils/teamColors';
import { teamNickname } from '../utils/teams';
import { positionLabel } from '../utils/positions';

/**
 * Haku: pelaajat ja joukkueet oman palvelimen kautta.
 *
 * Tyhjällä kentällä näytetään viimeksi avatut, jotta usein katsottu pelaaja
 * löytyy kahdella napautuksella ilman kirjoittamista.
 */

const RECENT_LIMIT = 8;
const colourOf = (abbrev) => (teamColors[abbrev] ?? DEFAULT_TEAM_COLORS)[0];
const keyOf = (r) => `${r.type}-${r.id ?? r.abbrev}`;

export default function SearchModal({ isOpen, onClose, onPlayerClick, onTeamClick, language, zIndex = 99000 }) {
    const fi = language !== 'en';

    return (
        <Sheet isOpen={isOpen} onClose={onClose} zIndex={zIndex} size="full" title={fi ? 'Haku' : 'Search'}>
            {/* Oma komponentti, jotta hakutila nollautuu aina kun paneeli suljetaan. */}
            {isOpen && <SearchContent fi={fi} language={language} onPlayerClick={onPlayerClick} onTeamClick={onTeamClick} />}
        </Sheet>
    );
}

function SearchContent({ fi, language, onPlayerClick, onTeamClick }) {
    const [query, setQuery] = useState('');
    const [state, setState] = useState({ results: [], isLoading: false, error: null, for: '' });
    const [recent, setRecent] = usePersistentState('pucknower_recent_search', []);

    const trimmed = query.trim();

    useEffect(() => {
        if (trimmed.length < 2) return undefined;
        const controller = new AbortController();
        const timer = setTimeout(() => {
            setState((s) => ({ ...s, isLoading: true, error: null }));
            api.search(trimmed, { signal: controller.signal })
                .then((results) => setState({ results, isLoading: false, error: null, for: trimmed }))
                .catch((err) => {
                    if (err.name === 'AbortError') return;
                    setState({ results: [], isLoading: false, error: err.message, for: trimmed });
                });
        }, 250);
        return () => { clearTimeout(timer); controller.abort(); };
    }, [trimmed]);

    const open = (result) => {
        setRecent((list) => [result, ...list.filter((r) => keyOf(r) !== keyOf(result))].slice(0, RECENT_LIMIT));
        if (result.type === 'PELAAJA') onPlayerClick?.(result.id);
        else onTeamClick?.(result.abbrev);
    };

    const searching = trimmed.length >= 2;
    const results = searching ? state.results : [];
    const teams = results.filter((r) => r.type === 'JOUKKUE');
    const players = results.filter((r) => r.type === 'PELAAJA');

    return (
        <div className="search2">
            <label className="search-field search2-field">
                <IconSearch size={18} stroke={1.9} aria-hidden="true" />
                <input
                    autoFocus
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={fi ? 'Pelaaja tai joukkue' : 'Player or team'}
                    aria-label={fi ? 'Hae pelaajaa tai joukkuetta' : 'Search players or teams'}
                    autoComplete="off"
                    spellCheck={false}
                    enterKeyHint="search"
                />
                {query && (
                    <button type="button" className="search-clear" onClick={() => setQuery('')} aria-label={fi ? 'Tyhjennä' : 'Clear'}>
                        <IconX size={14} stroke={2} aria-hidden="true" />
                    </button>
                )}
            </label>

            {!searching && (
                recent.length > 0 ? (
                    <section className="search2-group">
                        <div className="card-section-head">
                            <h3 className="card-section-title">{fi ? 'Viimeksi avatut' : 'Recent'}</h3>
                            <button type="button" className="link-button search2-clear" onClick={() => setRecent([])}>
                                {fi ? 'Tyhjennä' : 'Clear'}
                            </button>
                        </div>
                        <ResultList items={recent} fi={fi} language={language} onOpen={open} recentIcon />
                    </section>
                ) : (
                    <p className="panel-hint">{fi ? 'Kirjoita vähintään kaksi kirjainta. Haku löytää myös uransa lopettaneet.' : 'Type at least two letters. Retired players are included.'}</p>
                )
            )}

            {searching && state.isLoading && results.length === 0 && <div className="loading-line" />}
            {searching && state.error && <p className="notice">{state.error}</p>}

            {teams.length > 0 && (
                <section className="search2-group">
                    <h3 className="card-section-title">{fi ? 'Joukkueet' : 'Teams'}</h3>
                    <ResultList items={teams} fi={fi} language={language} onOpen={open} />
                </section>
            )}
            {players.length > 0 && (
                <section className="search2-group">
                    <h3 className="card-section-title">{fi ? 'Pelaajat' : 'Players'}</h3>
                    <ResultList items={players} fi={fi} language={language} onOpen={open} />
                </section>
            )}

            {searching && !state.isLoading && !state.error && state.for === trimmed && results.length === 0 && (
                <p className="panel-hint">{fi ? `Ei tuloksia haulla “${trimmed}”.` : `No results for “${trimmed}”.`}</p>
            )}
        </div>
    );
}

function ResultList({ items, fi, language, onOpen, recentIcon }) {
    return (
        <ul className="search2-list">
            {items.map((r) => {
                const isPlayer = r.type === 'PELAAJA';
                const meta = isPlayer
                    ? [r.abbrev, positionLabel(r.position, language), r.active === false && (fi ? 'ura päättynyt' : 'retired')].filter(Boolean).join(' · ')
                    : `${fi ? 'Joukkue' : 'Team'} · ${teamNickname(r.abbrev)}`;
                return (
                    <li key={keyOf(r)}>
                        <button type="button" className="search2-item" onClick={() => onOpen(r)}>
                            {recentIcon
                                ? <IconClock size={16} stroke={1.9} className="search2-icon" aria-hidden="true" />
                                : <span className="dt-dot" style={{ background: r.abbrev ? colourOf(r.abbrev) : 'var(--border-strong)' }} aria-hidden="true" />}
                            <span className="dt-person-text">
                                <span className="dt-name">{r.name}</span>
                                <span className="dt-meta">{meta}</span>
                            </span>
                            <IconChevronRight size={16} stroke={2} className="search2-chevron" aria-hidden="true" />
                        </button>
                    </li>
                );
            })}
        </ul>
    );
}
