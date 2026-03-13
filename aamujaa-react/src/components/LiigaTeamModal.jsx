import React, { useState, useEffect } from 'react';
import TeamBadge from './TeamBadge'; // LISÄTTY

// Apufunktio
const getBadgeAbbrev = (name) => {
    if (!name) return '';
    let n = name.toUpperCase();
    if (n.includes(':')) n = n.split(':').pop().trim();
    if (n === 'HIFK' || n === 'HPK' || n === 'JYP' || n === 'TPS') return n;
    if (n === 'KIEKKO-ESPOO') return 'K-E';
    return n.substring(0, 3); 
};

const LiigaTeamModal = ({ isOpen, onClose, teamAbbrev, onPlayerClick, favTeams, toggleFavTeam}) => {
    const [showRoster, setShowRoster] = useState(false);
    const [teamData, setTeamData] = useState({ schedule: [], roster: [] });
    const [isLoading, setIsLoading] = useState(true);

    const cleanSearchTerm = (term) => {
        if (!term) return '';
        let cleaned = term;
        if (cleaned.includes(':')) {
            const parts = cleaned.split(':');
            cleaned = parts.find(p => /[a-zA-Z]/.test(p)) || parts[0];
        }
        return cleaned.toUpperCase();
    };

    const safeTeamName = cleanSearchTerm(teamAbbrev);

    useEffect(() => {
        if (!isOpen || !safeTeamName) return;
        setIsLoading(true);
        setShowRoster(false); 
        fetch(`/api/liiga/team/${safeTeamName}`)
            .then(r => r.json())
            .then(data => {
                setTeamData(data);
                setIsLoading(false);
            })
            .catch(err => {
                console.error("Virhe Liigan joukkueen haussa:", err);
                setIsLoading(false);
            });
    }, [isOpen, safeTeamName]);

    useEffect(() => {
        if (!isLoading && !showRoster && isOpen) {
            setTimeout(() => {
                const activeGame = document.getElementById('current-liiga-team-game');
                if (activeGame) {
                    activeGame.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 100);
        }
    }, [isLoading, showRoster, isOpen]);

    if (!isOpen) return null;

    const TEAM_MAP = {
        "HIFK": "HIFK", "HPK": "HPK", "ILV": "ILVES", "JUK": "JUKURIT",
        "JYP": "JYP", "KAL": "KALPA", "K-ESPOO": "KIEKKO-ESPOO", "KOO": "KOOKOO",
        "KÄR": "KÄRPÄT", "LUK": "LUKKO", "PEL": "PELICANS", "SAI": "SAIPA",
        "SPO": "SPORT", "TAP": "TAPPARA", "TPS": "TPS", "ÄSS": "ÄSSÄT"
    };
    const officialName = TEAM_MAP[safeTeamName] || safeTeamName;

    const forwards = teamData.roster.filter(p => p.role === 'ATTACKER' || p.role === 'FORWARD' || p.position === 'HYÖKKÄÄJÄ').sort((a, b) => a.jersey - b.jersey);
    const defense = teamData.roster.filter(p => p.role === 'DEFENSEMAN' || p.role === 'DEFENSE' || p.position === 'PUOLUSTAJA').sort((a, b) => a.jersey - b.jersey);
    const goalies = teamData.roster.filter(p => p.role === 'GOALKEEPER' || p.role === 'GOALIE' || p.position === 'MAALIVAHTI').sort((a, b) => a.jersey - b.jersey);

    const nextGameId = teamData.schedule.find(g => !g.ended && !g.started)?.id || null;

    const RosterTag = ({ player }) => (
        <span 
            onClick={() => onPlayerClick(player.id || player.playerId)} 
            style={{ background: '#222', padding: '6px 10px', borderRadius: '4px', cursor: 'pointer', transition: 'all 0.2s', border: '1px solid #333' }}
            onMouseOver={(e) => { e.target.style.borderColor = '#ff6600'; e.target.style.color = '#fff'; }}
            onMouseOut={(e) => { e.target.style.borderColor = '#333'; e.target.style.color = '#ccc'; }}
        >
            <span style={{ color: '#ff6600', marginRight: '5px', fontWeight: 'bold' }}>#{player.jersey || player.sweaterNumber || '-'}</span>
            {player.firstName} {player.lastName}
        </span>
    );

    return (
        <div className="modal-overlay" style={{ display: 'block', position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.9)', zIndex: 99999 }}>
            <div className="modal-content" style={{ margin: '5% auto', padding: '20px', width: '95%', maxWidth: '550px', maxHeight: '90vh', overflowY: 'auto', background: '#111', borderRadius: '10px', borderTop: '4px solid #ff6600', position: 'relative' }}>
                
                <span onClick={onClose} style={{ position: 'absolute', right: '15px', top: '10px', fontSize: '2rem', cursor: 'pointer', color: '#888', lineHeight: 1 }}>&times;</span>
                
                <div style={{ textAlign: 'center', marginBottom: '20px', borderBottom: '1px solid #333', paddingBottom: '20px' }}>
                    
                    {/* TEAMBADGE KORVAA LOGON */}
                    <TeamBadge abbrev={getBadgeAbbrev(officialName)} size={80} style={{ margin: '0 auto 10px auto', fontSize: '30px' }} />
                    
                    <h2 style={{ margin: '0', color: '#fff', fontSize: '1.8rem', letterSpacing: '2px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                        <button 
                            onClick={() => toggleFavTeam && toggleFavTeam(officialName)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: favTeams?.includes(officialName) ? '#ff4444' : '#555', fontSize: '1.8rem', padding: 0 }}
                        >
                            {favTeams?.includes(officialName) ? '♥' : '♡'}
                        </button>
                        {officialName}
                    </h2>
                </div>

                <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                    <button onClick={() => setShowRoster(false)} style={{ flex: 1, padding: '10px', borderRadius: '20px', fontWeight: 'bold', border: 'none', cursor: 'pointer', transition: '0.2s', background: !showRoster ? '#ff6600' : '#222', color: !showRoster ? '#000' : '#fff' }}>OTTELUT</button>
                    <button onClick={() => setShowRoster(true)} style={{ flex: 1, padding: '10px', borderRadius: '20px', fontWeight: 'bold', border: 'none', cursor: 'pointer', transition: '0.2s', background: showRoster ? '#ff6600' : '#222', color: showRoster ? '#000' : '#fff' }}>KOKOONPANO</button>
                </div>

                {isLoading ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#ff6600', animation: 'pulse 1s infinite' }}>Ladataan joukkuetta...</div>
                ) : (
                    <>
                        {showRoster && (
                            <div style={{ padding: '0 5px' }}>
                                {teamData.roster.length === 0 ? (
                                    <div style={{ textAlign: 'center', color: '#666', padding: '20px' }}>Kokoonpanoa ei löytynyt viimeisimmästä pelistä.</div>
                                ) : forwards.length > 0 ? (
                                    <>
                                        <h4 style={{ color: '#00d4ff', borderBottom: '1px solid #444', paddingBottom: '5px', marginTop: 0 }}>HYÖKKÄÄJÄT</h4>
                                        <div style={{ color: '#ccc', fontSize: '0.9rem', marginBottom: '20px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                            {forwards.map((p, i) => <RosterTag key={i} player={p} />)}
                                        </div>
                                        <h4 style={{ color: '#4ade80', borderBottom: '1px solid #444', paddingBottom: '5px' }}>PUOLUSTAJAT</h4>
                                        <div style={{ color: '#ccc', fontSize: '0.9rem', marginBottom: '20px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                            {defense.map((p, i) => <RosterTag key={i} player={p} />)}
                                        </div>
                                        <h4 style={{ color: '#ffcc00', borderBottom: '1px solid #444', paddingBottom: '5px' }}>MAALIVAHDIT</h4>
                                        <div style={{ color: '#ccc', fontSize: '0.9rem', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                            {goalies.map((p, i) => <RosterTag key={i} player={p} />)}
                                        </div>
                                    </>
                                ) : (
                                    <div style={{ color: '#ccc', fontSize: '0.9rem', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                        {teamData.roster.map((p, i) => <RosterTag key={i} player={p} />)}
                                    </div>
                                )}
                            </div>
                        )}

                        {!showRoster && (
                            <div style={{ maxHeight: '55vh', overflowY: 'auto', overflowX: 'hidden' }}>
                                {teamData.schedule.length === 0 && <div style={{ color: '#666', textAlign: 'center', padding: '20px' }}>Ei pelejä.</div>}
                                
                                {teamData.schedule.map((g, i) => {
                                    const isPlayed = g.started || g.ended;
                                    const homeName = cleanSearchTerm(g.homeTeam?.teamName);
                                    const awayName = cleanSearchTerm(g.awayTeam?.teamName);
                                    
                                    const homeScore = g.homeTeam?.goals;
                                    const awayScore = g.awayTeam?.goals;
                                    
                                    const isHomeTeamOurTeam = homeName === officialName;
                                    const isAwayTeamOurTeam = awayName === officialName;
                                    
                                    let resultColor = '#666'; 
                                    if (isPlayed && homeScore !== undefined && awayScore !== undefined) {
                                        if (isHomeTeamOurTeam) resultColor = homeScore > awayScore ? '#4ade80' : (homeScore < awayScore ? '#ff4444' : '#fff');
                                        else if (isAwayTeamOurTeam) resultColor = awayScore > homeScore ? '#4ade80' : (awayScore < homeScore ? '#ff4444' : '#fff');
                                    }
                                    
                                    let extraTimeStr = '';
                                    if (isPlayed && g.period) {
                                        if (g.period === 4) extraTimeStr = 'JA';
                                        if (g.period === 5) extraTimeStr = 'VL';
                                    } else if (g.resolvedIn === 'OVERTIME') extraTimeStr = 'JA';
                                    else if (g.resolvedIn === 'WINNING_SHOTS') extraTimeStr = 'VL';

                                    const gameDate = new Date(g.start).toLocaleDateString('fi-FI', { day: 'numeric', month: 'numeric' });
                                    const isCurrentGame = g.id === nextGameId;

                                    return (
                                        <div 
                                            key={i} 
                                            id={isCurrentGame ? 'current-liiga-team-game' : ''}
                                            style={{ 
                                                display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 5px', 
                                                borderBottom: '1px solid #222', background: isCurrentGame ? 'rgba(255, 102, 0, 0.15)' : 'transparent'
                                            }}
                                        >
                                            <div style={{ width: '45px', color: '#888', fontSize: '0.85rem' }}>{gameDate}</div>
                                            
                                            <div style={{ display: 'flex', alignItems: 'center', flex: 1, justifyContent: 'flex-end', gap: '8px' }}>
                                                <span style={{ color: isHomeTeamOurTeam ? '#fff' : '#aaa', fontWeight: isHomeTeamOurTeam ? 'bold' : 'normal', fontSize: '0.9rem' }}>
                                                    {homeName}
                                                </span>
                                                {/* TEAMBADGE (PIENI, KOTI) */}
                                                <TeamBadge abbrev={getBadgeAbbrev(homeName)} size={20} />
                                            </div>
                                            
                                            <div style={{ width: '80px', textAlign: 'center', fontWeight: 'bold', color: resultColor, fontSize: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                                                {isPlayed ? `${homeScore} - ${awayScore}` : 'vs'}
                                                {extraTimeStr && <span style={{ fontSize: '0.65rem', color: '#888', marginTop: '-2px' }}>{extraTimeStr}</span>}
                                            </div>
                                            
                                            <div style={{ display: 'flex', alignItems: 'center', flex: 1, justifyContent: 'flex-start', gap: '8px' }}>
                                                {/* TEAMBADGE (PIENI, VIERAS) */}
                                                <TeamBadge abbrev={getBadgeAbbrev(awayName)} size={20} />
                                                <span style={{ color: isAwayTeamOurTeam ? '#fff' : '#aaa', fontWeight: isAwayTeamOurTeam ? 'bold' : 'normal', fontSize: '0.9rem' }}>
                                                    {awayName}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default LiigaTeamModal;