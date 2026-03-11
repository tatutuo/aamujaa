import React, { useState, useEffect } from 'react';
import { translations } from '../utils/translations';

const TeamModal = ({ isOpen, onClose, teamAbbrev, onPlayerClick, onGameClick, language }) => {
    const t = translations[language] || translations.fi;
    const [showRoster, setShowRoster] = useState(false);
    const [teamData, setTeamData] = useState({ roster: null, schedule: null });
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!isOpen || !teamAbbrev) return;

        setIsLoading(true);
        setShowRoster(false); 

        Promise.all([
            fetch(`/api/nhl/team/${teamAbbrev}`).then(r => r.json()),
            fetch(`/api/nhl/roster/${teamAbbrev}`).then(r => r.json())
        ])
        .then(([schedData, rosterData]) => {
            setTeamData({ schedule: schedData, roster: rosterData });
            setIsLoading(false);
        })
        .catch(err => {
            console.error("Virhe joukkueen haussa:", err);
            setIsLoading(false);
        });
    }, [isOpen, teamAbbrev]);

    useEffect(() => {
        if (!isLoading && !showRoster && isOpen) {
            setTimeout(() => {
                const activeGame = document.getElementById('current-team-game');
                if (activeGame) {
                    activeGame.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 100);
        }
    }, [isLoading, showRoster, isOpen]);

    if (!isOpen || !teamAbbrev) return null;

    const logoUrl = `https://assets.nhle.com/logos/nhl/svg/${teamAbbrev}_light.svg`;

    let gamesList = [];
    let forwards = teamData.roster?.forwards || [];
    let defense = teamData.roster?.defensemen || [];
    let goalies = teamData.roster?.goalies || [];

    if (teamData.schedule?.games) {
        gamesList = teamData.schedule.games;
    }

    const nextGameId = gamesList.find(g => g.gameState !== "FINAL" && g.gameState !== "OFF")?.id;

    const RosterTag = ({ player }) => (
        <span 
            onClick={() => onPlayerClick(player.playerId || player.id)} 
            style={{ background: '#222', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', transition: 'color 0.2s' }}
            onMouseOver={(e) => e.target.style.color = '#00d4ff'}
            onMouseOut={(e) => e.target.style.color = '#ccc'}
        >
            <span style={{ color: '#888', marginRight: '4px' }}>#{player.sweaterNumber || '-'}</span>
            {player.firstName?.default} {player.lastName?.default}
        </span>
    );

    return (
        <div className="modal-overlay" style={{ display: 'block', position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.9)', zIndex: 99999 }}>
            <div className="modal-content" style={{ margin: '5% auto', padding: '20px', width: '95%', maxWidth: '550px', maxHeight: '90vh', overflowY: 'auto', borderRadius: '10px', position: 'relative' }}>
                
                <span className="close-card-btn" onClick={onClose} style={{ position: 'absolute', right: '15px', top: '10px', fontSize: '2rem', cursor: 'pointer', color: '#888', lineHeight: 1 }}>&times;</span>
                
                <div style={{ textAlign: 'center', marginBottom: '20px', paddingTop: '10px' }}>
                    <img src={logoUrl} style={{ width: '80px' }} alt={teamAbbrev} />
                    <h2 style={{ margin: '10px 0 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                        <button className="fav-sydan" style={{ fontSize: '1.8rem', margin: 0, padding: 0 }}>♡</button>
                        {teamAbbrev}
                    </h2>
                </div>

                <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                    <button className={`sched-filter-btn ${!showRoster ? 'active' : ''}`} onClick={() => setShowRoster(false)} style={{ flex: 1 }}>{t.teamGames}</button>
                    <button className={`sched-filter-btn ${showRoster ? 'active' : ''}`} onClick={() => setShowRoster(true)} style={{ flex: 1 }}>{t.teamRoster}</button>
                </div>

                {isLoading ? (
                    <div className="loading" style={{ textAlign: 'center', padding: '40px', color: 'var(--accent-blue)' }}>{t.teamLoading}</div>
                ) : (
                    <>
                        {showRoster && (
                            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '15px', borderRadius: '8px', border: '1px solid #333' }}>
                                <h4 style={{ color: '#00d4ff', marginTop: 0, borderBottom: '1px solid #444', paddingBottom: '5px' }}>{t.gmForwards}</h4>
                                <div style={{ color: '#ccc', fontSize: '0.9rem', marginBottom: '15px', display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                                    {forwards.map((p, i) => <RosterTag key={i} player={p} />)}
                                </div>
                                <h4 style={{ color: '#4ade80', borderBottom: '1px solid #444', paddingBottom: '5px' }}>{t.gmDefense}</h4>
                                <div style={{ color: '#ccc', fontSize: '0.9rem', marginBottom: '15px', display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                                    {defense.map((p, i) => <RosterTag key={i} player={p} />)}
                                </div>
                                <h4 style={{ color: '#ffcc00', borderBottom: '1px solid #444', paddingBottom: '5px' }}>{t.gmGoalies}</h4>
                                <div style={{ color: '#ccc', fontSize: '0.9rem', display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                                    {goalies.map((p, i) => <RosterTag key={i} player={p} />)}
                                </div>
                            </div>
                        )}

                        {!showRoster && (
                            <div style={{ maxHeight: '55vh', overflowY: 'auto', overflowX: 'hidden' }}>
                                {gamesList.length === 0 && <div style={{ color: '#666', textAlign: 'center', padding: '20px' }}>{t.teamNoGames}</div>}
                                
                                {gamesList.map((g, i) => {
                                    const isPlayed = g.gameState === 'FINAL' || g.gameState === 'OFF';
                                    const homeTeamStr = g.homeTeam?.abbrev || g.homeTeam?.placeName?.default;
                                    const awayTeamStr = g.awayTeam?.abbrev || g.awayTeam?.placeName?.default;
                                    
                                    const isHome = homeTeamStr === teamAbbrev;
                                    const opponent = isHome ? awayTeamStr : homeTeamStr;
                                    const opponentLogo = `https://assets.nhle.com/logos/nhl/svg/${opponent}_light.svg`;
                                    
                                    const teamScore = isHome ? (g.homeTeam?.score ?? 0) : (g.awayTeam?.score ?? 0);
                                    const oppScore = isHome ? (g.awayTeam?.score ?? 0) : (g.homeTeam?.score ?? 0);
                                    
                                    let resultColor = '#666'; 
                                    if (isPlayed) {
                                        resultColor = teamScore > oppScore ? '#4ade80' : '#ff4444';
                                    }
                                    
                                    const gameDate = g.startTimeUTC ? new Date(g.startTimeUTC).toLocaleDateString('fi-FI', { day: 'numeric', month: 'numeric' }) : '-';
                                    const isCurrentGame = g.id === nextGameId;

                                    return (
                                        <div 
                                            key={i} 
                                            id={isCurrentGame ? 'current-team-game' : ''}
                                            onClick={() => onGameClick(g)}
                                            onMouseOver={(e) => { e.currentTarget.style.background = isCurrentGame ? 'rgba(0, 212, 255, 0.2)' : 'rgba(255, 255, 255, 0.05)'; }}
                                            onMouseOut={(e) => { e.currentTarget.style.background = isCurrentGame ? 'rgba(0, 212, 255, 0.1)' : 'transparent'; }}
                                            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 5px', borderBottom: '1px solid #333', background: isCurrentGame ? 'rgba(0, 212, 255, 0.1)' : 'transparent', cursor: 'pointer', transition: 'background 0.2s' }}
                                        >
                                            <div style={{ width: '45px', color: '#888', fontSize: '0.85rem' }}>{gameDate}</div>
                                            
                                            <div style={{ display: 'flex', alignItems: 'center', flex: 1, justifyContent: 'flex-end', gap: '8px' }}>
                                                <span style={{ color: isHome ? '#aaa' : '#fff' }}>{isHome ? opponent : teamAbbrev}</span>
                                                <img src={isHome ? opponentLogo : logoUrl} style={{ width: '24px' }} alt="away" />
                                            </div>
                                            
                                            <div style={{ width: '70px', textAlign: 'center', fontWeight: 'bold', color: resultColor, fontSize: '1rem' }}>
                                                {isPlayed ? `${isHome ? oppScore : teamScore} - ${isHome ? teamScore : oppScore}` : 'vs'}
                                            </div>
                                            
                                            <div style={{ display: 'flex', alignItems: 'center', flex: 1, justifyContent: 'flex-start', gap: '8px' }}>
                                                <img src={isHome ? logoUrl : opponentLogo} style={{ width: '24px' }} alt="home" />
                                                <span style={{ color: isHome ? '#fff' : '#aaa' }}>{isHome ? teamAbbrev : opponent}</span>
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

export default TeamModal;