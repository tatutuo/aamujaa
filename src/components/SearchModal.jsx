import React, { useState, useEffect } from 'react';
import { translations } from '../utils/translations';
import { api } from '../utils/api';
import TeamBadge from './TeamBadge';

/**
 * Haku.
 *
 * Muutokset vanhaan: joukkuelista tuli aiemmin kahdesta paikasta (tämä tiedosto
 * ja backend), ja pelaajahaku meni suoraan NHL:n hakupalveluun selaimesta ohi
 * oman palvelimen — eli ilman välimuistia ja käyttäjän IP paljastuen kolmannelle
 * osapuolelle. Nyt kaikki tulee omalta backendiltä yhdellä kutsulla.
 */
const SearchModal = ({ isOpen, onClose, onPlayerClick, onTeamClick, language, zIndex = 99000 }) => {
    const t = translations[language] || translations.fi;
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!isOpen) {
            setQuery('');
            setResults([]);
            setError(null);
        }
    }, [isOpen]);

    useEffect(() => {
        if (query.trim().length < 2) {
            setResults([]);
            setError(null);
            return undefined;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
            setIsLoading(true);
            setError(null);

            api.search(query.trim(), { signal: controller.signal })
                .then((data) => {
                    setResults(data);
                    setIsLoading(false);
                })
                .catch((err) => {
                    if (err.name === 'AbortError') return;
                    setError(err.message);
                    setResults([]);
                    setIsLoading(false);
                });
        }, 300);

        return () => {
            clearTimeout(timeoutId);
            controller.abort();
        };
    }, [query]);

    if (!isOpen) return null;

    const handleSelect = (result) => {
        if (result.type === 'PELAAJA' && onPlayerClick) onPlayerClick(result.id);
        if (result.type === 'JOUKKUE' && onTeamClick) onTeamClick(result.abbrev);
        setQuery('');
    };

    return (
        <div className="modal-overlay search-overlay" style={{ zIndex }} role="dialog" aria-modal="true">
            <div className="search-panel">
                <div className="search-input-row">
                    <input
                        autoFocus
                        type="search"
                        className="search-input"
                        placeholder={t.searchPlaceholder}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        aria-label={t.searchPlaceholder}
                    />
                    <button
                        type="button"
                        className="search-close"
                        onClick={onClose}
                        aria-label={language === 'fi' ? 'Sulje' : 'Close'}
                    >
                        &times;
                    </button>
                </div>

                <div className="search-results">
                    {isLoading && <div className="search-status">{t.searchLoading}</div>}
                    {error && <div className="search-status search-status-error">{error}</div>}

                    {results.map((result) => (
                        <button
                            type="button"
                            key={`${result.type}-${result.id ?? result.abbrev}`}
                            className="search-result"
                            onClick={() => handleSelect(result)}
                        >
                            <span className="search-result-text">
                                <span className={`search-result-type ${result.type === 'PELAAJA' ? 'is-player' : 'is-team'}`}>
                                    {result.type === 'PELAAJA' ? t.searchPlayer : t.searchTeam}
                                    {result.active === false && (language === 'fi' ? ' · ura päättynyt' : ' · retired')}
                                </span>
                                <span className="search-result-name">{result.name}</span>
                            </span>

                            {result.abbrev && (
                                <span className="search-result-team">
                                    {result.type === 'JOUKKUE' && <TeamBadge abbrev={result.abbrev} size={30} />}
                                    <span className="search-result-abbrev">{result.abbrev}</span>
                                </span>
                            )}
                        </button>
                    ))}

                    {!isLoading && !error && query.trim().length > 1 && results.length === 0 && (
                        <div className="search-status">{t.searchNoResults} &ldquo;{query}&rdquo;.</div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SearchModal;
