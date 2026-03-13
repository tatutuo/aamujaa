import React, { useState, useEffect } from 'react';
import { translations } from '../utils/translations';
import TeamBadge from './TeamBadge'; // TUOTU UUSI KOMPONENTTI

const NHL_TEAMS = [
    { name: "Anaheim Ducks", abbrev: "ANA" }, { name: "Boston Bruins", abbrev: "BOS" }, 
    { name: "Buffalo Sabres", abbrev: "BUF" }, { name: "Calgary Flames", abbrev: "CGY" },
    { name: "Carolina Hurricanes", abbrev: "CAR" }, { name: "Chicago Blackhawks", abbrev: "CHI" },
    { name: "Colorado Avalanche", abbrev: "COL" }, { name: "Columbus Blue Jackets", abbrev: "CBJ" },
    { name: "Dallas Stars", abbrev: "DAL" }, { name: "Detroit Red Wings", abbrev: "DET" },
    { name: "Edmonton Oilers", abbrev: "EDM" }, { name: "Florida Panthers", abbrev: "FLA" },
    { name: "Los Angeles Kings", abbrev: "LAK" }, { name: "Minnesota Wild", abbrev: "MIN" },
    { name: "Montréal Canadiens", abbrev: "MTL" }, { name: "Nashville Predators", abbrev: "NSH" },
    { name: "New Jersey Devils", abbrev: "NJD" }, { name: "New York Islanders", abbrev: "NYI" },
    { name: "New York Rangers", abbrev: "NYR" }, { name: "Ottawa Senators", abbrev: "OTT" },
    { name: "Philadelphia Flyers", abbrev: "PHI" }, { name: "Pittsburgh Penguins", abbrev: "PIT" },
    { name: "San Jose Sharks", abbrev: "SJS" }, { name: "Seattle Kraken", abbrev: "SEA" },
    { name: "St. Louis Blues", abbrev: "STL" }, { name: "Tampa Bay Lightning", abbrev: "TBL" },
    { name: "Toronto Maple Leafs", abbrev: "TOR" }, { name: "Utah Hockey Club", abbrev: "UTA" },
    { name: "Vancouver Canucks", abbrev: "VAN" }, { name: "Vegas Golden Knights", abbrev: "VGK" },
    { name: "Washington Capitals", abbrev: "WSH" }, { name: "Winnipeg Jets", abbrev: "WPG" }
];

const LIIGA_TEAMS = [
    { name: "HIFK", abbrev: "HIFK" }, { name: "HPK", abbrev: "HPK" },
    { name: "Ilves", abbrev: "ILV" }, { name: "Jukurit", abbrev: "JUK" },
    { name: "JYP", abbrev: "JYP" }, { name: "KalPa", abbrev: "KAL" },
    { name: "Kiekko-Espoo", abbrev: "K-ESPOO" }, { name: "KooKoo", abbrev: "KOO" },
    { name: "Kärpät", abbrev: "KÄR" }, { name: "Lukko", abbrev: "LUK" },
    { name: "Pelicans", abbrev: "PEL" }, { name: "SaiPa", abbrev: "SAI" },
    { name: "Sport", abbrev: "SPO" }, { name: "Tappara", abbrev: "TAP" },
    { name: "TPS", abbrev: "TPS" }, { name: "Ässät", abbrev: "ÄSS" }
];

const SearchModal = ({ isOpen, onClose, onPlayerClick, onTeamClick, language, activeLeague = 'NHL' }) => {
    const t = translations[language] || translations.fi;
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    const themeColor = activeLeague === 'LIIGA' ? '#ff6600' : 'var(--accent-blue)';

    useEffect(() => {
        if (!query || query.length < 2) {
            setResults([]);
            return;
        }

        const timeoutId = setTimeout(() => {
            setIsLoading(true);
            const qLower = query.toLowerCase();

            if (activeLeague === 'NHL') {
                const teamHits = NHL_TEAMS
                    .filter(team => team.name.toLowerCase().includes(qLower) || team.abbrev.toLowerCase().includes(qLower))
                    .map(team => ({ type: 'JOUKKUE', name: team.name, abbrev: team.abbrev }));

                fetch(`https://search.d3.nhle.com/api/v1/search/player?culture=en-us&limit=15&q=${encodeURIComponent(query)}`)
                    .then(res => res.json())
                    .then(data => {
                        const playerHits = (data || []).map(p => ({
                            type: 'PELAAJA', name: p.name, id: p.playerId, abbrev: p.teamAbbrev
                        }));
                        setResults([...teamHits, ...playerHits]);
                        setIsLoading(false);
                    })
                    .catch(err => {
                        console.error("NHL Pelaajahaku epäonnistui", err);
                        setResults(teamHits); 
                        setIsLoading(false);
                    });

            } else {
                const teamHits = LIIGA_TEAMS
                    .filter(team => team.name.toLowerCase().includes(qLower) || team.abbrev.toLowerCase().includes(qLower))
                    .map(team => ({ type: 'JOUKKUE', name: team.name, abbrev: team.abbrev }));

                fetch('/api/liiga/players')
                    .then(res => res.json())
                    .then(data => {
                        const playerHits = (data || [])
                            .filter(p => `${p.firstName} ${p.lastName}`.toLowerCase().includes(qLower))
                            .map(p => ({
                                type: 'PELAAJA', 
                                name: `${p.firstName} ${p.lastName}`, 
                                id: p.id, 
                                abbrev: p.teamId
                            }));
                        
                        setResults([...teamHits, ...playerHits.slice(0, 15)]); 
                        setIsLoading(false);
                    })
                    .catch(err => {
                        console.error("Liiga pelaajahaku epäonnistui", err);
                        setResults(teamHits);
                        setIsLoading(false);
                    });
            }

        }, 300);

        return () => clearTimeout(timeoutId);
    }, [query, activeLeague]);

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" style={{ display: 'block', position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.95)', zIndex: 100000 }}>
            <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                    <input 
                        autoFocus
                        type="text" 
                        placeholder={activeLeague === 'LIIGA' ? 'Hae Liiga-pelaajaa tai joukkuetta...' : t.searchPlaceholder} 
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        style={{ flex: 1, background: '#222', border: `2px solid ${themeColor}`, color: '#fff', padding: '15px', borderRadius: '12px', fontSize: '1.2rem', outline: 'none', transition: 'border-color 0.3s' }}
                    />
                    <button onClick={() => { setQuery(''); onClose(); }} style={{ background: 'none', border: 'none', color: '#888', fontSize: '2.5rem', cursor: 'pointer' }}>&times;</button>
                </div>

                <div style={{ maxHeight: '75vh', overflowY: 'auto', paddingRight: '10px' }}>
                    {isLoading && <div style={{ color: themeColor, textAlign: 'center', padding: '20px' }}>{t.searchLoading}</div>}
                    
                    {results.length > 0 ? (
                        results.map((res, i) => (
                            <div 
                                key={i} 
                                onClick={() => {
                                    if (res.type === 'PELAAJA' && onPlayerClick) onPlayerClick(res.id);
                                    if (res.type === 'JOUKKUE' && onTeamClick) onTeamClick(res.abbrev);
                                    setQuery('');
                                }}
                                style={{ 
                                    padding: '15px', 
                                    marginBottom: '8px',
                                    background: 'rgba(255,255,255,0.05)', 
                                    borderRadius: '10px',
                                    cursor: 'pointer', 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'space-between',
                                    border: '1px solid #333'
                                }}
                                onMouseOver={(e) => e.currentTarget.style.border = `1px solid ${themeColor}`}
                                onMouseOut={(e) => e.currentTarget.style.border = '1px solid #333'}
                            >
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ fontSize: '0.7rem', color: res.type === 'PELAAJA' ? themeColor : '#ffcc00', fontWeight: 'bold' }}>
                                        {res.type === 'PELAAJA' ? t.searchPlayer : t.searchTeam}
                                    </span>
                                    <span style={{ color: '#fff', fontSize: '1.1rem', fontWeight: 'bold' }}>{res.name}</span>
                                </div>
                                
                                {res.abbrev && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        
                                        {/* KORVATTU NHL LOGO TEAMBADGELLA */}
                                        {res.type === 'JOUKKUE' && activeLeague === 'NHL' && (
                                            <TeamBadge abbrev={res.abbrev} size={30} />
                                        )}
                                        {res.type === 'JOUKKUE' && activeLeague === 'LIIGA' && (
                                            <span style={{ fontSize: '1.5rem' }}>🛡️</span>
                                        )}

                                        <div style={{ background: '#333', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem', color: '#aaa' }}>
                                            {res.abbrev}
                                        </div>

                                    </div>
                                )}
                            </div>
                        ))
                    ) : query.length > 1 && !isLoading && (
                        <div style={{ color: '#555', textAlign: 'center', marginTop: '20px' }}>{t.searchNoResults} "{query}".</div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SearchModal;