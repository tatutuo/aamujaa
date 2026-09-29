import React, { useState, useEffect } from 'react';
import { translations } from '../utils/translations';
import TeamBadge from './TeamBadge';
import { api } from '../utils/api';
import { useFetchWhenOpen } from '../hooks/useModal';
import Sheet from './Sheet';
import { teamColors } from '../utils/teamColors';

const TeamModal = ({ isOpen, onClose, teamAbbrev, onPlayerClick, onGameClick, language, zIndex = 99000 }) => {
    const t = translations[language] || translations.fi;
    const [showRoster, setShowRoster] = useState(false);

    const { data, isLoading } = useFetchWhenOpen(
        isOpen && Boolean(teamAbbrev),
        (signal) => Promise.all([
            api.team(teamAbbrev, { signal }),
            api.roster(teamAbbrev, { signal }),
        ]).then(([schedule, roster]) => ({ schedule, roster })),
        [teamAbbrev],
    );

    const teamData = data ?? { roster: null, schedule: null };

    useEffect(() => {
        setShowRoster(false);
    }, [teamAbbrev]);

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
            style={{ background: 'var(--surface-sunken)', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', transition: 'color 0.2s' }}
            onMouseOver={(e) => e.target.style.color = 'var(--accent-text)'}
            onMouseOut={(e) => e.target.style.color = 'var(--text-secondary)'}
        >
            <span style={{ color: 'var(--text-tertiary)', marginRight: '4px' }}>#{player.sweaterNumber || '-'}</span>
            {player.firstName?.default} {player.lastName?.default}
        </span>
    );

    return (
        <Sheet
            isOpen={isOpen}
            onClose={onClose}
            zIndex={zIndex}
            size="full"
            accent={teamColors[teamAbbrev]?.[0]}
            title={teamAbbrev}
        >
            <>
                
                <div style={{ textAlign: 'center', marginBottom: '20px', paddingTop: '10px' }}>
                    
                    {/* ISO LOGO KORVATTU TEAMBADGELLA */}
                    <TeamBadge abbrev={teamAbbrev} size={80} style={{ margin: '0 auto', fontSize: '30px' }} />
                    
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
                            <div style={{ background: 'var(--surface-sunken)', padding: '15px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                                <h4 style={{ color: 'var(--accent-text)', marginTop: 0, borderBottom: '1px solid var(--border-strong)', paddingBottom: '5px' }}>{t.gmForwards}</h4>
                                <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '15px', display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                                    {forwards.map((p, i) => <RosterTag key={i} player={p} />)}
                                </div>
                                <h4 style={{ color: 'var(--positive)', borderBottom: '1px solid var(--border-strong)', paddingBottom: '5px' }}>{t.gmDefense}</h4>
                                <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '15px', display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                                    {defense.map((p, i) => <RosterTag key={i} player={p} />)}
                                </div>
                                <h4 style={{ color: 'var(--gold)', borderBottom: '1px solid var(--border-strong)', paddingBottom: '5px' }}>{t.gmGoalies}</h4>
                                <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                                    {goalies.map((p, i) => <RosterTag key={i} player={p} />)}
                                </div>
                            </div>
                        )}

                        {!showRoster && (
                            <div style={{ maxHeight: '55vh', overflowY: 'auto', overflowX: 'hidden' }}>
                                {gamesList.length === 0 && <div style={{ color: 'var(--text-tertiary)', textAlign: 'center', padding: '20px' }}>{t.teamNoGames}</div>}
                                
                                {gamesList.map((g, i) => {
                                    const isPlayed = g.gameState === 'FINAL' || g.gameState === 'OFF';
                                    const homeTeamStr = g.homeTeam?.abbrev || g.homeTeam?.placeName?.default;
                                    const awayTeamStr = g.awayTeam?.abbrev || g.awayTeam?.placeName?.default;
                                    
                                    const isHome = homeTeamStr === teamAbbrev;
                                    const opponent = isHome ? awayTeamStr : homeTeamStr;
                                    
                                    const teamScore = isHome ? (g.homeTeam?.score ?? 0) : (g.awayTeam?.score ?? 0);
                                    const oppScore = isHome ? (g.awayTeam?.score ?? 0) : (g.homeTeam?.score ?? 0);
                                    
                                    let resultColor = 'var(--text-tertiary)'; 
                                    if (isPlayed) {
                                        resultColor = teamScore > oppScore ? 'var(--positive)' : 'var(--negative)';
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
                                            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 5px', borderBottom: '1px solid var(--border-subtle)', background: isCurrentGame ? 'rgba(0, 212, 255, 0.1)' : 'transparent', cursor: 'pointer', transition: 'background 0.2s' }}
                                        >
                                            <div style={{ width: '45px', color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>{gameDate}</div>
                                            
                                            <div style={{ display: 'flex', alignItems: 'center', flex: 1, justifyContent: 'flex-end', gap: '8px' }}>
                                                <span style={{ color: isHome ? 'var(--text-tertiary)' : 'var(--text-primary)' }}>{isHome ? opponent : teamAbbrev}</span>
                                                
                                                {/* PIENI LOGO VASEN (Vierasjoukkue) */}
                                                <TeamBadge abbrev={isHome ? opponent : teamAbbrev} size={24} />
                                                
                                            </div>
                                            
                                            <div style={{ width: '70px', textAlign: 'center', fontWeight: 'bold', color: resultColor, fontSize: '1rem' }}>
                                                {isPlayed ? `${isHome ? oppScore : teamScore} - ${isHome ? teamScore : oppScore}` : 'vs'}
                                            </div>
                                            
                                            <div style={{ display: 'flex', alignItems: 'center', flex: 1, justifyContent: 'flex-start', gap: '8px' }}>
                                                
                                                {/* PIENI LOGO OIKEA (Kotijoukkue) */}
                                                <TeamBadge abbrev={isHome ? teamAbbrev : opponent} size={24} />
                                                
                                                <span style={{ color: isHome ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>{isHome ? teamAbbrev : opponent}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </>
                )}
            </>
        </Sheet>
    );
};

export default TeamModal;